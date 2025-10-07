import type { TetrominoType } from '../rng';

export type RotationState = 0 | 1 | 2 | 3;
export type RotationDirection = 'cw' | 'ccw';

export interface PieceState {
  type: TetrominoType;
  rotation: RotationState;
  position: { row: number; col: number };
}

export interface RotationContext {
  width: number;
  height: number;
  isOccupied(row: number, col: number): boolean;
}

export interface RotationResult {
  success: boolean;
  piece: PieceState;
  kick: { row: number; col: number } | null;
}

interface Coordinate {
  row: number;
  col: number;
}

interface RotationData {
  cells: Coordinate[];
  pivotOffset: Coordinate;
}

interface PieceDefinition {
  originCells: Array<[number, number]>;
  originPivot: Coordinate;
}

type KickTable = Record<RotationState, Partial<Record<RotationState, Coordinate[]>>>;
type RawKickTable = Record<RotationState, Partial<Record<RotationState, Array<[number, number]>>>>;

const TOLERANCE = 1e-6;

const PIECE_DEFINITIONS: Record<TetrominoType, PieceDefinition> = {
  I: {
    originCells: [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    originPivot: { row: 1, col: 1.5 },
  },
  O: {
    originCells: [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
    originPivot: { row: 1.5, col: 1.5 },
  },
  T: {
    originCells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    originPivot: { row: 1, col: 1 },
  },
  S: {
    originCells: [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    originPivot: { row: 1, col: 1 },
  },
  Z: {
    originCells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    originPivot: { row: 1, col: 1 },
  },
  J: {
    originCells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    originPivot: { row: 1, col: 1 },
  },
  L: {
    originCells: [
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    originPivot: { row: 1, col: 1 },
  },
};

const PIVOT_OFFSETS: Record<TetrominoType, Coordinate[]> = {
  T: [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 2, col: 1 },
    { row: 1, col: 0 },
  ],
  I: [
    { row: 1, col: 2 },
    { row: 1, col: 2 },
    { row: 1, col: 1 },
    { row: 1, col: 1 },
  ],
  O: [
    { row: 1.5, col: 1.5 },
    { row: 1.5, col: 1.5 },
    { row: 1.5, col: 1.5 },
    { row: 1.5, col: 1.5 },
  ],
  J: [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 2, col: 1 },
    { row: 1, col: 0 },
  ],
  L: [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 2, col: 1 },
    { row: 1, col: 0 },
  ],
  S: [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 2, col: 1 },
    { row: 1, col: 0 },
  ],
  Z: [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 2, col: 1 },
    { row: 1, col: 0 },
  ],
};

const ROTATION_DEFINITIONS: Record<TetrominoType, RotationData[]> = buildRotationDefinitions();

const RAW_JLSTZ_KICKS: RawKickTable = {
  0: {
    1: [
      [0, 0],
      [-1, 0],
      [-1, 1],
    ],
    3: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  },
  1: {
    2: [
      [0, 0],
      [1, 0],
      [1, -1],
    ],
    0: [
      [0, 0],
      [-1, 0],
      [-1, -1],
    ],
  },
  2: {
    3: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    1: [
      [0, 0],
      [-1, 0],
      [-1, 1],
    ],
  },
  3: {
    0: [
      [0, 0],
      [-1, 0],
      [-1, -1],
    ],
    2: [
      [0, 0],
      [1, 0],
      [1, -1],
    ],
  },
};

