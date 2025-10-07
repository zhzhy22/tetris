import { describe, expect, it } from 'vitest';

import { canPlace, checkCollision } from '../../../src/core/collision';

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 40;

const O_SHAPE: boolean[][] = [
  [false, true, true, false],
  [false, true, true, false],
  [false, false, false, false],
  [false, false, false, false],
];

function createBoard(filled: Array<[number, number]> = []) {
  const grid = Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => ({ occupied: false })),
  );

  for (const [row, col] of filled) {
    grid[row][col].occupied = true;
  }

  return grid;
}

describe('checkCollision', () => {
  it('reports no collision when piece fits inside empty board', () => {
    const board = createBoard();

    const report = checkCollision({
      board,
      shape: O_SHAPE,
      position: { row: 5, col: 4 },
    });

    expect(report.outOfBounds).toBe(false);
    expect(report.overlaps).toBe(false);
    expect(report.collides).toBe(false);
    expect(canPlace({ board, shape: O_SHAPE, position: { row: 5, col: 4 } })).toBe(true);
  });

  it('flags collisions when shape extends past the left boundary', () => {
    const board = createBoard();

    const report = checkCollision({
      board,
      shape: O_SHAPE,
      position: { row: 5, col: -1 },
    });

    expect(report.outOfBounds).toBe(true);
    expect(report.collides).toBe(true);
    expect(canPlace({ board, shape: O_SHAPE, position: { row: 5, col: -1 } })).toBe(false);
  });

  it('flags collisions when shape extends past the floor', () => {
    const board = createBoard();

    const report = checkCollision({
      board,
      shape: O_SHAPE,
      position: { row: BOARD_HEIGHT - 1, col: 4 },
    });

    expect(report.outOfBounds).toBe(true);
    expect(report.collides).toBe(true);
  });

  it('detects overlap with occupied board cells', () => {
    const board = createBoard([[6, 5]]);

    const report = checkCollision({
      board,
      shape: O_SHAPE,
      position: { row: 5, col: 4 },
    });

    expect(report.overlaps).toBe(true);
    expect(report.collides).toBe(true);
    expect(canPlace({ board, shape: O_SHAPE, position: { row: 5, col: 4 } })).toBe(false);
  });
});
