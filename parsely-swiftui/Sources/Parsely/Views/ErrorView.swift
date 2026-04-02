import SwiftUI

/// Error recovery screen — mirrors ErrorDisplay.tsx + error layout in app.tsx
struct ErrorView: View {
    let message: String
    let url: String
    let onRetry: (String) -> Void

    @State private var urlInput: String
    @FocusState private var isFocused: Bool

    init(message: String, url: String, onRetry: @escaping (String) -> Void) {
        self.message = message
        self.url = url
        self.onRetry = onRetry
        self._urlInput = State(initialValue: url)
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 44))
                .foregroundStyle(.red.opacity(0.8))

            VStack(spacing: 8) {
                Text("Recipe not found")
                    .font(.title2)
                    .fontWeight(.semibold)
                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 480)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Troubleshooting")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                ForEach(tips, id: \.self) { tip in
                    HStack(alignment: .top, spacing: 6) {
                        Text("·").foregroundStyle(.secondary)
                        Text(tip).font(.caption).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: 480, alignment: .leading)
            .background(.background.secondary)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            HStack(spacing: 10) {
                TextField("URL", text: $urlInput)
                    .textFieldStyle(.plain)
                    .font(.system(.body, design: .monospaced))
                    .focused($isFocused)
                    .onSubmit { onRetry(urlInput) }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(.background.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator, lineWidth: 1))

                Button("Retry") { onRetry(urlInput) }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(urlInput.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .frame(maxWidth: 520)

            Spacer()
        }
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { isFocused = true }
    }

    private let tips = [
        "Check the URL points to an actual recipe page, not a category or search page.",
        "Some sites require JavaScript — the browser scraper handles this automatically.",
        "Set the OPENAI_API_KEY environment variable to enable AI fallback.",
        "Try opening the URL in a browser first to confirm it loads correctly.",
    ]
}
