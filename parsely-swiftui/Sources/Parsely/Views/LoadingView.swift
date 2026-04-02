import SwiftUI

/// In-progress scraping screen — mirrors LoadingScreen.tsx + PhaseRail.tsx
struct LoadingView: View {
    let phase: ScrapePhase
    let message: String
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            ProgressView()
                .controlSize(.large)
                .tint(.green)

            VStack(spacing: 6) {
                Text(phaseTitle)
                    .font(.title3)
                    .fontWeight(.semibold)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            // Phase rail — mirrors PhaseRail.tsx
            HStack(spacing: 0) {
                PhaseStep(label: "Browser",  systemImage: "globe",                   state: state(for: .browser))
                RailConnector(filled: state(for: .browser) == .done)
                PhaseStep(label: "Schema",   systemImage: "doc.text.magnifyingglass", state: state(for: .parsing))
                RailConnector(filled: state(for: .parsing) == .done)
                PhaseStep(label: "AI",       systemImage: "sparkles",                state: state(for: .ai))
            }
            .padding(.top, 4)

            Button("Cancel", action: onCancel)
                .buttonStyle(.bordered)
                .controlSize(.small)
                .padding(.top, 4)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private var phaseTitle: String {
        switch phase {
        case .browser: return "Fetching page"
        case .parsing: return "Reading schema"
        case .ai:      return "AI extraction"
        default:       return "Working..."
        }
    }

    enum StepState { case pending, active, done }

    private func state(for step: ScrapePhase) -> StepState {
        let order: [ScrapePhase] = [.browser, .parsing, .ai, .done]
        guard
            let current = order.firstIndex(of: phase),
            let target  = order.firstIndex(of: step)
        else { return .pending }
        if current > target  { return .done }
        if current == target { return .active }
        return .pending
    }
}

// MARK: - Sub-components

private struct PhaseStep: View {
    let label: String
    let systemImage: String
    let state: LoadingView.StepState

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(bubbleFill)
                    .frame(width: 36, height: 36)
                Image(systemName: state == .done ? "checkmark" : systemImage)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(iconColor)
            }
            Text(label)
                .font(.caption2)
                .foregroundStyle(state == .pending ? .tertiary : .primary)
        }
    }

    private var bubbleFill: Color {
        switch state {
        case .done:    return .green.opacity(0.15)
        case .active:  return .primary.opacity(0.08)
        case .pending: return .primary.opacity(0.04)
        }
    }

    private var iconColor: Color {
        switch state {
        case .done:    return .green
        case .active:  return .primary
        case .pending: return .tertiary
        }
    }
}

private struct RailConnector: View {
    let filled: Bool

    var body: some View {
        Rectangle()
            .fill(filled ? Color.green.opacity(0.4) : Color.separator)
            .frame(width: 28, height: 1.5)
            .padding(.bottom, 18) // align with circle center
    }
}
