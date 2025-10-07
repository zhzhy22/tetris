import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '../../../src/core/board';
import { checkCollision } from '../../../src/core/collision';
import { getPieceShape, type PieceState, type RotationState } from '../../../src/core/srs';
import type { TetrominoType } from '../../../src/core/rng';
import { computeGhostPosition } from '../../../src/core/ghost';

function createPiece(
  type: TetrominoType,
  row: number,
  col: number,
  rotation: RotationState = 0,
): PieceState {
  return {
    type,
    rotation,
    position: { row, col },
  };
}

function expectGhostToMatchManualDrop(options: { board: ReturnType<typeof createEmptyBoard>; piece: PieceState }) {
  const { board, piece } = options;
  const expected = manualGhostDrop(board, piece);
  const actual = computeGhostPosition({ board, piece });
  expect(actual).toEqual(expected);
}

function manualGhostDrop(board: ReturnType<typeof createEmptyBoard>, piece: PieceState) {
  const shape = getPieceShape(piece.type, piece.rotation);
  const initialReport = checkCollision({ board, shape, position: piece.position });
  if (initialReport.collides) {
    return null;
  }

  let offset = 0;

  while (true) {
    const target = {
      row: piece.position.row + offset + 1,
      col: piece.position.col,
    };
    const report = checkCollision({ board, shape, position: target });
    if (report.collides) {
      break;
    }
    offset += 1;
  }

  return {
    row: piece.position.row + offset,
    col: piece.position.col,
  };
}

describe('core/ghost', () => {
  it('drops an active piece to the lowest available row on an empty board', () => {
    const board = createEmptyBoard();
    const piece = createPiece('T', 0, 3);

    expectGhostToMatchManualDrop({ board, piece });
  });

  it('respects occupied cells and stops above the first collision', () => {
    const board = createEmptyBoard();
    for (let col = 0; col < board[0].length; col += 1) {
      board[18][col] = { occupied: true, type: 'O' };
    }
    const piece = createPiece('I', 0, 3, 1);

    expectGhostToMatchManualDrop({ board, piece });
  });

  it('returns null when the active piece placement is already colliding', () => {
    const board = createEmptyBoard();
    for (let col = 0; col < board[0].length; col += 1) {
      board[0][col] = { occupied: true, type: 'L' };
    }
    const piece = createPiece('L', 0, 3);

    expect(computeGhostPosition({ board, piece })).toBeNull();
  });

  it('returns null when no active piece is provided', () => {
    const board = createEmptyBoard();
    expect(computeGhostPosition({ board, piece: null })).toBeNull();
  });
});
