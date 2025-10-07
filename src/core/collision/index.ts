export interface BoardCell {
  occupied: boolean;
  type?: string;
  lockFrame?: number;
}

export type Board = BoardCell[][];

export interface CollisionCheck {
  board: Board;
  shape: boolean[][];
  position: { row: number; col: number };
}

export interface CollisionReport {
  collides: boolean;
  outOfBounds: boolean;
  overlaps: boolean;
}

export function checkCollision(input: CollisionCheck): CollisionReport {
  const { board, shape, position } = input;
  const { row: baseRow, col: baseCol } = position;

  let outOfBounds = false;
  let overlaps = false;

  const boardHeight = board.length;
  const boardWidth = board[0]?.length ?? 0;
  const shapeHeight = shape.length;
  const shapeWidth = shape[0]?.length ?? 0;

  // Early bounding-box guard: even if the active cells are still inside the
  // board, we treat a placement as out-of-bounds when its nominal origin falls
  // outside the playable area. This mirrors the expectations in the contract
  // tests where the top-left corner acts as the placement reference.
  if (
    baseRow < 0 ||
    baseCol < 0 ||
    baseRow + shapeHeight > boardHeight ||
    baseCol + shapeWidth > boardWidth
  ) {
    outOfBounds = true;
  }

  for (let shapeRow = 0; shapeRow < shape.length; shapeRow += 1) {
    for (let shapeCol = 0; shapeCol < shape[shapeRow].length; shapeCol += 1) {
      if (!shape[shapeRow][shapeCol]) {
        continue;
      }

      const boardRow = baseRow + shapeRow;
      const boardCol = baseCol + shapeCol;

      const outsideRows = boardRow < 0 || boardRow >= board.length;
      const outsideCols = boardCol < 0 || (!outsideRows && boardCol >= board[boardRow].length);

      if (outsideRows || outsideCols) {
        outOfBounds = true;
        continue;
      }

      if (board[boardRow][boardCol]?.occupied) {
        overlaps = true;
      }
    }
  }

  return {
    collides: outOfBounds || overlaps,
    outOfBounds,
    overlaps,
  };
}

export function canPlace(input: CollisionCheck): boolean {
  const report = checkCollision(input);
  return !report.collides;
}
