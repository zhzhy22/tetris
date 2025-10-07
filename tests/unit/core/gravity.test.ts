import { describe, expect, it } from 'vitest';
import {
  createGravityState,
  stepGravity,
  type GravityConfig,
  type GravityState,
} from '../../../src/core/gravity';

const CONFIG: GravityConfig = {
  gravityMs: 1000,
  lockDelayMs: 500,
  lockDelayFrames: 15,
};

function advance(
  state: GravityState,
  overrides: Partial<Parameters<typeof stepGravity>[2]> = {},
) {
  return stepGravity(state, CONFIG, {
    deltaMs: 0,
    frames: 1,
    grounded: false,
    resetLock: false,
    ...overrides,
  });
}

describe('gravity step', () => {
  it('drops the piece when accumulated delta meets gravity threshold', () => {
    let state = createGravityState(CONFIG);

    let result = advance(state, { deltaMs: 400 });
    expect(result.dropRows).toBe(0);
    expect(result.shouldLock).toBe(false);

    state = result.state;
    result = advance(state, { deltaMs: 700 });

    expect(result.dropRows).toBe(1);
    expect(result.shouldLock).toBe(false);
    expect(result.state.fallElapsedMs).toBe(100);
  });

  it('locks after accumulating 500ms while grounded without resets', () => {
    let state = createGravityState(CONFIG);

    let result = advance(state, { deltaMs: 200, grounded: true });
    expect(result.shouldLock).toBe(false);
    expect(result.state.isLocking).toBe(true);

    state = result.state;
    result = advance(state, { deltaMs: 200, grounded: true });
    expect(result.shouldLock).toBe(false);

    state = result.state;
    result = advance(state, { deltaMs: 100, grounded: true });
    expect(result.shouldLock).toBe(false);

    state = result.state;
    result = advance(state, { deltaMs: 100, grounded: true });
    expect(result.shouldLock).toBe(true);
  });

  it('resets lock delay when a reset action occurs while grounded', () => {
    let state = createGravityState(CONFIG);

    let result = advance(state, { deltaMs: 300, grounded: true });
    expect(result.state.lockElapsedMs).toBe(300);

    result = advance(result.state, { grounded: true, resetLock: true });
    expect(result.state.lockElapsedMs).toBe(0);
    expect(result.shouldLock).toBe(false);

    result = advance(result.state, { deltaMs: 400, grounded: true });
    expect(result.shouldLock).toBe(false);

    result = advance(result.state, { deltaMs: 120, grounded: true });
    expect(result.shouldLock).toBe(true);
  });

  it('locks after 15 grounded frames even if ms threshold not reached', () => {
    let state = createGravityState(CONFIG);
    let result = advance(state, { grounded: true, deltaMs: 10 });

    for (let i = 0; i < 13; i += 1) {
      result = advance(result.state, { grounded: true, deltaMs: 10 });
      expect(result.shouldLock).toBe(false);
    }

    result = advance(result.state, { grounded: true, deltaMs: 10 });
    expect(result.shouldLock).toBe(true);
    expect(result.state.lockElapsedMs).toBeLessThan(CONFIG.lockDelayMs);
  });
});
