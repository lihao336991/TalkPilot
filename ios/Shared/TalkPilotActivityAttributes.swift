import ActivityKit
import Foundation

struct TalkPilotActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var sessionStatus: SessionStatus
    var latestSpeaker: MessageSpeaker
    var latestMessage: String
    var latestMessageAt: Date?
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

  var sceneName: String
  var startedAt: Date
}
