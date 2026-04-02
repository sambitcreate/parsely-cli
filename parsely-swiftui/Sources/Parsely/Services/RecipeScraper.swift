import Foundation
import WebKit
import Observation

// MARK: - Phase & Errors

enum ScrapePhase: Equatable {
    case idle
    case browser    // Puppeteer equivalent: headless page load
    case parsing    // Cheerio equivalent: JSON-LD extraction
    case ai         // OpenAI fallback
    case done
}

enum ScrapeError: LocalizedError {
    case invalidURL
    case noRecipeFound
    case navigationFailed(String)
    case timeout
    case aiUnavailable
    case aiError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:               return "That doesn't look like a valid URL."
        case .noRecipeFound:            return "No recipe schema found on this page."
        case .navigationFailed(let m):  return "Page failed to load: \(m)"
        case .timeout:                  return "Page load timed out after 30 seconds."
        case .aiUnavailable:            return "Set OPENAI_API_KEY to enable AI fallback."
        case .aiError(let m):           return "AI extraction failed: \(m)"
        }
    }
}

// MARK: - Scraper

/// Observable scraper that drives a WebPage (the WebKit.WebPage equivalent of Puppeteer).
/// Must be used on the MainActor because WebPage is main-actor-bound.
@MainActor
@Observable
final class RecipeScraper {

    private(set) var phase: ScrapePhase = .idle
    private(set) var statusMessage: String = ""

    /// The WebPage that the hidden WebView in ContentView renders.
    /// WebPage = Puppeteer's Browser + Page combined into one Observable model.
    let webPage = WebPage()

    private var currentTask: Task<Recipe, Error>?

    // MARK: Public API

    func scrape(urlString: String) async throws -> Recipe {
        currentTask?.cancel()
        guard let url = normalizeURL(urlString) else { throw ScrapeError.invalidURL }

        let task = Task<Recipe, Error> { [weak self] in
            guard let self else { throw CancellationError() }
            return try await self.run(url: url)
        }
        currentTask = task
        return try await task.value
    }

    func cancel() {
        currentTask?.cancel()
        webPage.stopLoading()
        phase = .idle
        statusMessage = ""
    }

    // MARK: Pipeline

    private func run(url: URL) async throws -> Recipe {
        // ── Stage 1: Browser (replaces Puppeteer goto + waitForNavigation) ──
        phase = .browser
        statusMessage = "Fetching page..."

        webPage.load(URLRequest(url: url))
        try await waitForLoad()

        // ── Stage 2: Parsing (replaces Cheerio JSON-LD walk) ──
        phase = .parsing
        statusMessage = "Reading recipe schema..."

        if let recipe = try await extractRecipeFromPage(source: .browser) {
            phase = .done
            return recipe
        }

        // ── Stage 3: AI fallback (replaces OpenAI call in scraper.ts) ──
        phase = .ai
        statusMessage = "Recovering recipe with AI..."

        // Truncate to ~40 KB to keep token cost sane (scraper.ts caps at 120 KB HTML;
        // innerText is much denser so 40 K chars ≈ same information density).
        let pageText = try await callJS("document.body?.innerText?.substring(0, 40000) ?? ''")
            as? String ?? ""

        guard !pageText.isEmpty else { throw ScrapeError.noRecipeFound }

        let recipe = try await scrapeWithAI(url: url.absoluteString, pageContent: pageText)
        phase = .done
        return recipe
    }

    // MARK: Navigation

    /// Poll currentNavigationEvent until the page settles or fails.
    /// Mirrors Puppeteer's page.waitForNavigation().
    private func waitForLoad() async throws {
        // 300 × 100 ms = 30 s timeout
        for _ in 0..<300 {
            try Task.checkCancellation()
            switch webPage.currentNavigationEvent?.kind {
            case .finished:
                return
            case .failed(let err), .failedProvisionalNavigation(let err):
                throw ScrapeError.navigationFailed(err.localizedDescription)
            default:
                try await Task.sleep(for: .milliseconds(100))
            }
        }
        throw ScrapeError.timeout
    }

    // MARK: JSON-LD Extraction (Cheerio equivalent)

    /// Extracts recipe data from JSON-LD script tags via callJavaScript.
    /// Mirrors extractRecipeFromHtml() + findRecipeJson() in scraper.ts.
    private func extractRecipeFromPage(source: Recipe.Source) async throws -> Recipe? {
        // Collect and parse all ld+json blocks in one JS call
        let raw = try await callJS("""
            (function() {
                var scripts = Array.from(
                    document.querySelectorAll('script[type="application/ld+json"]')
                );
                var parsed = scripts.map(function(s) {
                    try { return JSON.parse(s.textContent || ''); }
                    catch { return null; }
                }).filter(Boolean);
                return JSON.stringify(parsed);
            })()
        """) as? String

        guard
            let jsonString = raw,
            let data = jsonString.data(using: .utf8),
            let blocks = try? JSONSerialization.jsonObject(with: data) as? [Any]
        else { return nil }

        for block in blocks {
            if let dict = block as? [String: Any],
               let recipe = findRecipe(in: dict, source: source) {
                return recipe
            }
        }
        return nil
    }

