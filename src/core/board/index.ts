import type { Board, BoardCell } from '../collision';
import type { TetrominoType } from '../rng';

export const DEFAULT_BOARD_ROWS = 40;
export const DEFAULT_BOARD_COLS = 20;

export type { Board, BoardCell } from '../collision';

export interface LockPieceInput {
  board: Board;
  shape: boolean[][];
  position: { row: number; col: number };
  type: TetrominoType;
}

export interface LockPieceResult {
  board: Board;
  clearedLines: number[];
}

function createEmptyRow(cols: number): BoardCell[] {
  return Array.from({ length: cols }, () => ({ occupied: false }));
}

export function createEmptyBoard(rows = DEFAULT_BOARD_ROWS, cols = DEFAULT_BOARD_COLS): Board {
  return Array.from({ length: rows }, () => createEmptyRow(cols));
}

export function lockPiece(input: LockPieceInput): LockPieceResult {
  const { board, position, shape, type } = input;
  const boardHeight = board.length;
  const boardWidth = boardHeight > 0 ? board[0].length : 0;

  const nextBoard: Board = board.map((row) => row.map((cell) => ({ ...cell })));

  for (let shapeRow = 0; shapeRow < shape.length; shapeRow += 1) {
    for (let shapeCol = 0; shapeCol < shape[shapeRow].length; shapeCol += 1) {
      if (!shape[shapeRow][shapeCol]) {
        continue;
      }

      const targetRow = position.row + shapeRow;
      const targetCol = position.col + shapeCol;

      if (
        targetRow < 0 ||
        targetRow >= boardHeight ||
        targetCol < 0 ||
        targetCol >= boardWidth
      ) {
        continue;
      }

      const cell = nextBoard[targetRow][targetCol];
      cell.occupied = true;
      cell.type = type;
      cell.lockFrame = undefined;
    }
  }

  const clearedLines: number[] = [];

  for (let rowIndex = 0; rowIndex < boardHeight; rowIndex += 1) {
    if (nextBoard[rowIndex].every((cell) => cell.occupied)) {
      clearedLines.push(rowIndex);
    }
  }

  if (clearedLines.length === 0) {
    return {
      board: nextBoard,
      clearedLines,
    };
  }

  const clearedSet = new Set(clearedLines);
  const compactRows: Board = [];

  for (let rowIndex = 0; rowIndex < boardHeight; rowIndex += 1) {
    if (clearedSet.has(rowIndex)) {
      continue;
    }

    const row = nextBoard[rowIndex];

    if (row.some((cell) => cell.occupied)) {
      compactRows.push(row);
    }
  }

  if (compactRows.length === 0) {
    return {
      board: createEmptyBoard(boardHeight, boardWidth),
      clearedLines,
    };
  }

  if (compactRows.length >= clearedLines.length) {
    const emptyRowCount = boardHeight - compactRows.length;
    const compactedBoard: Board = [];

    for (let i = 0; i < emptyRowCount; i += 1) {
      compactedBoard.push(createEmptyRow(boardWidth));
    }

    compactedBoard.push(...compactRows);

    return {
      board: compactedBoard,
      clearedLines,
    };
  }

  const boardWithClears: Board = nextBoard.map((row, idx) =>
    clearedSet.has(idx) ? createEmptyRow(boardWidth) : row,
  );

  return {
    board: boardWithClears,
    clearedLines,
  };
}
