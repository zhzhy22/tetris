import { describe, expect, it } from 'vitest';
import { createDebugOverlay } from '../../../src/ui/debug-overlay';
import type { GameSessionState } from '../../../src/core/game-loop';
import { createEmptyBoard } from '../../../src/core/board';
import type { TetrominoType } from '../../../src/core/rng';

function createState(): GameSessionState {
  const board = createEmptyBoard();
  return {
    board,
    active: null,
    hold: null,
    holdUsedThisTurn: false,
    nextQueue: ['I', 'O', 'T'] as TetrominoType[],
    rng: { seed: 'seed', bag: [], history: [] },
    stats: {
      score: 0,
      level: 3,
      lines: 12,
      dropDistanceSoft: 0,
      dropDistanceHard: 0,
    },
    speed: {
      gravityMs: 950,
      lockDelayMs: 500,
    },
    lock: {
      isLocking: false,
      elapsedMs: 0,
      frames: 0,
    },
    phase: 'playing',
    ghost: null,
    seed: 'seed',
  };
}

describe('ui/debug-overlay', () => {
  it('records frames and computes rolling fps', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const overlay = createDebugOverlay({ mount, sampleSize: 5 });

    overlay.setVisible(true);

    overlay.recordFrame(16);
    overlay.recordFrame(18);
    overlay.recordFrame(0);

    const fpsValue = mount.querySelector('[data-testid="debug-overlay-fps"]');
    const frameValue = mount.querySelector('[data-testid="debug-overlay-frame"]');

    expect(fpsValue?.textContent).toBe('58.8');
    expect(frameValue?.textContent).toBe('0.00');

    overlay.recordFrame(20);

    expect(fpsValue?.textContent).toBe('55.6');
    expect(frameValue?.textContent).toBe('20.00');

    overlay.destroy();
    document.body.removeChild(mount);
  });

  it('updates visibility and game state metrics', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const overlay = createDebugOverlay({ mount });

    overlay.setVisible(true);

    const state = createState();
    overlay.update(state);

    const gravityValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-gravity"]');
    const phaseValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-phase"]');
    const levelValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-level"]');
    const lockValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-lock"]');

    expect(gravityValue?.textContent).toBe('950 ms');
    expect(phaseValue?.textContent).toBe('playing');
    expect(levelValue?.textContent).toBe('3');
    expect(lockValue?.textContent).toBe('Idle');

    const root = mount.querySelector<HTMLElement>('[data-testid="debug-overlay"]');
    expect(root?.getAttribute('data-visible')).toBe('true');
    expect(root?.hidden).toBe(false);

    state.lock.isLocking = true;
    state.lock.elapsedMs = 120;
    state.lock.frames = 4;
    overlay.update(state);

    expect(lockValue?.textContent).toBe('Locking 120 / 500 ms (4 frames)');

    overlay.setVisible(false);
    expect(mount.querySelector('[data-testid="debug-overlay"]')).toBeNull();
    expect(root?.getAttribute('data-visible')).toBe('false');
    expect(root?.hidden).toBe(true);

    overlay.destroy();
    expect(mount.querySelector('[data-testid="debug-overlay"]')).toBeNull();
    document.body.removeChild(mount);
  });
});
