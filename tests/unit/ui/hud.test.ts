import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHud, type HudInstance } from '../../../src/ui/hud';
import { createEmptyBoard } from '../../../src/core/board';
import type { GameSessionState } from '../../../src/core/game-loop';
import type { TetrominoType } from '../../../src/core/rng';

describe('ui/hud', () => {
  let mount: HTMLElement;
  let hud: HudInstance;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
    hud = createHud({ mount });
  });

  afterEach(() => {
    hud.destroy();
    document.body.innerHTML = '';
  });

  function createState(overrides: Partial<GameSessionState> = {}): GameSessionState {
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
        level: 0,
        lines: 0,
        dropDistanceSoft: 0,
        dropDistanceHard: 0,
      },
      speed: {
        gravityMs: 1000,
        lockDelayMs: 500,
      },
      lock: {
        isLocking: false,
        elapsedMs: 0,
        frames: 0,
      },
      phase: 'ready',
      ghost: null,
      seed: 'seed',
      ...overrides,
    };
  }

  it('renders initial stats, empty hold, and upcoming queue', () => {
    hud.update(createState());

    const scoreValue = mount.querySelector('[data-testid="score-value"]');
    expect(scoreValue?.textContent).toBe('0');

    const bestValue = mount.querySelector('[data-testid="best-value"]');
    expect(bestValue?.textContent).toBe('0');

    const levelValue = mount.querySelector('[data-testid="level-value"]');
    expect(levelValue?.textContent).toBe('0');

    const linesValue = mount.querySelector('[data-testid="lines-value"]');
    expect(linesValue?.textContent).toBe('0');

    const seedValue = mount.querySelector('[data-testid="seed-value"]');
    expect(seedValue?.textContent).toBe('seed');

    const statusValue = mount.querySelector('[data-testid="status-value"]');
    expect(statusValue?.textContent).toBe('Ready');

    const holdPreview = mount.querySelector('[data-testid="hold-preview"]');
    expect(holdPreview?.getAttribute('data-piece')).toBe('none');

    const filledCells = mount.querySelectorAll('[data-role="hold-cell"][data-piece="none"]');
    expect(filledCells.length).toBe(16);

    const queueSlots = mount.querySelectorAll('[data-testid="next-slot"]');
    expect(queueSlots.length).toBe(3);
    const queuePieces = Array.from(queueSlots, (slot) => slot.getAttribute('data-piece'));
    expect(queuePieces).toEqual(['I', 'O', 'T']);
    Array.from(queueSlots).forEach((slot, index) => {
      const slotCells = slot.querySelectorAll('[data-role="next-cell"]');
      expect(slotCells.length).toBe(16);
      const piece = queuePieces[index];
      if (!piece || piece === 'none') {
        throw new Error('Expected queue slot to contain a piece');
      }
      const filledCells = slot.querySelectorAll(`[data-role="next-cell"][data-piece="${piece}"]`);
      expect(filledCells.length).toBeGreaterThan(0);
    });
  });

  it('shows held piece preview when hold is populated', () => {
    hud.update(createState({ hold: 'T' }));

    const holdPreview = mount.querySelector('[data-testid="hold-preview"]');
    expect(holdPreview?.getAttribute('data-piece')).toBe('T');

    const pieceCells = mount.querySelectorAll('[data-role="hold-cell"][data-piece="T"]');
    expect(pieceCells.length).toBe(4);
  });

  it('marks hold as unavailable after use and updates stats + live region', () => {
    hud.update(createState({
      stats: {
        score: 1234,
        level: 2,
        lines: 8,
        dropDistanceSoft: 0,
        dropDistanceHard: 0,
      },
      hold: 'I',
      holdUsedThisTurn: true,
      phase: 'playing',
      nextQueue: ['Z', 'L', 'O'],
    }), { bestScore: 4321 });

    const scoreValue = mount.querySelector('[data-testid="score-value"]');
    expect(scoreValue?.textContent).toBe('1234');

    const levelValue = mount.querySelector('[data-testid="level-value"]');
    expect(levelValue?.textContent).toBe('2');

    const bestValue = mount.querySelector('[data-testid="best-value"]');
    expect(bestValue?.textContent).toBe('4321');

    const linesValue = mount.querySelector('[data-testid="lines-value"]');
    expect(linesValue?.textContent).toBe('8');

    const statusValue = mount.querySelector('[data-testid="status-value"]');
    expect(statusValue?.textContent).toBe('Playing');

    const holdPreview = mount.querySelector('[data-testid="hold-preview"]');
    expect(holdPreview?.getAttribute('data-piece')).toBe('I');
    expect(holdPreview?.getAttribute('data-used')).toBe('true');
    expect(holdPreview?.getAttribute('aria-disabled')).toBe('true');

    const pieceCells = mount.querySelectorAll('[data-role="hold-cell"][data-piece="I"]');
    expect(pieceCells.length).toBe(4);

    const queueSlots = mount.querySelectorAll('[data-testid="next-slot"]');
    expect(queueSlots.length).toBe(3);
    expect(queueSlots[0]?.getAttribute('data-piece')).toBe('Z');
    expect(queueSlots[1]?.getAttribute('data-piece')).toBe('L');
    expect(queueSlots[2]?.getAttribute('data-piece')).toBe('O');

    const liveRegion = mount.querySelector('[data-testid="hud-live"]');
    expect(liveRegion?.textContent).toContain('Score 1234');
    expect(liveRegion?.textContent).toContain('Level 2');
    expect(liveRegion?.textContent).toContain('Lines 8');
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  it('retains previous best score when subsequent updates omit the value', () => {
    hud.update(createState({
      stats: {
        score: 2000,
        level: 3,
        lines: 12,
        dropDistanceSoft: 0,
        dropDistanceHard: 0,
      },
      phase: 'playing',
    }), { bestScore: 5000 });

    hud.update(createState({
      stats: {
        score: 400,
        level: 1,
        lines: 2,
        dropDistanceSoft: 0,
        dropDistanceHard: 0,
      },
      phase: 'playing',
    }));

    const bestValue = mount.querySelector('[data-testid="best-value"]');
    expect(bestValue?.textContent).toBe('5000');
  });
});
