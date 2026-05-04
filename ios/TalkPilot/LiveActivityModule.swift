import Foundation
import React

@objc(LiveActivityModule)
final class LiveActivityModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(sync:resolver:rejecter:)
  func sync(
    _ payloadJSON: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    Task { @MainActor in
      do {
        try await LiveActivityManager.shared.sync(payloadJSON: payloadJSON)
        resolve(true)
      } catch {
        reject("LIVE_ACTIVITY_SYNC_FAILED", error.localizedDescription, error)
      }
    }
  }

  @objc(end:rejecter:)
  func end(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    Task { @MainActor in
      await LiveActivityManager.shared.end()
      resolve(true)
    }
  }
}
