import { describe, expect, it } from 'vitest';

import {
  advanceQueue,
  createNextQueue,
  type NextQueueState,
} from '../../../src/core/next-queue';
import { createSevenBagRng } from '../../../src/core/rng';

const TETROMINO_TYPES = new Set(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

function assertValid(state: NextQueueState) {
  expect(TETROMINO_TYPES.has(state.active)).toBe(true);
  for (const piece of state.queue) {
    expect(TETROMINO_TYPES.has(piece)).toBe(true);
  }
}

describe('next queue', () => {
  it('initializes with three preview pieces and an active piece', () => {
    const rng = createSevenBagRng('queue-seed');
    const state = createNextQueue(rng);

    expect(state.queue).toHaveLength(3);
    expect(TETROMINO_TYPES.has(state.active)).toBe(true);
    assertValid(state);
  });

  it('advances the queue when consuming the active piece', () => {
    const initialRng = createSevenBagRng('advance-seed');
    const initialState = createNextQueue(initialRng);

    const next = advanceQueue(initialState);

    expect(next.active).toBe(initialState.queue[0]);
    expect(next.queue).toHaveLength(3);
    expect(next.queue.slice(0, 2)).toEqual(initialState.queue.slice(1));
    assertValid(next);
  });
});
