import { drawNextPiece } from '../rng';

import type { RandomState, TetrominoType } from '../rng';

export interface NextQueueState {
  active: TetrominoType;
  queue: TetrominoType[];
  rng: RandomState;
}

export function createNextQueue(rng: RandomState): NextQueueState {
  let current = rng;
  const pieces: TetrominoType[] = [];

  for (let i = 0; i < 4; i += 1) {
    const { piece, state } = drawNextPiece(current);
    pieces.push(piece);
    current = state;
  }

  const [active, ...queue] = pieces;

  return {
    active,
    queue,
    rng: current,
  };
}

export function advanceQueue(state: NextQueueState): NextQueueState {
  let current = state.rng;
  let nextActive: TetrominoType;
  const remaining = [...state.queue];

  if (remaining.length > 0) {
    nextActive = remaining.shift() as TetrominoType;
  } else {
    const draw = drawNextPiece(current);
    nextActive = draw.piece;
    current = draw.state;
  }

  while (remaining.length < 3) {
    const { piece, state } = drawNextPiece(current);
    remaining.push(piece);
    current = state;
  }

  return {
    active: nextActive,
    queue: remaining,
    rng: current,
  };
}
