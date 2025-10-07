export interface GravityConfig {
  gravityMs: number;
  lockDelayMs: number;
  lockDelayFrames: number;
}

export interface GravityState {
  fallElapsedMs: number;
  lockElapsedMs: number;
  lockFrames: number;
  isLocking: boolean;
}

export interface GravityContext {
  deltaMs: number;
  frames: number;
  grounded: boolean;
  resetLock: boolean;
}

export interface GravityStepResult {
  state: GravityState;
  dropRows: number;
  shouldLock: boolean;
  lockReset: boolean;
}

export function createGravityState(): GravityState {
  return {
    fallElapsedMs: 0,
    lockElapsedMs: 0,
    lockFrames: 0,
    isLocking: false,
  };
}

export function stepGravity(
  state: GravityState,
  config: GravityConfig,
  context: GravityContext,
): GravityStepResult {
  let fallElapsedMs = state.fallElapsedMs;
  let lockElapsedMs = state.lockElapsedMs;
  let lockFrames = state.lockFrames;
  let isLocking = state.isLocking;
  let lockReset = false;

  let dropRows = 0;

  if (context.grounded) {
    if (!isLocking) {
      isLocking = true;
    }

    if (context.resetLock) {
      lockElapsedMs = 0;
      lockFrames = 0;
      lockReset = true;
    } else {
      lockElapsedMs += context.deltaMs;
      lockFrames += context.frames;
    }

    fallElapsedMs = 0;
  } else {
    if (isLocking) {
      lockElapsedMs = 0;
      lockFrames = 0;
      isLocking = false;
    }

    const totalFall = fallElapsedMs + context.deltaMs;
    if (config.gravityMs > 0) {
      dropRows = Math.floor(totalFall / config.gravityMs);
      fallElapsedMs = totalFall - dropRows * config.gravityMs;
    } else {
      fallElapsedMs = 0;
      dropRows = 0;
    }
  }

  const timeReached = lockElapsedMs > config.lockDelayMs;
  const framesReached = lockFrames >= config.lockDelayFrames;

  const shouldLock = context.grounded && (timeReached || framesReached);

  const nextState: GravityState = {
    fallElapsedMs,
    lockElapsedMs,
    lockFrames,
    isLocking,
  };

  return {
    state: nextState,
    dropRows,
    shouldLock,
    lockReset,
  };
}
