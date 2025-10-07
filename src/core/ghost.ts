import { checkCollision } from './collision';
import { getPieceShape } from './srs';

import type { Board } from './board';
import type { PieceState } from './srs';

export interface GhostInput {
  board: Board;
  piece: PieceState | null;
}

export interface GhostPosition {
  row: number;
  col: number;
}

export function computeGhostPosition({ board, piece }: GhostInput): GhostPosition | null {
  if (!piece) {
    return null;
  }

  const shape = getPieceShape(piece.type, piece.rotation);
  const basePlacement = checkCollision({ board, shape, position: piece.position });

  if (basePlacement.collides) {
    return null;
  }

  let offset = 0;

  while (true) {
    const nextPosition = {
      row: piece.position.row + offset + 1,
      col: piece.position.col,
    };
    const report = checkCollision({ board, shape, position: nextPosition });
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
