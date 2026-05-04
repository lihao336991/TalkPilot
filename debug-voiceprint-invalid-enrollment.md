# Debug Session: voiceprint-invalid-enrollment
- **Status**: [OPEN]
- **Issue**: Re-enrollment completed, but live voiceprint similarity still does not appear and runtime repeatedly logs `Enrollment embedding is invalid.`
- **Debug Server**: Pending startup
- **Log File**: `.dbg/trae-debug-log-voiceprint-invalid-enrollment.ndjson`

## Reproduction Steps
1. Open the app and re-record voice enrollment.
2. Enter Live session and speak to trigger local voiceprint comparison.
3. Observe Debug Overlay and terminal warnings.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The newly saved enrollment profile still contains a non-192D embedding, so compare path rejects it immediately. | High | Low | Pending |
| B | `generateEmbedding()` succeeds in UI flow but returns malformed/empty data through the RN bridge, causing a bad profile to be persisted. | High | Medium | Pending |
| C | Live compare path receives a different shape/type than enrollment creation path because the native module or rebuilt app binary is out of sync. | Medium | Medium | Pending |
| D | Enrollment profile save/load roundtrip mutates the embedding structure or drops values before live comparison begins. | Medium | Low | Pending |

## Log Evidence
- Terminal warning after reproduction:
  - `VoiceprintService` compare path shows `enrollmentLength: 192`
  - `enrollmentPreview: [null, null, null, null]`
  - `windowBytes: 32000`
- Key implication:
  - The failure is **not** wrong embedding length.
  - The persisted enrollment embedding contains invalid numeric values.
  - In JS persistence, `NaN` serializes to `null`, which matches the observed preview.

## Verification Conclusion
- | ID | Hypothesis | Status | Evidence Summary |
- |----|------------|--------|------------------|
- | A | Newly saved enrollment profile has non-192D embedding | ❌ Rejected | Compare path reports `enrollmentLength: 192`. |
- | B | RN bridge/native enrollment generation produced malformed numeric values | ✅ Confirmed | `enrollmentPreview` is `[null, null, null, null]`, which strongly indicates non-finite values entered the profile before compare. |
- | C | App binary/native compare path out of sync | ⏳ Inconclusive | No direct mismatch evidence yet; compare path is receiving a 192-length array. |
- | D | Save/load roundtrip corrupted valid numbers | ⏳ Inconclusive | Save/load logs were not captured, but JSON persistence would convert `NaN` to `null`, so roundtrip is a likely amplifier rather than sole source. |

## Fix Attempt
- Added finite-number guards in `VoiceprintNative.ts` so malformed native embeddings fail fast before persistence.
- Added invalid-segment filtering and post-average finite validation in `VoiceprintService.ts`.
- Added finite-value validation in `VoiceEnrollmentService.ts` load path so corrupted profiles are rejected instead of being used for compare.
- Confirmed a second-stage regression after switching to `NeMoSpeaker`: project model asset is FP16, while library output parsing assumes Float32 reads from `MLMultiArray.dataPointer`.
- Reverted native bridge direction to manual CoreML inference in `VoiceprintModule.swift`, while reusing `NeMoFeatureExtractor` for mel feature extraction and adding FP16-safe output parsing.
- Bumped `VOICEPRINT_MODEL` to `titanet-small-f16-coreml-v2` to force re-enrollment against the restored bridge.
