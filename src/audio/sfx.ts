export interface SfxManagerOptions {
  createAudioContext?: () => AudioContext | null;
  destination?: AudioNode | null;
}

export interface SfxPlayOptions {
  loop?: boolean;
  playbackRate?: number;
}

export interface SfxManagerState {
  unlocked: boolean;
  muted: boolean;
  volume: number;
}

export interface SfxManager {
  unlock(): Promise<void>;
  loadSample(id: string, loader: () => Promise<ArrayBuffer>): Promise<AudioBuffer>;
  play(id: string, options?: SfxPlayOptions): Promise<boolean>;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  dispose(): Promise<void>;
  getState(): SfxManagerState;
}

const DEFAULT_VOLUME = 1;

function defaultCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const ctor: typeof AudioContext | undefined =
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? window.AudioContext;

  if (!ctor) {
    return null;
  }

  try {
    return new ctor();
  } catch (error) {
    console.warn('Failed to construct AudioContext', error);
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createSfxManager(options: SfxManagerOptions = {}): SfxManager {
  const createAudioContext = options.createAudioContext ?? defaultCreateAudioContext;
  const buffers = new Map<string, AudioBuffer>();
  const pendingLoads = new Map<string, Promise<AudioBuffer>>();

  let context: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let unlocked = false;
  let muted = false;
  let volume = DEFAULT_VOLUME;
  let disposed = false;
  let resumePromise: Promise<void> | null = null;

  function ensureContext(): AudioContext | null {
    if (disposed) {
      return null;
    }

    if (context) {
      return context;
    }

    context = createAudioContext();
    if (!context) {
      return null;
    }

    gainNode = context.createGain();
    gainNode.gain.value = muted ? 0 : volume;
    const destination = options.destination ?? context.destination;
    try {
      gainNode.connect(destination);
    } catch (error) {
      console.warn('Failed to connect audio gain node', error);
    }

    return context;
  }

  async function unlock(): Promise<void> {
    if (disposed) {
      return;
    }

    const ctx = ensureContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === 'running') {
      unlocked = true;
      return;
    }

    if (!resumePromise) {
      resumePromise = ctx.resume().then(
        () => {
          unlocked = ctx.state === 'running';
        },
        (error) => {
          console.warn('Failed to resume AudioContext', error);
        },
      ).finally(() => {
        resumePromise = null;
      });
    }

    await resumePromise;
  }

  async function loadSample(id: string, loader: () => Promise<ArrayBuffer>): Promise<AudioBuffer> {
    if (disposed) {
      throw new Error('SfxManager has been disposed');
    }

    if (buffers.has(id)) {
      return buffers.get(id)!;
    }

    if (pendingLoads.has(id)) {
      return pendingLoads.get(id)!;
    }

    const ctx = ensureContext();
    if (!ctx) {
      throw new Error('AudioContext unavailable');
    }

    const pending = loader()
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(id, buffer);
        pendingLoads.delete(id);
        return buffer;
      })
      .catch((error) => {
        pendingLoads.delete(id);
        throw error;
      });

    pendingLoads.set(id, pending);
    return pending;
  }

  function updateGainNode() {
    if (!gainNode) {
      return;
    }
    gainNode.gain.value = muted ? 0 : volume;
  }

  function setVolume(value: number) {
    volume = clamp(value, 0, 1);
    updateGainNode();
  }

  function setMuted(value: boolean) {
    muted = Boolean(value);
    updateGainNode();
  }

  async function play(id: string, options?: SfxPlayOptions): Promise<boolean> {
    if (disposed) {
      return false;
    }

    if (pendingLoads.has(id)) {
      try {
        await pendingLoads.get(id);
      } catch {
        return false;
      }
    }

    const ctx = ensureContext();
    const buffer = buffers.get(id);
    if (!ctx || !buffer || muted || !unlocked) {
      return false;
    }

    const gain = gainNode ?? ctx.destination;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (options?.loop) {
      source.loop = true;
    }
    if (options?.playbackRate) {
      source.playbackRate.value = clamp(options.playbackRate, 0.25, 4);
    }

    try {
      source.connect(gain);
      source.start();
      return true;
    } catch (error) {
      console.warn('Failed to play sound effect', error);
      return false;
    }
  }

  async function dispose(): Promise<void> {
    if (disposed) {
      return;
    }
    disposed = true;
    unlocked = false;
    pendingLoads.clear();
    buffers.clear();

    const ctx = context;
    const gain = gainNode;
    context = null;
    gainNode = null;

    if (gain) {
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    }

    if (ctx) {
      try {
        await ctx.close();
      } catch (error) {
        console.warn('Failed to close AudioContext', error);
      }
    }
  }

  function getState(): SfxManagerState {
    return {
      unlocked,
      muted,
      volume,
    };
  }

  return {
    unlock,
    loadSample,
    play,
    setVolume,
    setMuted,
    dispose,
    getState,
  };
}
