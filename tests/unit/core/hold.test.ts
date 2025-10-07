import { describe, expect, it } from 'vitest';

import {
  createHoldState,
  canHold,
  resetHold,
  performHold,
  type HoldState,
} from '../../../src/core/hold';

describe('core/hold', () => {
  it('stores active piece when slot is empty and consumes next queue piece', () => {
    const state = createHoldState();

    const result = performHold({ state, active: 'T', nextQueuePiece: 'O' });

    expect(result.state).not.toBe(state);
    expect(result.state.slot).toBe('T');
    expect(result.state.usedThisTurn).toBe(true);
    expect(result.nextActive).toBe('O');
    expect(result.consumesQueue).toBe(true);
  });

  it('swaps with stored piece without consuming the queue', () => {
    const state: HoldState = { slot: 'I', usedThisTurn: false };

    const result = performHold({ state, active: 'Z', nextQueuePiece: 'L' });

    expect(result.state.slot).toBe('Z');
    expect(result.state.usedThisTurn).toBe(true);
    expect(result.nextActive).toBe('I');
    expect(result.consumesQueue).toBe(false);
  });

  it('throws when attempting to hold more than once per turn', () => {
    const state: HoldState = { slot: 'S', usedThisTurn: true };

    expect(() => performHold({ state, active: 'T', nextQueuePiece: 'O' })).toThrowError();
  });

  it('throws when the hold slot is empty but no queue piece is available', () => {
    const state = createHoldState();

    expect(() => performHold({ state, active: 'J', nextQueuePiece: null })).toThrowError();
  });

  it('resetHold clears the usage flag while keeping the stored piece', () => {
    const state: HoldState = { slot: 'L', usedThisTurn: true };

    const reset = resetHold(state);

    expect(reset.slot).toBe('L');
    expect(reset.usedThisTurn).toBe(false);
    expect(canHold(reset)).toBe(true);
  });

  it('canHold reflects whether the slot has already been used this turn', () => {
    const state = createHoldState();
    expect(canHold(state)).toBe(true);

    const usedState = performHold({ state, active: 'T', nextQueuePiece: 'O' }).state;
    expect(canHold(usedState)).toBe(false);
  });
});
