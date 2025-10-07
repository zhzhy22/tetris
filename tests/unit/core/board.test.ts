import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  lockPiece,
  type LockPieceInput,
} from '../../../src/core/board';

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 40;

function makeInput(overrides: Partial<LockPieceInput> = {}): LockPieceInput {
  return {
    board: overrides.board ?? createEmptyBoard(),
    type: overrides.type ?? 'I',
    shape:
      overrides.shape ??
      ([
        [false, true, true, true],
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
      ] as LockPieceInput['shape']),
    position: overrides.position ?? { row: 0, col: 3 },
  };
}

describe('createEmptyBoard', () => {
  it('produces a 40x20 board with all cells empty', () => {
  const board = createEmptyBoard();

  expect(board).toHaveLength(BOARD_HEIGHT);
    for (const row of board) {
      expect(row).toHaveLength(BOARD_WIDTH);
      for (const cell of row) {
        expect(cell.occupied).toBe(false);
      }
    }
  });
});

describe('lockPiece', () => {
  it('locks the piece into the board at the given position', () => {
    const input = makeInput({
      position: { row: 2, col: 4 },
      type: 'T',
    });

    const { board, clearedLines } = lockPiece(input);

    expect(clearedLines).toEqual([]);
    expect(board[2][5].occupied).toBe(true);
    expect(board[2][5].type).toBe('T');
  });

  it('clears a single filled line and compacts the stack', () => {
    const board = createEmptyBoard();
    const targetRow = BOARD_HEIGHT - 2;
    // Pre-fill target row except one gap for the piece to complete
    for (let col = 0; col < BOARD_WIDTH; col += 1) {
      board[targetRow][col].occupied = true;
      board[targetRow][col].type = 'J';
    }
    board[targetRow][4].occupied = false;
    board[targetRow][4].type = undefined;

    const input = makeInput({
      board,
      shape: [
        [true, true],
        [true, true],
      ],
  position: { row: targetRow - 1, col: 4 },
      type: 'O',
    });

  const { board: nextBoard, clearedLines } = lockPiece(input);

  expect(clearedLines).toEqual([targetRow]);
    const targetRowCells = nextBoard[targetRow]!;
    const bottomRowCells = nextBoard[BOARD_HEIGHT - 1]!;
    for (const cell of targetRowCells) {
      expect(cell.occupied).toBe(false);
    }
    let bottomRowHasBlocks = false;
    for (const cell of bottomRowCells) {
      if (cell.occupied) {
        bottomRowHasBlocks = true;
        break;
      }
    }
    expect(bottomRowHasBlocks).toBe(true);
  });

  it('clears multiple lines when locking completes stacked rows', () => {
  const board = createEmptyBoard();
  const baseRow = BOARD_HEIGHT - 3;
  const rowsToFill = [baseRow, baseRow + 1];

    for (const row of rowsToFill) {
      for (let col = 0; col < BOARD_WIDTH; col += 1) {
        board[row][col].occupied = true;
        board[row][col].type = 'S';
      }
      // Leave a gap for the incoming piece
      board[row][5].occupied = false;
      board[row][5].type = undefined;
    }

    const input = makeInput({
      board,
      shape: [
        [false, true],
        [true, true],
        [true, false],
      ],
  position: { row: baseRow - 1, col: 5 },
      type: 'T',
    });

  const { board: nextBoard, clearedLines } = lockPiece(input);

  expect(clearedLines).toEqual(rowsToFill);
    const compactRow = nextBoard[baseRow]!;
    const belowCompactRow = nextBoard[baseRow + 1]!;
    for (const cell of compactRow) {
      expect(cell.occupied).toBe(false);
    }
    for (const cell of belowCompactRow) {
      expect(cell.occupied).toBe(false);
    }
  });
});
