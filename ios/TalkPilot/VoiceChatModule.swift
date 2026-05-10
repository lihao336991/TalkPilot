import AVFoundation
import Foundation
import React

@objc(VoiceChatModule)
final class VoiceChatModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  private func resolveMode(_ rawMode: String?) -> AVAudioSession.Mode {
    switch rawMode {
    case "measurement":
      return .measurement
    case "default":
      return .default
    case "voiceChat":
      return .voiceChat
    default:
      return .voiceChat
    }
  }

  private func applyRecordingMode(_ rawMode: String?) throws {
    let session = AVAudioSession.sharedInstance()
    let mode = resolveMode(rawMode)
    try session.setCategory(.playAndRecord, mode: mode, options: [.defaultToSpeaker, .allowBluetooth])
    try session.setActive(true)
  }

  @objc(enableVoiceChat:rejecter:)
  func enableVoiceChat(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      try applyRecordingMode("voiceChat")
      resolve(nil)
    } catch {
      reject("VOICECHAT_ENABLE_FAILED", error.localizedDescription, error)
    }
  }

  @objc(setRecordingMode:resolver:rejecter:)
  func setRecordingMode(
    _ mode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      try applyRecordingMode(mode)
      resolve(nil)
    } catch {
      reject("VOICECHAT_MODE_FAILED", error.localizedDescription, error)
    }
  }

  @objc(disableVoiceChat:rejecter:)
  func disableVoiceChat(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setMode(.default)
      try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
      try session.setActive(false, options: .notifyOthersOnDeactivation)
      resolve(nil)
    } catch {
      reject("VOICECHAT_DISABLE_FAILED", error.localizedDescription, error)
    }
  }
}
