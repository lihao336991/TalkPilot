import ActivityKit
import Foundation

private struct LiveActivitySyncPayload: Decodable {
  let sceneName: String
  let startedAtMs: Double
  let sessionStatus: String
  let isListening: Bool?
  let copilotEnabled: Bool?
  let turnCount: Int?
  let latestSpeaker: String?
  let latestMessage: String?
  let latestTranslation: String?
  let latestTranslationIsLoading: Bool?
  let latestMessageAtMs: Double?
  let suggestionStyle: String?
  let suggestionText: String?
  let suggestionIsLoading: Bool?
  let reviewScore: String?
  let reviewSummary: String?
  let reviewIssueCount: Int?
  let reviewIsLoading: Bool?
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
      isListening: payload.isListening ?? false,
      copilotEnabled: payload.copilotEnabled ?? true,
      turnCount: max(payload.turnCount ?? 0, 0),
      latestSpeaker: mapSpeaker(payload.latestSpeaker),
      latestMessage: normalizedMessage(payload.latestMessage),
      latestTranslation: normalizedOptionalText(payload.latestTranslation),
      latestTranslationIsLoading: payload.latestTranslationIsLoading ?? false,
      latestMessageAt: mapDate(payload.latestMessageAtMs),
      suggestionStyle: mapSuggestionStyle(payload.suggestionStyle),
      suggestionText: normalizedOptionalText(payload.suggestionText),
      suggestionIsLoading: payload.suggestionIsLoading ?? false,
      reviewScore: mapReviewScore(payload.reviewScore),
      reviewSummary: normalizedOptionalText(payload.reviewSummary),
      reviewIssueCount: max(payload.reviewIssueCount ?? 0, 0),
      reviewIsLoading: payload.reviewIsLoading ?? false
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
        isListening: activity.content.state.isListening,
        copilotEnabled: activity.content.state.copilotEnabled,
        turnCount: activity.content.state.turnCount,
        latestSpeaker: activity.content.state.latestSpeaker,
        latestMessage: activity.content.state.latestMessage,
        latestTranslation: activity.content.state.latestTranslation,
        latestTranslationIsLoading: activity.content.state.latestTranslationIsLoading,
        latestMessageAt: activity.content.state.latestMessageAt,
        suggestionStyle: activity.content.state.suggestionStyle,
        suggestionText: activity.content.state.suggestionText,
        suggestionIsLoading: activity.content.state.suggestionIsLoading,
        reviewScore: activity.content.state.reviewScore,
        reviewSummary: activity.content.state.reviewSummary,
        reviewIssueCount: activity.content.state.reviewIssueCount,
        reviewIsLoading: activity.content.state.reviewIsLoading
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

  private func mapSuggestionStyle(_ rawValue: String?) -> TalkPilotActivityAttributes.SuggestionStyle? {
    switch rawValue {
    case "formal":
      return .formal
    case "casual":
      return .casual
    case "simple":
      return .simple
    default:
      return nil
    }
  }

  private func mapReviewScore(_ rawValue: String?) -> TalkPilotActivityAttributes.ReviewScore? {
    switch rawValue {
    case "green":
      return .green
    case "yellow":
      return .yellow
    case "red":
      return .red
    default:
      return nil
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

  private func normalizedOptionalText(_ text: String?) -> String? {
    let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmed.isEmpty ? nil : trimmed
  }

  private func mapDate(_ milliseconds: Double?) -> Date? {
    guard let milliseconds else {
      return nil
    }
    return Date(timeIntervalSince1970: milliseconds / 1000)
  }
}
