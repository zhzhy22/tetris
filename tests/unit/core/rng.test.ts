import { describe, expect, it } from 'vitest';

import { createSevenBagRng, drawNextPiece } from '../../../src/core/rng';

type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

const ALL_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

function drawSequence(seed: string, count: number) {
  let state = createSevenBagRng(seed);
  const pieces: TetrominoType[] = [];

  for (let i = 0; i < count; i += 1) {
    const result = drawNextPiece(state);
    pieces.push(result.piece);
    state = result.state;
  }

  return { pieces, finalState: state };
}

describe('seven bag rng', () => {
  it('generates reproducible sequences for identical seeds', () => {
    const seed = 'feedface';
    const firstRun = drawSequence(seed, 14);
    const secondRun = drawSequence(seed, 14);

    expect(secondRun.pieces).toEqual(firstRun.pieces);
    expect(secondRun.finalState.seed).toBe(firstRun.finalState.seed);
  });

  it('exhausts each bag before repeating tetromino types', () => {
    const { pieces } = drawSequence('bag-check', 14);
    const firstBag = pieces.slice(0, 7);
    const secondBag = pieces.slice(7, 14);

    const asSet = (bag: TetrominoType[]) => new Set(bag);
    expect(asSet(firstBag).size).toBe(ALL_TYPES.length);
    expect(asSet(secondBag).size).toBe(ALL_TYPES.length);

    for (const type of ALL_TYPES) {
      expect(firstBag).toContain(type);
      expect(secondBag).toContain(type);
    }
  });
});
