import AVFoundation
import Foundation
import React

@objc(VoiceChatModule)
final class VoiceChatModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc(enableVoiceChat:rejecter:)
  func enableVoiceChat(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
      try session.setActive(true)
      resolve(nil)
    } catch {
      reject("VOICECHAT_ENABLE_FAILED", error.localizedDescription, error)
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
