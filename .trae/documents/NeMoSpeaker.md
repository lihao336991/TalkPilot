# NeMoSpeaker-iOS

Swift library for speaker embedding extraction using NVIDIA NeMo TitaNet-Small model converted to CoreML.

## Features

- Extract 192-dimensional speaker embeddings from audio
- Speaker verification (same/different speaker classification)
- Speaker profiles with embedding aggregation
- Optimized for iOS 16+ and macOS 13+
- Multiple model variants: FP32, FP16, Int8

## Requirements

- iOS 16.0+ / macOS 13.0+
- Swift 5.9+

## Installation

### Swift Package Manager

```swift
dependencies: [
    .package(url: "https://github.com/Otosaku/NeMoSpeaker-iOS.git", from: "1.1.0")
]
```

### Download Model

The library does not include the model - you need to download it separately and add to your app bundle.

**Download models:** [Google Drive](https://drive.google.com/file/d/1KJNjkAJUcniHI7YrCmwDEsMNJsFGje-V/view?usp=sharing)

| Model                      | Size   | Quality | Recommended for            |
| -------------------------- | ------ | ------- | -------------------------- |
| TitaNetSmall.mlmodelc      | ~27 MB | Best    | Development, high accuracy |
| TitaNetSmall_fp16.mlmodelc | ~14 MB | Great   | Production (recommended)   |
| TitaNetSmall_int8.mlmodelc | ~7 MB  | Good    | Size-constrained apps      |

1. Download and unzip the archive
2. Choose the model variant you need
3. Rename to `TitaNetSmall.mlmodelc` and add to your Xcode project
4. Ensure it's included in "Copy Bundle Resources" build phase

## Usage

### Extract Speaker Embedding

```swift
import NeMoSpeaker

// Get model URL from app bundle
guard let modelURL = Bundle.main.url(forResource: "TitaNetSmall", withExtension: "mlmodelc") else {
    fatalError("Model not found in bundle")
}

// Initialize with model path
let speaker = try NeMoSpeaker(modelURL: modelURL)

// Extract embedding from audio samples (mono, 16kHz, Float32)
let embedding = try speaker.extractEmbedding(samples: audioSamples)

// Embedding is 192-dimensional, L2-normalized
print("Embedding dimension: \(embedding.vector.count)") // 192
```

### Speaker Verification

```swift
// Compare two audio samples
let result = try speaker.verify(
    samples1: audioSamples1,
    samples2: audioSamples2,
    threshold: 0.5
)

print("Similarity: \(result.similarity)")      // -1.0 to 1.0
print("Same speaker: \(result.isSameSpeaker)") // true/false
```

### Compare Embeddings Directly

```swift
let embedding1 = try speaker.extractEmbedding(samples: samples1)
let embedding2 = try speaker.extractEmbedding(samples: samples2)

// Cosine similarity
let similarity = embedding1.cosineSimilarity(with: embedding2)

// Or use convenience method
let isSame = embedding1.isSameSpeaker(as: embedding2, threshold: 0.5)
```

### Speaker Profiles

```swift
// Create a speaker profile
var profile = SpeakerProfile(id: "user_1", embedding: embedding1)

// Add more samples to improve accuracy
profile.addEmbedding(embedding2)
profile.addEmbedding(embedding3)

print("Profile sample count: \(profile.sampleCount)")

// Verify against profile
let result = profile.verify(unknownEmbedding, threshold: 0.5)
```

### Explicit Duration

```swift
// Use specific input duration for better control
let embedding = try speaker.extractEmbedding(
    samples: audioSamples,
    duration: .threeSeconds  // 1s, 3s, 5s, or 10s
)
```

## Supported Input Durations

| Duration | Audio Samples | Mel Frames |
| -------- | ------------- | ---------- |
| 1 sec    | 16,000        | 112        |
| 3 sec    | 48,000        | 304        |
| 5 sec    | 80,000        | 512        |
| 10 sec   | 160,000       | 1,008      |

## Audio Requirements

- Sample rate: 16,000 Hz
- Channels: Mono
- Format: Float32

## Model Details

- **Model**: TitaNet-Small (NVIDIA NeMo)
- **Embedding dimension**: 192
- **Variants**: FP32 (~27 MB), FP16 (~14 MB), Int8 (~7 MB)
- **Original source**: [NVIDIA NeMo](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/models/titanet_small)

## Threshold Guidelines

| Threshold | Use Case                         |
| --------- | -------------------------------- |
| 0.4       | Lenient (fewer false rejections) |
| 0.5       | Balanced (default)               |
| 0.6       | Strict (fewer false accepts)     |
| 0.7+      | High security                    |

## Example Project

The `SpeakerExample` folder contains a demo iOS app with:

- Speaker enrollment
- Speaker verification
- Audio comparison
- Live diarization (real-time speaker detection)

To run the example:

1. Open `SpeakerExample/SpeakerExample.xcodeproj` in Xcode
2. Download model from [Google Drive](https://drive.google.com/file/d/1KJNjkAJUcniHI7YrCmwDEsMNJsFGje-V/view?usp=sharing)
3. Rename to `TitaNetSmall.mlmodelc` and drag into the Xcode project
4. Build and run on device or simulator

## Dependencies

- [NeMoFeatureExtractor-iOS](https://github.com/Otosaku/NeMoFeatureExtractor-iOS) (>= 1.0.5)

## License

MIT License
