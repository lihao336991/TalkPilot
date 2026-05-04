import ActivityKit
import SwiftUI
import WidgetKit

private enum LiveActivitySpeakerPresentation {
  case selfSpeaker
  case other
  case system

  init(_ speaker: TalkPilotActivityAttributes.MessageSpeaker) {
    switch speaker {
    case .selfSpeaker:
      self = .selfSpeaker
    case .other:
      self = .other
    case .system:
      self = .system
    }
  }

  var label: String {
    switch self {
    case .selfSpeaker:
      return "You"
    case .other:
      return "Other"
    case .system:
      return "Live"
    }
  }

  var iconName: String {
    switch self {
    case .selfSpeaker:
      return "person.fill"
    case .other:
      return "person.wave.2.fill"
    case .system:
      return "waveform"
    }
  }

  var accentColor: Color {
    switch self {
    case .selfSpeaker:
      return Color.green
    case .other:
      return Color.blue
    case .system:
      return Color.secondary
    }
  }
}

struct TalkPilotLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TalkPilotActivityAttributes.self) { context in
      TalkPilotLiveActivityView(context: context)
        .activityBackgroundTint(Color.black.opacity(0.9))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      let speaker = LiveActivitySpeakerPresentation(context.state.latestSpeaker)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 6) {
            Image(systemName: speaker.iconName)
              .foregroundStyle(speaker.accentColor)
            Text("TalkPilot")
              .font(.caption.weight(.semibold))
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(context.attributes.startedAt, style: .timer)
            .font(.caption2.monospacedDigit())
            .foregroundStyle(.secondary)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.sceneName)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
              Image(systemName: speaker.iconName)
                .foregroundStyle(speaker.accentColor)
              Text("\(speaker.label) said")
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            Text(context.state.latestMessage)
              .font(.subheadline)
              .lineLimit(2)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      } compactLeading: {
        Image(systemName: speaker.iconName)
          .foregroundStyle(speaker.accentColor)
      } compactTrailing: {
        Text(context.attributes.startedAt, style: .timer)
          .font(.caption2.monospacedDigit())
      } minimal: {
        Image(systemName: speaker.iconName)
          .foregroundStyle(speaker.accentColor)
      }
    }
  }
}

private struct TalkPilotLiveActivityView: View {
  let context: ActivityViewContext<TalkPilotActivityAttributes>

  var body: some View {
    let speaker = LiveActivitySpeakerPresentation(context.state.latestSpeaker)

    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .center, spacing: 8) {
        Image(systemName: "waveform")
          .foregroundStyle(Color.white)
        VStack(alignment: .leading, spacing: 2) {
          Text("TalkPilot")
            .font(.caption.weight(.semibold))
          Text(context.attributes.sceneName)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        Spacer()
        Text(context.attributes.startedAt, style: .timer)
          .font(.caption.monospacedDigit())
          .foregroundStyle(.secondary)
      }

      HStack(spacing: 6) {
        Image(systemName: speaker.iconName)
          .foregroundStyle(speaker.accentColor)
        Text(context.state.sessionStatus == .paused ? "Paused" : "\(speaker.label) said")
          .font(.caption.weight(.medium))
          .foregroundStyle(.secondary)
      }

      Text(context.state.latestMessage)
        .font(.system(size: 18, weight: .semibold, design: .rounded))
        .foregroundStyle(Color.white)
        .lineLimit(3)
        .multilineTextAlignment(.leading)

      if let latestMessageAt = context.state.latestMessageAt {
        Text(latestMessageAt, style: .relative)
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 8)
  }
}

@main
struct TalkPilotLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    TalkPilotLiveActivityWidget()
  }
}
