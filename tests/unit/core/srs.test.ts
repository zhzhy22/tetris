import { describe, expect, it } from 'vitest';
import {
  attemptSrsRotation,
  type RotationDirection,
  type PieceState,
  createRotationContext,
} from '../../../src/core/srs';

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 40;

function makeContext(filled: Array<[number, number]> = []) {
  const filledSet = new Set(filled.map(([row, col]) => `${row}:${col}`));

  return createRotationContext({
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
  isOccupied(row: number, col: number) {
      if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) {
        return true;
      }
      return filledSet.has(`${row}:${col}`);
    },
  });
}

function rotate(piece: PieceState, direction: RotationDirection, filled?: Array<[number, number]>) {
  const context = makeContext(filled);
  return attemptSrsRotation(piece, direction, context);
}

describe('SRS wall kicks', () => {
  it('shifts a T-piece left when rotating clockwise against the right wall', () => {
    const start: PieceState = {
      type: 'T',
      rotation: 0,
      position: { row: 0, col: 7 },
    };

    const result = rotate(start, 'cw');

    expect(result.success).toBe(true);
    expect(result.piece.rotation).toBe(1);
    expect(result.piece.position).toEqual({ row: 0, col: 6 });
    expect(result.kick).toEqual({ row: 0, col: -1 });
  });

  it('uses I-piece specific kick data near the wall', () => {
    const start: PieceState = {
      type: 'I',
      rotation: 0,
      position: { row: 1, col: 6 },
    };

    const result = rotate(start, 'cw');

    expect(result.success).toBe(true);
    expect(result.piece.rotation).toBe(1);
    expect(result.piece.position).toEqual({ row: 0, col: 4 });
    expect(result.kick).toEqual({ row: -1, col: -2 });
  });

  it('keeps O-piece pivot centered without kicks', () => {
    const start: PieceState = {
      type: 'O',
      rotation: 0,
      position: { row: 5, col: 4 },
    };

    const result = rotate(start, 'cw');

    expect(result.success).toBe(true);
    expect(result.piece.rotation).toBe(1);
    expect(result.piece.position).toEqual(start.position);
    expect(result.kick).toEqual({ row: 0, col: 0 });
  });

  it('fails when all kicks collide with occupied cells', () => {
    const blockers: Array<[number, number]> = [
      [0, 7],
      [0, 6],
      [1, 6],
      [0, 5],
      [1, 5],
    ];

    const start: PieceState = {
      type: 'T',
      rotation: 0,
      position: { row: 0, col: 7 },
    };

    const result = rotate(start, 'cw', blockers);

    expect(result.success).toBe(false);
    expect(result.piece).toEqual(start);
    expect(result.kick).toBeNull();
  });
});
