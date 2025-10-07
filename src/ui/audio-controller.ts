import { generateToneWave, type ToneGenerationOptions } from '../audio/tone';

import type { SfxManager } from '../audio/sfx';
import type { ControlInput, GameSessionState } from '../core/game-loop';

export type SfxId = 'hard-drop' | 'line-clear' | 'game-over';

interface AudioControllerOptions {
  sfxManager: SfxManager;
  logger?: Pick<Console, 'warn'>;
}

export interface AudioController {
  preload(): Promise<void>;
  handleInput(input: ControlInput): void;
  handleStateChange(previous: GameSessionState | null, next: GameSessionState): void;
  destroy(): void;
}

const SAMPLE_DEFINITIONS: Record<SfxId, ToneGenerationOptions> = {
  'hard-drop': {
    durationMs: 140,
    frequency: 180,
    frequencyEnd: 260,
    volume: 0.65,
    fadeOutMs: 60,
    harmonics: [
      { multiplier: 1, amplitude: 1 },
      { multiplier: 2, amplitude: 0.3 },
      { multiplier: 3, amplitude: 0.15 },
    ],
  },
  'line-clear': {
    durationMs: 220,
    frequency: 420,
    frequencyEnd: 660,
    volume: 0.6,
    fadeOutMs: 80,
    harmonics: [
      { multiplier: 1, amplitude: 1 },
      { multiplier: 2, amplitude: 0.4 },
      { multiplier: 4, amplitude: 0.2 },
    ],
  },
  'game-over': {
    durationMs: 400,
    frequency: 320,
    frequencyEnd: 150,
    volume: 0.55,
    fadeOutMs: 120,
    harmonics: [
      { multiplier: 1, amplitude: 1 },
      { multiplier: 0.5, amplitude: 0.4 },
    ],
  },
};

function cloneBuffer(buffer: ArrayBuffer): ArrayBuffer {
  return buffer.slice(0);
}

export function createAudioController(options: AudioControllerOptions): AudioController {
  const { sfxManager, logger } = options;
  let disposed = false;
  const toneCache = new Map<SfxId, ArrayBuffer>();
  const loadCache = new Map<SfxId, Promise<void>>();

  function ensureTone(id: SfxId): ArrayBuffer {
    let tone = toneCache.get(id);
    if (!tone) {
      const definition = SAMPLE_DEFINITIONS[id];
      tone = generateToneWave(definition);
      toneCache.set(id, tone);
    }
    return tone;
  }

  async function loadSample(id: SfxId): Promise<void> {
    if (loadCache.has(id)) {
      await loadCache.get(id);
      return;
    }
    const promise = sfxManager
      .loadSample(id, () => Promise.resolve(cloneBuffer(ensureTone(id))))
      .catch((error) => {
        if (logger) {
          logger.warn(`Failed to load sound sample: ${id}`);
        } else if (typeof console !== 'undefined') {
          console.warn(`Failed to load sound sample: ${id}`, error);
        }
        loadCache.delete(id);
        throw error;
      })
      .then(() => undefined);

    loadCache.set(id, promise);
    await promise;
  }

  async function preload(): Promise<void> {
    const entries = Object.keys(SAMPLE_DEFINITIONS) as SfxId[];
    await Promise.allSettled(entries.map((id) => loadSample(id)));
  }

  function play(id: SfxId, options?: Parameters<SfxManager['play']>[1]) {
    if (disposed) {
      return;
    }
    void sfxManager.play(id, options);
  }

  function handleInput(input: ControlInput) {
    if (disposed) {
      return;
    }
    if (input.type === 'hardDrop') {
      play('hard-drop');
    }
  }

  function handleStateChange(previous: GameSessionState | null, next: GameSessionState) {
    if (disposed || !previous) {
      return;
    }

    const clearedLines = next.stats.lines - previous.stats.lines;
    if (clearedLines > 0) {
      const playbackRate = Math.min(2.5, 1 + (clearedLines - 1) * 0.25);
      play('line-clear', { playbackRate });
    }

    if (previous.phase !== 'gameOver' && next.phase === 'gameOver') {
      play('game-over');
    }
  }

  function destroy() {
    disposed = true;
    toneCache.clear();
    loadCache.clear();
  }

  return {
    preload,
    handleInput,
    handleStateChange,
    destroy,
  };
}
