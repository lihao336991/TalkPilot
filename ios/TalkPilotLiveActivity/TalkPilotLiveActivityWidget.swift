import ActivityKit
import SwiftUI
import WidgetKit

private enum MessageSide {
  case partner
  case selfSpeaker
  case system

  init(_ speaker: TalkPilotActivityAttributes.MessageSpeaker) {
    switch speaker {
    case .other:
      self = .partner
    case .selfSpeaker:
      self = .selfSpeaker
    case .system:
      self = .system
    }
  }

  var isSelf: Bool {
    self == .selfSpeaker
  }

  var title: String {
    switch self {
    case .partner:
      return "Partner"
    case .selfSpeaker:
      return "You"
    case .system:
      return "TalkPilot"
    }
  }

  var iconName: String {
    switch self {
    case .partner:
      return "person.wave.2.fill"
    case .selfSpeaker:
      return "person.fill"
    case .system:
      return "waveform"
    }
  }

  var accentColor: Color {
    switch self {
    case .partner:
      return Color(red: 0.35, green: 0.64, blue: 1.00)
    case .selfSpeaker:
      return Color(red: 0.36, green: 0.91, blue: 0.66)
    case .system:
      return Color(red: 0.82, green: 0.86, blue: 0.92)
    }
  }
}

struct TalkPilotLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TalkPilotActivityAttributes.self) { context in
      TalkPilotLiveActivityView(state: context.state)
        .activityBackgroundTint(Color(red: 0.04, green: 0.05, blue: 0.08))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      let side = MessageSide(context.state.latestSpeaker)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          CompactAvatar(side: side)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Image(systemName: side.isSelf ? context.state.reviewScore.iconName : "sparkles")
            .foregroundStyle(side.isSelf ? context.state.reviewScore.accentColor : Color.blue)
        }
        DynamicIslandExpandedRegion(.bottom) {
          DynamicIslandMessageView(state: context.state, side: side)
        }
      } compactLeading: {
        Image(systemName: side.iconName)
          .foregroundStyle(side.accentColor)
      } compactTrailing: {
        Image(systemName: side.isSelf ? context.state.reviewScore.iconName : "sparkles")
          .foregroundStyle(side.isSelf ? context.state.reviewScore.accentColor : Color.blue)
      } minimal: {
        Image(systemName: side.iconName)
          .foregroundStyle(side.accentColor)
      }
    }
    .contentMarginsDisabled()
  }
}

private struct TalkPilotLiveActivityView: View {
  let state: TalkPilotActivityAttributes.ContentState

  var body: some View {
    let side = MessageSide(state.latestSpeaker)

    ZStack {
      Color(red: 0.035, green: 0.045, blue: 0.070)

      MessageCard(state: state, side: side)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: side.isSelf ? .trailing : .leading)
    }
    .frame(height: 150)
  }
}

private struct MessageCard: View {
  let state: TalkPilotActivityAttributes.ContentState
  let side: MessageSide

  var body: some View {
    VStack(alignment: side.isSelf ? .trailing : .leading, spacing: 5) {
      Text(state.latestMessage)
        .font(.system(size: 13, weight: .semibold, design: .rounded))
        .foregroundStyle(.white.opacity(0.82))
        .lineLimit(2)
        .multilineTextAlignment(side.isSelf ? .trailing : .leading)
        .frame(maxWidth: .infinity, alignment: side.isSelf ? .trailing : .leading)
        .frame(height: 28, alignment: side.isSelf ? .trailing : .leading)

      if side == .partner {
        TranslationBlock(state: state)
        AssistLine(
          iconName: "sparkles",
          text: state.suggestionIsLoading ? nil : state.suggestionText,
          isLoading: state.suggestionIsLoading,
          tint: Color(red: 0.35, green: 0.64, blue: 1.00),
          alignment: .leading
        )
      } else if side.isSelf {
        AssistLine(
          iconName: state.reviewScore.iconName,
          text: state.reviewIsLoading ? nil : reviewText,
          isLoading: state.reviewIsLoading,
          tint: state.reviewScore.accentColor,
          alignment: .trailing
        )
      }
    }
    .frame(maxWidth: .infinity, alignment: side.isSelf ? .trailing : .leading)
    .padding(.horizontal, 11)
    .padding(.vertical, 9)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: side.isSelf ? .trailing : .leading)
    .background(
      ZStack {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color.white.opacity(0.10))
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(assistGradient)
      }
    )
    .overlay(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .stroke(cardStroke, lineWidth: 1)
    )
  }

  private var assistGradient: LinearGradient {
    let color = side.isSelf ? state.reviewScore.accentColor : Color(red: 0.35, green: 0.64, blue: 1.00)
    return LinearGradient(
      colors: [
        color.opacity(0.30),
        color.opacity(0.10),
        Color.white.opacity(0.02)
      ],
      startPoint: side.isSelf ? .topTrailing : .topLeading,
      endPoint: side.isSelf ? .bottomLeading : .bottomTrailing
    )
  }

  private var cardStroke: Color {
    side.isSelf ? state.reviewScore.accentColor.opacity(0.28) : Color(red: 0.35, green: 0.64, blue: 1.00).opacity(0.28)
  }

  private var reviewText: String? {
    if let reviewSummary = state.reviewSummary {
      return reviewSummary
    }
    if state.reviewIssueCount > 0 {
      return "\(state.reviewIssueCount) fix\(state.reviewIssueCount == 1 ? "" : "es") found"
    }
    return state.reviewScore == nil ? nil : state.reviewScore.label
  }
}

