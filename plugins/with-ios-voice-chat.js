const { IOSConfig, createRunOncePlugin } = require('@expo/config-plugins');

const SWIFT_SOURCE = `import AVFoundation
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
`;

const BRIDGE_SOURCE = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VoiceChatModule, NSObject)

RCT_EXTERN_METHOD(enableVoiceChat:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setRecordingMode:(NSString *)mode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(disableVoiceChat:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
`;

const withIosVoiceChat = (config) => {
  config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: 'VoiceChatModule.swift',
    contents: SWIFT_SOURCE,
    overwrite: true,
  });

  config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: 'VoiceChatModuleBridge.m',
    contents: BRIDGE_SOURCE,
    overwrite: true,
  });

  return config;
};

module.exports = createRunOncePlugin(
  withIosVoiceChat,
  'with-ios-voice-chat',
  '1.0.1',
);
