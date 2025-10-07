import type { TetrominoType } from './rng';

export interface HoldState {
  slot: TetrominoType | null;
  usedThisTurn: boolean;
}

export interface PerformHoldInput {
  state: HoldState;
  active: TetrominoType;
  nextQueuePiece: TetrominoType | null;
}

export interface PerformHoldResult {
  state: HoldState;
  nextActive: TetrominoType;
  consumesQueue: boolean;
}

export function createHoldState(): HoldState {
  return {
    slot: null,
    usedThisTurn: false,
  };
}

export function canHold(state: HoldState): boolean {
  return !state.usedThisTurn;
}

export function performHold(input: PerformHoldInput): PerformHoldResult {
  const { state, active, nextQueuePiece } = input;

  if (state.usedThisTurn) {
    throw new Error('Hold already used this turn');
  }

  if (state.slot === null) {
    if (!nextQueuePiece) {
      throw new Error('No queue piece available for hold swap');
    }
    return {
      state: {
        slot: active,
        usedThisTurn: true,
      },
      nextActive: nextQueuePiece,
      consumesQueue: true,
    };
  }

  return {
    state: {
      slot: active,
      usedThisTurn: true,
    },
    nextActive: state.slot,
    consumesQueue: false,
  };
}

export function resetHold(state: HoldState): HoldState {
  return {
    ...state,
    usedThisTurn: false,
  };
}
