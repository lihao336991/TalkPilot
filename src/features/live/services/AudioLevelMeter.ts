function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class AudioLevelMeter {
  private smoothedLevel = 0;

  ingest(base64Chunk: string): number {
    const bytes = decodeBase64ToBytes(base64Chunk);
    if (bytes.length < 2) {
      this.smoothedLevel = 0;
      return this.smoothedLevel;
    }

    let sumSquares = 0;
    let peak = 0;
    let sampleCount = 0;

    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const sampleInt16 = (bytes[i] | (bytes[i + 1] << 8)) << 16 >> 16;
      const sample = sampleInt16 / 32768;
      const abs = Math.abs(sample);
      sumSquares += sample * sample;
      if (abs > peak) {
        peak = abs;
      }
      sampleCount += 1;
    }

    if (sampleCount === 0) {
      this.smoothedLevel = 0;
      return this.smoothedLevel;
    }

    const rms = Math.sqrt(sumSquares / sampleCount);
    const gatedRms = clamp((rms - 0.008) / 0.11, 0, 1);
    const gatedPeak = clamp((peak - 0.02) / 0.28, 0, 1);
    const rawLevel = Math.pow(gatedRms * 0.64 + gatedPeak * 0.36, 0.58);
    const attack = rawLevel > this.smoothedLevel ? 0.78 : 0.24;
    this.smoothedLevel += (rawLevel - this.smoothedLevel) * attack;
    this.smoothedLevel = clamp(this.smoothedLevel, 0, 1);
    return this.smoothedLevel;
  }

  reset(): number {
    this.smoothedLevel = 0;
    return this.smoothedLevel;
  }
}
