import SwiftUI

/// Idle screen — mirrors LandingScreen.tsx
struct LandingView: View {
    let onSubmit: (String) -> Void

    @State private var urlInput = ""
    @State private var validationError: String?
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 36) {
            Spacer()

            // Wordmark — mirrors the cfonts "Parsely" render in LandingScreen.tsx
            VStack(spacing: 6) {
                Text("Parsely")
                    .font(.system(size: 60, weight: .bold, design: .rounded))
                    .foregroundStyle(.green)
                Text("Paste a recipe URL and press Enter")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            // URL input
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    TextField("https://example.com/my-recipe", text: $urlInput)
                        .textFieldStyle(.plain)
                        .font(.system(.body, design: .monospaced))
                        .focused($isFocused)
                        .onSubmit(submit)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(.background.secondary)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(
                                    validationError != nil ? Color.red : Color.separator,
                                    lineWidth: 1
                                )
                        )

                    Button("Fetch", action: submit)
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                        .disabled(urlInput.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .frame(maxWidth: 560)

                if let error = validationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding(.leading, 4)
                }
            }

            Spacer()

            Text("Powered by WebKit · OpenAI fallback")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { isFocused = true }
    }

    private func submit() {
        var trimmed = urlInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if !trimmed.hasPrefix("http://") && !trimmed.hasPrefix("https://") {
            trimmed = "https://" + trimmed
        }
        guard URL(string: trimmed) != nil else {
            validationError = "That doesn't look like a valid URL"
            return
        }
        validationError = nil
        onSubmit(trimmed)
    }
}
