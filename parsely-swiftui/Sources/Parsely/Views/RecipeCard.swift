import SwiftUI

/// Full recipe display — mirrors RecipeCard.tsx.
/// Uses NavigationSplitView for a sidebar (meta/timing/nutrition) + detail (ingredients/instructions).
struct RecipeCard: View {
    let recipe: Recipe
    let onNew: () -> Void

    var body: some View {
        NavigationSplitView(columnVisibility: .constant(.all)) {
            sidebar
                .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 280)
        } detail: {
            detail
        }
        // ⌘N = new recipe, mirrors 'n' keybind in app.tsx
        .keyboardShortcut("n", modifiers: .command)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button("New Recipe", systemImage: "plus", action: onNew)
                    .help("Fetch another recipe (⌘N)")
            }
        }
    }

    // MARK: - Sidebar

    private var sidebar: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "leaf.fill")
                            .foregroundStyle(.green)
                            .imageScale(.small)
                        Text("Parsely")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.green)
                        Spacer()
                        sourceLabel
                    }
                    Text(recipe.name)
                        .font(.headline)
                        .lineLimit(4)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let desc = recipe.description, !desc.isEmpty {
                    Text(desc)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(6)
                }

                Divider()

                if recipe.prepTime != nil || recipe.cookTime != nil || recipe.totalTime != nil {
                    SidebarSection(label: "Timing", systemImage: "clock") {
                        if let t = recipe.prepTime  { MetricRow(label: "Prep",  value: formatMins(t)) }
                        if let t = recipe.cookTime  { MetricRow(label: "Cook",  value: formatMins(t)) }
                        if let t = recipe.totalTime { MetricRow(label: "Total", value: formatMins(t)) }
                    }
                }

                if let servings = recipe.servings {
                    Label(servings, systemImage: "person.2")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let n = recipe.nutrition, !n.isEmpty {
                    Divider()
                    SidebarSection(label: "Nutrition", systemImage: "chart.bar.fill") {
                        if let v = n.calories       { MetricRow(label: "Calories", value: v) }
                        if let v = n.fat            { MetricRow(label: "Fat",      value: v) }
                        if let v = n.protein        { MetricRow(label: "Protein",  value: v) }
                        if let v = n.carbohydrates  { MetricRow(label: "Carbs",    value: v) }
                        if let v = n.fiber          { MetricRow(label: "Fiber",    value: v) }
                        if let v = n.sugar          { MetricRow(label: "Sugar",    value: v) }
                        if let v = n.sodium         { MetricRow(label: "Sodium",   value: v) }
                    }
                }

                Divider()
                SidebarSection(label: "Recipe", systemImage: "fork.knife") {
                    MetricRow(label: "Ingredients", value: "\(recipe.ingredients.count)")
                    MetricRow(label: "Steps",       value: "\(recipe.instructions.count)")
                }

                Spacer(minLength: 16)

                Button(action: onNew) {
                    Label("New Recipe", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
            }
            .padding(16)
        }
        .background(.background.secondary)
    }

    private var sourceLabel: some View {
        HStack(spacing: 3) {
            Image(systemName: recipe.source == .browser ? "globe" : "sparkles")
            Text(recipe.source == .browser ? "Schema" : "AI")
        }
        .font(.caption2)
        .foregroundStyle(.tertiary)
    }

    // MARK: - Detail

    private var detail: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                Text(recipe.name)
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .fixedSize(horizontal: false, vertical: true)

                if !recipe.ingredients.isEmpty {
                    RecipeSection(title: "Ingredients") {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(Array(recipe.ingredients.enumerated()), id: \.offset) { _, ingredient in
                                HStack(alignment: .top, spacing: 10) {
                                    Text("·")
                                        .foregroundStyle(.green)
                                        .fontWeight(.bold)
                                        .frame(width: 12)
                                    Text(ingredient)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                }

                if !recipe.instructions.isEmpty {
                    RecipeSection(title: "Instructions") {
                        VStack(alignment: .leading, spacing: 14) {
                            ForEach(Array(recipe.instructions.enumerated()), id: \.offset) { index, step in
                                HStack(alignment: .top, spacing: 14) {
                                    Text("\(index + 1)")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .foregroundStyle(.white)
                                        .frame(width: 22, height: 22)
                                        .background(.green)
                                        .clipShape(Circle())
                                        .padding(.top, 1)
                                    Text(step)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .lineSpacing(3)
                                }
                            }
                        }
                    }
                }
            }
            .padding(32)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Helpers

    private func formatMins(_ mins: Int) -> String {
        guard mins >= 60 else { return "\(mins)m" }
        let h = mins / 60, m = mins % 60
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }
}

// MARK: - Sub-components

private struct SidebarSection<Content: View>: View {
    let label: String
    let systemImage: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(label, systemImage: systemImage)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
            content()
        }
    }
}

private struct MetricRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).fontWeight(.medium)
        }
        .font(.caption)
    }
}

private struct RecipeSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
            content()
        }
    }
}
