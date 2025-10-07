import { describe, expect, it } from 'vitest';

import { DEFAULT_BOARD_ROWS } from '../../../src/core/board';
import {
  createGameLoop,
  type GameLoop,
  type GameSessionState,
} from '../../../src/core/game-loop';

const TEST_SEED = '0123456789abcdef';

function requireActive(state: GameSessionState) {
  if (!state.active) {
    throw new Error('Expected active piece to exist');
  }
  return state.active;
}

function tickUntilNewPiece(loop: GameLoop, initialType: string, maxIterations = 64) {
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    loop.tick(1000);
    const current = loop.getState().active;
    if (current && current.type !== initialType) {
      return current.type;
    }
  }
  throw new Error('Piece did not advance to the next queue item within expected ticks');
}

describe('core/game-loop', () => {
  it('starts and stops the game while notifying subscribers', () => {
    const loop = createGameLoop({ seed: TEST_SEED });
    const snapshots: GameSessionState[] = [];
    const unsubscribe = loop.subscribe((state) => {
      snapshots.push(state);
    });

    const ready = loop.getState();
    expect(ready.phase).toBe('ready');
    expect(ready.active).toBeNull();

    loop.start();

    const started = loop.getState();
    expect(started.phase).toBe('playing');
    expect(started.active).not.toBeNull();
    expect(started.ghost).not.toBeNull();
    expect(snapshots[snapshots.length - 1]?.phase).toBe('playing');

    unsubscribe();
    const snapshotCount = snapshots.length;
    loop.tick(1000);
    expect(snapshots.length).toBe(snapshotCount);

    loop.stop();
    const reset = loop.getState();
    expect(reset.phase).toBe('ready');
    expect(reset.active).toBeNull();
    expect(reset.hold).toBeNull();
  });

  it('processes movement, rotation, drops, hold, and pause/resume inputs', () => {
    const loop = createGameLoop({ seed: TEST_SEED });
    loop.start();

    const initialActive = requireActive(loop.getState());
    const initialColumn = initialActive.position.col;

    loop.applyInput({ type: 'move', direction: 'right', repeat: false });
    let state = loop.getState();
    expect(state.active?.position.col).toBe(initialColumn + 1);

    const beforeRotation = requireActive(state);
    loop.applyInput({ type: 'rotate', direction: 'cw' });
    state = loop.getState();
    const rotated = requireActive(state);
    if (beforeRotation.type === 'O') {
      expect(rotated.rotation).toBe(beforeRotation.rotation);
    } else {
      expect(rotated.rotation).toBe((beforeRotation.rotation + 1) % 4);
    }

    const softBefore = state.stats.dropDistanceSoft;
    loop.applyInput({ type: 'softDrop', repeat: false });
    state = loop.getState();
    expect(state.stats.dropDistanceSoft).toBeGreaterThan(softBefore);

    const scoreBeforeHard = state.stats.score;
    const typeBeforeHard = requireActive(state).type;
    loop.applyInput({ type: 'hardDrop' });
    state = loop.getState();
    expect(state.stats.score).toBeGreaterThan(scoreBeforeHard);
    expect(state.active).not.toBeNull();
    expect(state.active?.type).not.toBe(typeBeforeHard);

    const activeBeforeHold = requireActive(state);
    loop.applyInput({ type: 'hold' });
    state = loop.getState();
    expect(state.hold).toBe(activeBeforeHold.type);
    expect(state.holdUsedThisTurn).toBe(true);
    expect(state.active).not.toBeNull();
    expect(state.active?.type).not.toBe(activeBeforeHold.type);

    const pausedPosition = requireActive(state).position;
    loop.applyInput({ type: 'pause' });
    state = loop.getState();
    expect(state.phase).toBe('paused');

    loop.tick(1000);
    state = loop.getState();
    expect(requireActive(state).position).toEqual(pausedPosition);

    loop.applyInput({ type: 'resume' });
    state = loop.getState();
    expect(state.phase).toBe('playing');

    const rowBefore = requireActive(state).position.row;
    loop.tick(1000);
    state = loop.getState();
    expect(requireActive(state).position.row).toBeGreaterThanOrEqual(rowBefore);

    const targetPieceType = requireActive(state).type;
  let groundedState: GameSessionState | null = null;
  const maxGroundingChecks = DEFAULT_BOARD_ROWS * 12;
  for (let i = 0; i < maxGroundingChecks; i += 1) {
      loop.tick(100);
      const current = loop.getState();
      if (!current.active || current.active.type !== targetPieceType) {
        break;
      }
      if (current.lock.isLocking) {
        groundedState = current;
        break;
      }
    }

    expect(groundedState).not.toBeNull();

    if (groundedState?.active) {
      const rowBeforeCollision = groundedState.active.position.row;
      loop.applyInput({ type: 'softDrop', repeat: false });
      state = loop.getState();
      expect(requireActive(state).position.row).toBe(rowBeforeCollision);
    }

    loop.applyInput({ type: 'hardDrop' });
    state = loop.getState();
    const holdBeforeSwap = state.hold;
    const activeBeforeSwap = requireActive(state).type;
    if (!holdBeforeSwap) {
      throw new Error('Expected hold slot to contain a piece before swapping');
    }

    loop.applyInput({ type: 'hold' });
    state = loop.getState();
    expect(state.hold).toBe(activeBeforeSwap);
    expect(state.active?.type).toBe(holdBeforeSwap);
  });

  it('locks pieces via gravity and advances the queue', () => {
    const loop = createGameLoop({ seed: TEST_SEED });
    loop.start();

    loop.applyInput({ type: 'move', direction: 'left', repeat: false });

    const initialType = requireActive(loop.getState()).type;
    const initialLines = loop.getState().stats.lines;

    const nextType = tickUntilNewPiece(loop, initialType);
    expect(nextType).not.toBe(initialType);

    const afterLock = loop.getState();
    expect(afterLock.stats.lines).toBeGreaterThanOrEqual(initialLines);
    expect(afterLock.lock.isLocking).toBe(false);
    expect(afterLock.holdUsedThisTurn).toBe(false);
  });

  it('supports forcing a game over from the debug harness', () => {
    const loop = createGameLoop({ seed: TEST_SEED });
    loop.start();

    const debug = loop as GameLoop & { debugForceGameOver?: () => void };
    expect(debug.debugForceGameOver).toBeTypeOf('function');
    debug.debugForceGameOver?.();

    const state = loop.getState();
    expect(state.phase).toBe('gameOver');
    expect(state.active).toBeNull();
    expect(state.ghost).toBeNull();
    expect(state.board.every((row) => row.every((cell) => cell.occupied))).toBe(true);
  });
});
