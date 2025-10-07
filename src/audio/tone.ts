export interface ToneGenerationOptions {
  durationMs: number;
  frequency: number;
  frequencyEnd?: number;
  volume?: number;
  sampleRate?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  harmonics?: Array<{ multiplier: number; amplitude: number }>;
}

const HEADER_SIZE = 44;
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_VOLUME = 0.6;
const DEFAULT_FADE_IN_MS = 5;
const DEFAULT_FADE_OUT_MS = 40;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

/**
 * Generates a mono 16-bit PCM WAV tone and returns the underlying ArrayBuffer.
 * The buffer can be passed directly to `AudioContext.decodeAudioData`.
 */
export function generateToneWave(options: ToneGenerationOptions): ArrayBuffer {
  const sampleRate = clamp(options.sampleRate ?? DEFAULT_SAMPLE_RATE, 8_000, 96_000);
  const volume = clamp(options.volume ?? DEFAULT_VOLUME, 0, 1);
  const durationMs = clamp(options.durationMs, 10, 5_000);
  const totalSamples = Math.max(1, Math.floor((durationMs / 1000) * sampleRate));
  const fadeInSamples = Math.min(
    totalSamples,
    Math.floor((clamp(options.fadeInMs ?? DEFAULT_FADE_IN_MS, 0, durationMs) / 1000) * sampleRate),
  );
  const fadeOutSamples = Math.min(
    totalSamples,
    Math.floor((clamp(options.fadeOutMs ?? DEFAULT_FADE_OUT_MS, 0, durationMs) / 1000) * sampleRate),
  );

  const dataSize = totalSamples * 2; // int16 mono
  const buffer = new ArrayBuffer(HEADER_SIZE + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  const byteRate = sampleRate * 2; // sampleRate * numChannels * bitsPerSample/8
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true); // block align (numChannels * bitsPerSample/8)
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const harmonics = options.harmonics?.length
    ? options.harmonics.map((harmonic) => ({
        multiplier: clamp(harmonic.multiplier, 0.5, 8),
        amplitude: clamp(Math.abs(harmonic.amplitude), 0, 4),
      }))
    : [
        { multiplier: 1, amplitude: 1 },
        { multiplier: 2, amplitude: 0.35 },
      ];
  const amplitudeTotal = harmonics.reduce((sum, harmonic) => sum + harmonic.amplitude, 0) || 1;

  const frequencyStart = clamp(options.frequency, 40, 8_000);
  const frequencyEnd = options.frequencyEnd
    ? clamp(options.frequencyEnd, 40, 8_000)
    : frequencyStart;

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const progress = sampleIndex / totalSamples;
    const frequency = frequencyStart + (frequencyEnd - frequencyStart) * progress;

    let sampleValue = 0;
    for (const harmonic of harmonics) {
      const phase = 2 * Math.PI * frequency * harmonic.multiplier * time;
      sampleValue += Math.sin(phase) * harmonic.amplitude;
    }
    sampleValue /= amplitudeTotal;

    let envelope = 1;
    if (fadeInSamples > 0 && sampleIndex < fadeInSamples) {
      envelope *= sampleIndex / fadeInSamples;
    }
    if (fadeOutSamples > 0 && sampleIndex >= totalSamples - fadeOutSamples) {
      envelope *= (totalSamples - sampleIndex) / fadeOutSamples;
    }

    const value = clamp(sampleValue * envelope * volume, -1, 1);
    const intSample = Math.round(value * 0x7fff);
    view.setInt16(HEADER_SIZE + sampleIndex * 2, intSample, true);
  }

  return buffer;
}