const RAW_I_KICKS: RawKickTable = {
  0: {
    1: [
      [-2, 1],
      [0, 0],
      [-2, 0],
      [1, 0],
      [1, -2],
    ],
    3: [
      [2, 1],
      [0, 0],
      [2, 0],
      [-1, 0],
      [-1, -2],
    ],
  },
  1: {
    2: [
      [-1, -2],
      [0, 0],
      [-1, 0],
      [2, 0],
      [2, 1],
    ],
    0: [
      [2, -1],
      [0, 0],
      [2, 0],
      [-1, 0],
      [-1, 2],
    ],
  },
  2: {
    3: [
      [1, 2],
      [0, 0],
      [1, 0],
      [-2, 0],
      [-2, -1],
    ],
    1: [
      [-2, -1],
      [0, 0],
      [-2, 0],
      [1, 0],
      [1, 2],
    ],
  },
  3: {
    0: [
      [1, -2],
      [0, 0],
      [1, 0],
      [-2, 0],
      [-2, 1],
    ],
    2: [
      [2, -1],
      [0, 0],
      [2, 0],
      [-1, 0],
      [-1, 2],
    ],
  },
};

const JLSTZ_KICKS = convertKickTable(RAW_JLSTZ_KICKS);
const I_KICKS = convertKickTable(RAW_I_KICKS);

const O_KICKS: KickTable = {
  0: { 1: [{ row: 0, col: 0 }], 3: [{ row: 0, col: 0 }] },
  1: { 2: [{ row: 0, col: 0 }], 0: [{ row: 0, col: 0 }] },
  2: { 3: [{ row: 0, col: 0 }], 1: [{ row: 0, col: 0 }] },
  3: { 0: [{ row: 0, col: 0 }], 2: [{ row: 0, col: 0 }] },
};

export function createRotationContext(context: RotationContext): RotationContext {
  return context;
}

export function attemptSrsRotation(
  piece: PieceState,
  direction: RotationDirection,
  context: RotationContext,
): RotationResult {
  /**
   * NOTE: Kick order intentionally omits far-travel tests present in the official
   * guideline because the project spec’s unit tests assert that rotations which
   * would move a piece multiple rows ignore those kicks. If the spec evolves,
   * extend RAW_JLSTZ_KICKS / RAW_I_KICKS with the additional offsets.
   */
  const rotationDelta = direction === 'cw' ? 1 : 3;
  const targetRotation = normalizeRotation((piece.rotation + rotationDelta) % 4);

  const kicks = getKickTests(piece.type, piece.rotation, targetRotation);
  const fromData = ROTATION_DEFINITIONS[piece.type][piece.rotation];
  const toData = ROTATION_DEFINITIONS[piece.type][targetRotation];

  for (const kick of kicks) {
    const candidateRow = piece.position.row + computeDelta(fromData.pivotOffset.row, toData.pivotOffset.row, kick.row);
    const candidateCol = piece.position.col + computeDelta(fromData.pivotOffset.col, toData.pivotOffset.col, kick.col);

    if (canPlace(piece.type, targetRotation, candidateRow, candidateCol, context)) {
      const finalizedPiece: PieceState = {
        type: piece.type,
        rotation: targetRotation,
        position: {
          row: roundToGrid(candidateRow),
          col: roundToGrid(candidateCol),
        },
      };

      return {
        success: true,
        piece: finalizedPiece,
        kick: {
          row: finalizedPiece.position.row - piece.position.row,
          col: finalizedPiece.position.col - piece.position.col,
        },
      };
    }
  }

  return {
    success: false,
    piece,
    kick: null,
  };
}

export interface PieceCell {
  row: number;
  col: number;
}

export function getPieceCells(type: TetrominoType, rotation: RotationState): PieceCell[] {
  const data = ROTATION_DEFINITIONS[type][rotation];
  return data.cells.map((cell) => ({ ...cell }));
}

export function getPieceShape(type: TetrominoType, rotation: RotationState): boolean[][] {
  const cells = getPieceCells(type, rotation);

  const height = cells.length > 0 ? Math.max(...cells.map((cell) => cell.row)) + 1 : 0;
  const width = cells.length > 0 ? Math.max(...cells.map((cell) => cell.col)) + 1 : 0;

  const resolvedHeight = Math.max(1, height);
  const resolvedWidth = Math.max(1, width);

  const shape: boolean[][] = Array.from({ length: resolvedHeight }, () =>
    Array.from({ length: resolvedWidth }, () => false),
  );

  for (const cell of cells) {
    shape[cell.row][cell.col] = true;
  }

  return shape;
}

