import ActivityKit
import Foundation

struct TalkPilotActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var sessionStatus: SessionStatus
    var isListening: Bool
    var copilotEnabled: Bool
    var turnCount: Int
    var latestSpeaker: MessageSpeaker
    var latestMessage: String
    var latestTranslation: String?
    var latestTranslationIsLoading: Bool
    var latestMessageAt: Date?
    var suggestionStyle: SuggestionStyle?
    var suggestionText: String?
    var suggestionIsLoading: Bool
    var reviewScore: ReviewScore?
    var reviewSummary: String?
    var reviewIssueCount: Int
    var reviewIsLoading: Bool
  }

  enum SessionStatus: String, Codable, Hashable {
    case active
    case paused
  }

  enum MessageSpeaker: String, Codable, Hashable {
    case selfSpeaker = "self"
    case other = "other"
    case system
  }

  enum SuggestionStyle: String, Codable, Hashable {
    case formal
    case casual
    case simple
  }

  enum ReviewScore: String, Codable, Hashable {
    case green
    case yellow
    case red
  }

  var sceneName: String
  var startedAt: Date
}
