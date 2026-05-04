import CoreML
import Foundation
import NeMoFeatureExtractor
import React

private enum VoiceprintError: LocalizedError {
  case invalidBase64
  case emptyAudio
  case invalidEnrollmentEmbedding
  case invalidGeneratedEmbedding
  case invalidModelOutput
  case modelNotFound

  var errorDescription: String? {
    switch self {
    case .invalidBase64:
      return "Invalid PCM base64 payload."
    case .emptyAudio:
      return "Audio payload is empty or too short."
    case .invalidEnrollmentEmbedding:
      return "Enrollment embedding is invalid."
    case .invalidGeneratedEmbedding:
      return "Generated embedding contains invalid values."
    case .invalidModelOutput:
      return "Model output is invalid."
    case .modelNotFound:
      return "TitaNetSmall.mlmodelc not found in app bundle."
    }
  }
}

private struct TitaNetDurationPreset {
  let sampleCount: Int
  let melFrameCount: Int
  let durationMs: Int
}

@objc(VoiceprintModule)
final class VoiceprintModule: NSObject {
  private static let embeddingDimension = 192
  private static let modelName = "TitaNetSmall"
  private let featureExtractor = NeMoFeatureExtractor(config: .nemoSpeaker)
  private var cachedModel: MLModel?
  private let presets = [
    TitaNetDurationPreset(sampleCount: 16_000, melFrameCount: 112, durationMs: 1_000),
    TitaNetDurationPreset(sampleCount: 48_000, melFrameCount: 304, durationMs: 3_000),
    TitaNetDurationPreset(sampleCount: 80_000, melFrameCount: 512, durationMs: 5_000),
    TitaNetDurationPreset(sampleCount: 160_000, melFrameCount: 1008, durationMs: 10_000),
  ]

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      _ = try loadModel()
      resolve(true)
    } catch {
      NSLog("[VoiceprintModule] Voiceprint unavailable: \(error.localizedDescription)")
      resolve(false)
    }
  }

  @objc(generateEmbedding:resolver:rejecter:)
  func generateEmbedding(
    _ base64Pcm: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      let analysis = try analyze(base64Pcm)
      resolve(analysis.embedding.map { NSNumber(value: $0) })
    } catch {
      reject("VOICEPRINT_EMBEDDING_FAILED", error.localizedDescription, error)
    }
  }

  @objc(compareEmbedding:enrollmentEmbedding:resolver:rejecter:)
  func compareEmbedding(
    _ base64Pcm: String,
    enrollmentEmbedding: [NSNumber],
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      let analysis = try analyze(base64Pcm)
      let enrollment = enrollmentEmbedding.map(\.floatValue)
      guard
        enrollment.count == Self.embeddingDimension,
        containsOnlyFiniteValues(enrollment)
      else {
        throw VoiceprintError.invalidEnrollmentEmbedding
      }
      let similarity = cosineSimilarity(normalizeVector(enrollment), analysis.embedding)
      resolve([
        "similarity": similarity,
        "embedding": analysis.embedding.map { NSNumber(value: $0) },
        "inputDurationMs": analysis.preset.durationMs,
        "melFrameCount": analysis.preset.melFrameCount,
        "modelName": "\(Self.modelName) manual-coreml-bridge",
      ])
    } catch {
      reject("VOICEPRINT_COMPARE_FAILED", error.localizedDescription, error)
    }
  }

  private func analyze(_ base64Pcm: String) throws -> (
    embedding: [Float],
    preset: TitaNetDurationPreset
  ) {
    let model = try loadModel()
    let rawSamples = try decodePcmSamples(base64Pcm)
    let preset = selectPreset(for: rawSamples.count)
    guard rawSamples.count >= 16_000 else {
      throw VoiceprintError.emptyAudio
    }
    let samples = alignSamples(normalizeSamples(rawSamples), targetCount: preset.sampleCount)
    let melArray = try featureExtractor.processToMLMultiArray(samples: samples)
    guard melArray.shape[2].intValue == preset.melFrameCount else {
      throw VoiceprintError.invalidModelOutput
    }

    let input = try MLDictionaryFeatureProvider(dictionary: [
      "mel_features": MLFeatureValue(multiArray: melArray)
    ])
    let prediction = try model.prediction(from: input)
    guard
      let outputValue = prediction.featureValue(for: "embeddings"),
      let outputArray = outputValue.multiArrayValue
    else {
      throw VoiceprintError.invalidModelOutput
    }
    let embedding = try extractEmbedding(from: outputArray)
    guard containsOnlyFiniteValues(embedding) else {
      throw VoiceprintError.invalidGeneratedEmbedding
    }
    return (embedding, preset)
  }

  private func loadModel() throws -> MLModel {
    if let cachedModel {
      return cachedModel
    }
    guard let url = Bundle.main.url(forResource: Self.modelName, withExtension: "mlmodelc")
      ?? Bundle.main.url(forResource: Self.modelName, withExtension: "mlmodelc", subdirectory: "Models")
    else {
      throw VoiceprintError.modelNotFound
    }
    let configuration = MLModelConfiguration()
    configuration.computeUnits = .all
    let model = try MLModel(contentsOf: url, configuration: configuration)
    cachedModel = model
    NSLog("[VoiceprintModule] Loaded \(Self.modelName) manual CoreML bridge from \(url.lastPathComponent)")
    return model
  }

  private func selectPreset(for sampleCount: Int) -> TitaNetDurationPreset {
    if sampleCount <= 24_000 {
      return presets[0]
    }
    if sampleCount <= 64_000 {
      return presets[1]
    }
    if sampleCount <= 112_000 {
      return presets[2]
    }
    return presets[3]
  }

  private func decodePcmSamples(_ base64Pcm: String) throws -> [Float] {
    guard let data = Data(base64Encoded: base64Pcm) else {
      throw VoiceprintError.invalidBase64
    }

    let sampleCount = data.count / MemoryLayout<Int16>.size
    guard sampleCount > 0 else {
      throw VoiceprintError.emptyAudio
    }

    var samples = [Float]()
    samples.reserveCapacity(sampleCount)
    data.withUnsafeBytes { rawBuffer in
      let buffer = rawBuffer.bindMemory(to: Int16.self)
      for sample in buffer {
        let value = Int16(littleEndian: sample)
        samples.append(Float(value) / Float(Int16.max))
      }
    }
    return samples
  }

  private func normalizeSamples(_ samples: [Float]) -> [Float] {
    guard !samples.isEmpty else { return samples }
    let mean = samples.reduce(0, +) / Float(samples.count)
    let centered = samples.map { $0 - mean }
    let peak = centered.reduce(Float.zero) { max($0, abs($1)) }
    guard peak > 1e-6 else { return centered }
    let scale = min(0.95 / peak, 10.0)
    return centered.map { $0 * scale }
  }

  private func alignSamples(_ samples: [Float], targetCount: Int) -> [Float] {
    if samples.count == targetCount {
      return samples
    }
    if samples.count > targetCount {
      let start = (samples.count - targetCount) / 2
      return Array(samples[start..<(start + targetCount)])
    }
    let padBefore = (targetCount - samples.count) / 2
    let padAfter = targetCount - samples.count - padBefore
    return [Float](repeating: 0, count: padBefore) + samples + [Float](repeating: 0, count: padAfter)
  }

  private func extractEmbedding(from array: MLMultiArray) throws -> [Float] {
    let values: [Float]
    switch array.dataType {
    case .float16:
      let buffer = array.dataPointer.bindMemory(to: Float16.self, capacity: array.count)
      values = (0..<array.count).map { Float(buffer[$0]) }
    case .float32:
      let buffer = array.dataPointer.bindMemory(to: Float.self, capacity: array.count)
      values = (0..<array.count).map { buffer[$0] }
    case .double:
      let buffer = array.dataPointer.bindMemory(to: Double.self, capacity: array.count)
      values = (0..<array.count).map { Float(buffer[$0]) }
    default:
      throw VoiceprintError.invalidModelOutput
    }

    guard values.count >= Self.embeddingDimension else {
      throw VoiceprintError.invalidModelOutput
    }
    return normalizeVector(Array(values.prefix(Self.embeddingDimension)))
  }

  private func normalizeVector(_ values: [Float]) -> [Float] {
    let norm = sqrt(values.reduce(Float.zero) { $0 + ($1 * $1) })
    guard norm > 1e-6 else { return values }
    return values.map { $0 / norm }
  }

  private func cosineSimilarity(_ lhs: [Float], _ rhs: [Float]) -> Float {
    zip(lhs, rhs).reduce(Float.zero) { $0 + ($1.0 * $1.1) }
  }

  private func containsOnlyFiniteValues(_ values: [Float]) -> Bool {
    values.allSatisfy { $0.isFinite }
  }
}