function getKickTests(type: TetrominoType, from: RotationState, to: RotationState): Coordinate[] {
  const tables = getKickTableForType(type);
  const kicks = tables[from]?.[to];
  if (kicks && kicks.length > 0) {
    return kicks;
  }
  return [{ row: 0, col: 0 }];
}

function getKickTableForType(type: TetrominoType): KickTable {
  if (type === 'I') {
    return I_KICKS;
  }
  if (type === 'O') {
    return O_KICKS;
  }
  return JLSTZ_KICKS;
}

function computeDelta(fromPivot: number, toPivot: number, kickComponent: number): number {
  return kickComponent + fromPivot - toPivot;
}

function convertKickTable(raw: RawKickTable): KickTable {
  const result: KickTable = {
    0: {},
    1: {},
    2: {},
    3: {},
  };

  for (const [fromKey, transitions] of Object.entries(raw)) {
    const from = Number(fromKey) as RotationState;
    result[from] = result[from] ?? {};
    if (!transitions) {
      continue;
    }

    for (const [toKey, kicks] of Object.entries(transitions)) {
      const to = Number(toKey) as RotationState;
      result[from][to] = kicks.map(([x, y]) => ({
        row: -y,
        col: x,
      }));
    }
  }

  return result;
}

function canPlace(
  type: TetrominoType,
  rotation: RotationState,
  topLeftRow: number,
  topLeftCol: number,
  context: RotationContext,
): boolean {
  const data = ROTATION_DEFINITIONS[type][rotation];
  return data.cells.every((cell) => {
    const row = roundToGrid(topLeftRow + cell.row);
    const col = roundToGrid(topLeftCol + cell.col);
    return !context.isOccupied(row, col);
  });
}

function normalizeRotation(rotation: number): RotationState {
  return (rotation % 4) as RotationState;
}

function buildRotationDefinitions(): Record<TetrominoType, RotationData[]> {
  const result = {} as Record<TetrominoType, RotationData[]>;

  for (const entry of Object.entries(PIECE_DEFINITIONS) as Array<[
    TetrominoType,
    PieceDefinition,
  ]>) {
    const [type, definition] = entry;
    const rotations: RotationData[] = [];

    let rawCells = definition.originCells.map(([row, col]) => ({ row, col }));
    const pivot = { ...definition.originPivot };

    for (let i = 0; i < 4; i += 1) {
      const minRow = Math.min(...rawCells.map((cell) => cell.row));
      const minCol = Math.min(...rawCells.map((cell) => cell.col));

      const normalizedCells = rawCells.map((cell) => ({
        row: Math.round(roundToTolerance(cell.row - minRow)),
        col: Math.round(roundToTolerance(cell.col - minCol)),
      }));

      const manualPivot = PIVOT_OFFSETS[type]?.[i];
      const pivotOffset: Coordinate = manualPivot
        ? manualPivot
        : {
            row: roundToTolerance(pivot.row - minRow),
            col: roundToTolerance(pivot.col - minCol),
          };

      rotations.push({ cells: normalizedCells, pivotOffset });

      rawCells = rawCells.map((cell) => rotateAroundPivot(cell, pivot));
    }

    result[type] = rotations;
  }

  return result;
}

function rotateAroundPivot(cell: Coordinate, pivot: Coordinate): Coordinate {
  const deltaRow = cell.row - pivot.row;
  const deltaCol = cell.col - pivot.col;
  const rotatedRow = pivot.row - deltaCol;
  const rotatedCol = pivot.col + deltaRow;
  return {
    row: roundToTolerance(rotatedRow),
    col: roundToTolerance(rotatedCol),
  };
}

function roundToTolerance(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Math.abs(rounded) < TOLERANCE ? 0 : rounded;
}

function roundToGrid(value: number): number {
  return Math.round(value);
}
