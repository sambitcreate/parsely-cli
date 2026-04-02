import SwiftUI
import WebKit

// Mirrors the idle | scraping | display | error state machine in app.tsx
enum AppPhase {
    case idle
    case scraping
    case display(Recipe)
    case error(String)
}

@MainActor
struct ContentView: View {
    @State private var scraper = RecipeScraper()
    @State private var phase: AppPhase = .idle
    @State private var currentURL: String = ""

    var body: some View {
        ZStack {
            // Hidden WebView — always in the hierarchy when scraping so WebPage can render.
            // This is the SwiftUI equivalent of launching Puppeteer's headless browser:
            // WebPage needs a live WebView to drive JS execution and navigation events.
            if case .scraping = phase {
                WebView(webPage: scraper.webPage)
                    .frame(width: 1, height: 1)
                    .opacity(0)
                    .allowsHitTesting(false)
            }

            switch phase {
            case .idle:
                LandingView(onSubmit: startScraping)

            case .scraping:
                LoadingView(
                    phase: scraper.phase,
                    message: scraper.statusMessage,
                    onCancel: cancelScraping
                )

            case .display(let recipe):
                RecipeCard(recipe: recipe, onNew: resetToIdle)

            case .error(let message):
                ErrorView(message: message, url: currentURL, onRetry: startScraping)
            }
        }
        .frame(minWidth: 700, minHeight: 500)
        .tint(.green)
    }

    // MARK: - Actions

    private func startScraping(_ url: String) {
        currentURL = url
        phase = .scraping

        Task {
            do {
                let recipe = try await scraper.scrape(urlString: url)
                phase = .display(recipe)
            } catch is CancellationError {
                phase = .idle
            } catch {
                phase = .error(error.localizedDescription)
            }
        }
    }

    private func cancelScraping() {
        scraper.cancel()
        phase = .idle
    }

    private func resetToIdle() {
        phase = .idle
    }
}