    /// Walks a JSON-LD block (and any @graph array) looking for a Recipe @type.
    private func findRecipe(in dict: [String: Any], source: Recipe.Source) -> Recipe? {
        let types = (dict["@type"] as? [String]) ?? ((dict["@type"] as? String).map { [$0] } ?? [])
        if types.contains(where: { $0.lowercased().contains("recipe") }) {
            return normalize(dict, source: source)
        }
        if let graph = dict["@graph"] as? [[String: Any]] {
            for item in graph {
                if let recipe = findRecipe(in: item, source: source) { return recipe }
            }
        }
        return nil
    }

    // MARK: Normalization

    private func normalize(_ dict: [String: Any], source: Recipe.Source) -> Recipe {
        Recipe(
            name: (dict["name"] as? String) ?? "",
            description: dict["description"] as? String,
            prepTime: isoToMinutes(dict["prepTime"] as? String),
            cookTime: isoToMinutes(dict["cookTime"] as? String),
            totalTime: isoToMinutes(dict["totalTime"] as? String),
            servings: normalizeServings(dict["recipeYield"]),
            ingredients: (dict["recipeIngredient"] as? [String] ?? [])
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty },
            instructions: normalizeInstructions(dict["recipeInstructions"]),
            nutrition: normalizeNutrition(dict["nutrition"] as? [String: Any]),
            source: source
        )
    }

    private func normalizeServings(_ value: Any?) -> String? {
        if let s = value as? String, !s.isEmpty { return s }
        if let n = value as? Int { return "\(n)" }
        if let a = value as? [Any] { return normalizeServings(a.first) }
        return nil
    }

    private func normalizeInstructions(_ value: Any?) -> [String] {
        if let str = value as? String { return [str] }
        if let arr = value as? [Any] {
            return arr.compactMap { item -> String? in
                if let s = item as? String { return s }
                if let d = item as? [String: Any] {
                    if let t = d["text"] as? String { return t }
                    if let sub = d["itemListElement"] { return normalizeInstructions(sub).joined(separator: " ") }
                }
                return nil
            }.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        }
        return []
    }

    private func normalizeNutrition(_ dict: [String: Any]?) -> Recipe.NutritionInfo? {
        guard let dict else { return nil }
        let info = Recipe.NutritionInfo(
            calories: dict["calories"] as? String,
            fat: dict["fatContent"] as? String,
            protein: dict["proteinContent"] as? String,
            carbohydrates: dict["carbohydrateContent"] as? String,
            fiber: dict["fiberContent"] as? String,
            sugar: dict["sugarContent"] as? String,
            sodium: dict["sodiumContent"] as? String
        )
        return info.isEmpty ? nil : info
    }

    /// ISO 8601 duration → minutes. Mirrors isoToMinutes() in helpers.ts.
    private func isoToMinutes(_ iso: String?) -> Int? {
        guard let iso, iso.uppercased().hasPrefix("PT") else { return nil }
        var mins = 0, acc = ""
        for ch in iso.uppercased().dropFirst(2) {
            if ch.isNumber { acc.append(ch) }
            else if ch == "H" { mins += (Int(acc) ?? 0) * 60; acc = "" }
            else if ch == "M" { mins += Int(acc) ?? 0; acc = "" }
        }
        return mins > 0 ? mins : nil
    }

    // MARK: URL Helpers

    private func normalizeURL(_ raw: String) -> URL? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !s.hasPrefix("http://") && !s.hasPrefix("https://") { s = "https://" + s }
        guard let url = URL(string: s), url.scheme == "https" || url.scheme == "http" else {
            return nil
        }
        return url
    }

    // MARK: JS Helper

    @discardableResult
    private func callJS(_ script: String) async throws -> Any? {
        try await webPage.callJavaScript("(function(){ return \(script) })()")
    }

    // MARK: AI Fallback (mirrors scrapeWithAI in scraper.ts)

    private func scrapeWithAI(url: String, pageContent: String) async throws -> Recipe {
        guard let apiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"],
              !apiKey.isEmpty
        else { throw ScrapeError.aiUnavailable }

        let systemPrompt = """
            extract recipe data as json. return only valid json, no markdown, no commentary.
            use ISO 8601 duration format for times (e.g. PT1H30M). use empty string for missing fields.
            """

        let userPrompt = """
            extract the recipe from this page and return JSON with exactly these fields:
            {"name":"","description":"","prepTime":"","cookTime":"","totalTime":"","recipeYield":"",\
            "recipeIngredient":[],"recipeInstructions":[],"nutrition":{"calories":"","fatContent":"",\
            "proteinContent":"","carbohydrateContent":""}}

            url: \(url)
            content: \(pageContent)
            """

        let body: [String: Any] = [
            "model": "gpt-4o-mini",
            "temperature": 0.2,
            "response_format": ["type": "json_object"],
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": userPrompt]
            ]
        ]

        var req = URLRequest(url: URL(string: "https://api.openai.com/v1/chat/completions")!)
        req.httpMethod = "POST"
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw ScrapeError.aiError("API returned non-2xx status")
        }

        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let choices = json["choices"] as? [[String: Any]],
            let content = choices.first?["message"] as? [String: Any],
            let text = content["content"] as? String,
            let recipeData = text.data(using: .utf8),
            let recipeDict = try? JSONSerialization.jsonObject(with: recipeData) as? [String: Any]
        else { throw ScrapeError.aiError("Could not parse AI response") }

        let recipe = normalize(recipeDict, source: .ai)
        guard !recipe.name.isEmpty || !recipe.ingredients.isEmpty else {
            throw ScrapeError.noRecipeFound
        }
        return recipe
    }
}