private struct HeaderLine: View {
  let state: TalkPilotActivityAttributes.ContentState
  let side: MessageSide

  var body: some View {
    HStack(spacing: 6) {
      if side.isSelf {
        Spacer(minLength: 0)
      }

      Image(systemName: side.iconName)
        .font(.caption.weight(.bold))
        .foregroundStyle(side.accentColor)
      Text(side.title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white.opacity(0.66))

      if let latestMessageAt = state.latestMessageAt {
        Text(latestMessageAt, style: .relative)
          .font(.caption2)
          .foregroundStyle(.white.opacity(0.44))
      }

      if !side.isSelf {
        Spacer(minLength: 0)
      }
    }
  }
}

private struct TranslationBlock: View {
  let state: TalkPilotActivityAttributes.ContentState

  var body: some View {
    Text(translationText)
      .font(.system(size: 11, weight: .medium, design: .rounded))
      .foregroundStyle(.white.opacity(0.64))
      .lineLimit(2)
      .multilineTextAlignment(.leading)
      .opacity(translationText.isEmpty ? 0 : 1)
      .frame(maxWidth: .infinity, alignment: .leading)
      .frame(height: 24, alignment: .leading)
  }

  private var translationText: String {
    if let translation = state.latestTranslation {
      return translation
    }
    return state.latestTranslationIsLoading ? "Translating..." : ""
  }
}

private struct AssistLine: View {
  let iconName: String
  let text: String?
  let isLoading: Bool
  let tint: Color
  let alignment: TextAlignment

  var body: some View {
    HStack(alignment: .top, spacing: 7) {
      if alignment == .trailing {
        Spacer(minLength: 0)
      }

      if isLoading {
        AILoadingIndicator(tint: tint)
          .frame(maxWidth: .infinity, alignment: alignment == .trailing ? .trailing : .leading)
      } else {
        Image(systemName: iconName)
          .font(.system(size: 13, weight: .bold))
          .foregroundStyle(tint)
          .frame(width: 16, height: 20)

        Text(text ?? "")
          .font(.system(size: 16, weight: .semibold, design: .rounded))
          .foregroundStyle(.white.opacity(0.94))
          .lineLimit(3)
          .multilineTextAlignment(alignment)
      }

      if alignment == .leading {
        Spacer(minLength: 0)
      }
    }
    .padding(.horizontal, 9)
    .padding(.vertical, 7)
    .frame(maxWidth: .infinity, alignment: alignment == .trailing ? .trailing : .leading)
    .frame(height: 64, alignment: alignment == .trailing ? .trailing : .leading)
  }
}

private struct AILoadingIndicator: View {
  let tint: Color

  var body: some View {
    TimelineView(.animation) { timeline in
      let seconds = timeline.date.timeIntervalSinceReferenceDate
      let angle = Angle.degrees(seconds.truncatingRemainder(dividingBy: 1.4) / 1.4 * 360)

      ZStack {
        Circle()
          .fill(tint.opacity(0.15))
          .frame(width: 32, height: 32)

        Image(systemName: "sparkles")
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(tint)
          .rotationEffect(angle)
      }
    }
  }
}

private struct DynamicIslandMessageView: View {
  let state: TalkPilotActivityAttributes.ContentState
  let side: MessageSide

  var body: some View {
    VStack(alignment: side.isSelf ? .trailing : .leading, spacing: 5) {
      Text(state.latestMessage)
        .font(.system(size: 17, weight: .semibold, design: .rounded))
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: side.isSelf ? .trailing : .leading)

      if side == .partner {
        Text(state.latestTranslation ?? state.suggestionText ?? "Suggest ready")
          .font(.caption)
          .foregroundStyle(Color(red: 0.58, green: 0.76, blue: 1.00))
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
      } else if side.isSelf {
        Text(state.reviewSummary ?? state.reviewScore.label)
          .font(.caption)
          .foregroundStyle(state.reviewScore.accentColor)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .trailing)
      }
    }
  }
}

private struct CompactAvatar: View {
  let side: MessageSide

  var body: some View {
    HStack(spacing: 5) {
      Image(systemName: side.iconName)
        .foregroundStyle(side.accentColor)
      Text(side.title)
        .font(.caption.weight(.semibold))
        .lineLimit(1)
    }
  }
}

private extension Optional where Wrapped == TalkPilotActivityAttributes.ReviewScore {
  var label: String {
    switch self {
    case .some(.green):
      return "Great"
    case .some(.yellow):
      return "Needs polish"
    case .some(.red):
      return "Fix this"
    case .none:
      return "Review pending"
    }
  }

  var iconName: String {
    switch self {
    case .some(.green):
      return "checkmark.seal.fill"
    case .some(.yellow):
      return "exclamationmark.triangle.fill"
    case .some(.red):
      return "xmark.octagon.fill"
    case .none:
      return "checkmark.seal"
    }
  }

  var accentColor: Color {
    switch self {
    case .some(.green):
      return Color(red: 0.36, green: 0.91, blue: 0.66)
    case .some(.yellow):
      return Color(red: 0.98, green: 0.78, blue: 0.27)
    case .some(.red):
      return Color(red: 1.00, green: 0.42, blue: 0.42)
    case .none:
      return Color(red: 0.62, green: 0.72, blue: 0.86)
    }
  }
}

@main
struct TalkPilotLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    TalkPilotLiveActivityWidget()
  }
}
