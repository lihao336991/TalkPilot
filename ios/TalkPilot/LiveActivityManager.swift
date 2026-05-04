import ActivityKit
import Foundation

private struct LiveActivitySyncPayload: Decodable {
  let sceneName: String
  let startedAtMs: Double
  let sessionStatus: String
  let latestSpeaker: String?
  let latestMessage: String?
  let latestMessageAtMs: Double?
}

enum LiveActivityManagerError: LocalizedError {
  case invalidPayload

  var errorDescription: String? {
    switch self {
    case .invalidPayload:
      return "Invalid live activity payload."
    }
  }
}

@MainActor
final class LiveActivityManager {
  static let shared = LiveActivityManager()

  private var currentActivity: Activity<TalkPilotActivityAttributes>?

  func sync(payloadJSON: String) async throws {
    let data = Data(payloadJSON.utf8)
    let payload = try JSONDecoder().decode(LiveActivitySyncPayload.self, from: data)

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return
    }

    guard let status = mapSessionStatus(payload.sessionStatus) else {
      await end()
      return
    }

    let attributes = TalkPilotActivityAttributes(
      sceneName: normalizedSceneName(payload.sceneName),
      startedAt: Date(timeIntervalSince1970: payload.startedAtMs / 1000)
    )
    let state = TalkPilotActivityAttributes.ContentState(
      sessionStatus: status,
      latestSpeaker: mapSpeaker(payload.latestSpeaker),
      latestMessage: normalizedMessage(payload.latestMessage),
      latestMessageAt: mapDate(payload.latestMessageAtMs)
    )

    if let activity = activeActivity(matching: attributes) {
      currentActivity = activity
      await activity.update(ActivityContent(state: state, staleDate: nil))
      return
    }

    await endAllActivities()
    currentActivity = try Activity.request(
      attributes: attributes,
      content: ActivityContent(state: state, staleDate: nil),
      pushType: nil
    )
  }

  func end() async {
    await endAllActivities()
    currentActivity = nil
  }

  private func endAllActivities() async {
    let activities = Activity<TalkPilotActivityAttributes>.activities
    guard !activities.isEmpty else {
      return
    }

    for activity in activities {
      let finalState = TalkPilotActivityAttributes.ContentState(
        sessionStatus: activity.content.state.sessionStatus,
        latestSpeaker: activity.content.state.latestSpeaker,
        latestMessage: activity.content.state.latestMessage,
        latestMessageAt: activity.content.state.latestMessageAt
      )
      await activity.end(
        ActivityContent(state: finalState, staleDate: nil),
        dismissalPolicy: .immediate
      )
    }
  }

  private func activeActivity(
    matching attributes: TalkPilotActivityAttributes
  ) -> Activity<TalkPilotActivityAttributes>? {
    let activities = Activity<TalkPilotActivityAttributes>.activities
    guard let matched = activities.first(where: {
      $0.attributes.sceneName == attributes.sceneName &&
        abs($0.attributes.startedAt.timeIntervalSince1970 - attributes.startedAt.timeIntervalSince1970) < 1
    }) else {
      return nil
    }
    return matched
  }

  private func mapSessionStatus(
    _ rawValue: String
  ) -> TalkPilotActivityAttributes.SessionStatus? {
    switch rawValue {
    case "active":
      return .active
    case "paused":
      return .paused
    default:
      return nil
    }
  }

  private func mapSpeaker(_ rawValue: String?) -> TalkPilotActivityAttributes.MessageSpeaker {
    switch rawValue {
    case "self":
      return .selfSpeaker
    case "other":
      return .other
    default:
      return .system
    }
  }

  private func normalizedSceneName(_ sceneName: String) -> String {
    let trimmed = sceneName.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? "Live Session" : trimmed
  }

  private func normalizedMessage(_ message: String?) -> String {
    let trimmed = message?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmed.isEmpty ? "Waiting for the latest message..." : trimmed
  }

  private func mapDate(_ milliseconds: Double?) -> Date? {
    guard let milliseconds else {
      return nil
    }
    return Date(timeIntervalSince1970: milliseconds / 1000)
  }
}
