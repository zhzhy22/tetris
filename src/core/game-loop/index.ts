import {
  DEFAULT_BOARD_COLS,
  DEFAULT_BOARD_ROWS,
  createEmptyBoard,
  lockPiece,
  type Board,
} from '../board';
import { checkCollision } from '../collision';
import { createGravityState, stepGravity, type GravityConfig, type GravityState } from '../gravity';
import { advanceQueue, createNextQueue, type NextQueueState } from '../next-queue';
import { createSevenBagRng, type RandomState, type TetrominoType } from '../rng';
import { computeGhostPosition } from '../ghost';
import {
  createHoldState,
  performHold,
  resetHold,
  type HoldState,
} from '../hold';
import {
  applyHardDrop,
  applyLineClear,
  applySoftDrop,
  createInitialStats,
  type GameStats,
} from '../scoring';
import {
  attemptSrsRotation,
  createRotationContext,
  getPieceShape,
  type PieceState,
  type RotationDirection,
  type RotationState,
} from '../srs';
import { createStateMachine, type GamePhase } from '../state-machine';

export type ControlInput =
  | { type: 'move'; direction: 'left' | 'right'; repeat: boolean }
  | { type: 'softDrop'; repeat: boolean }
  | { type: 'hardDrop' }
  | { type: 'rotate'; direction: RotationDirection }
  | { type: 'hold' }
  | { type: 'pause' }
  | { type: 'resume' };

export interface SpeedProfile {
  gravityMs: number;
  lockDelayMs: number;
}

export interface Position {
  row: number;
  col: number;
}

export interface GameSessionState {
  board: Board;
  active: PieceState | null;
  hold: TetrominoType | null;
  holdUsedThisTurn: boolean;
  nextQueue: TetrominoType[];
  rng: RandomState;
  stats: GameStats;
  speed: SpeedProfile;
  lock: {
    isLocking: boolean;
    elapsedMs: number;
    frames: number;
  };
  phase: GamePhase;
  ghost: Position | null;
  seed: string;
}

export interface GameLoopOptions {
  seed?: string;
  width?: number;
  height?: number;
  initialLevel?: number;
}

export interface GameLoop {
  start(): void;
  stop(): void;
  tick(deltaMs: number): void;
  applyInput(input: ControlInput): void;
  subscribe(listener: (snapshot: GameSessionState) => void): () => void;
  getState(): GameSessionState;
}

const DEFAULT_WIDTH = DEFAULT_BOARD_COLS;
const DEFAULT_HEIGHT = DEFAULT_BOARD_ROWS;
const LOCK_DELAY_MS = 500;
const LOCK_DELAY_FRAMES = 15;
const MIN_GRAVITY_MS = 50;
const INITIAL_ROTATION: RotationState = 0;

interface InternalState {
  session: GameSessionState;
  gravity: GravityState;
  gravityConfig: GravityConfig;
  nextQueue: NextQueueState | null;
  hold: HoldState;
  running: boolean;
  pendingLockReset: boolean;
  seed: string;
}

export function createGameLoop(options: GameLoopOptions = {}): GameLoop {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const initialLevel = options.initialLevel ?? 0;

  const listeners = new Set<(snapshot: GameSessionState) => void>();

  let internal: InternalState = createInitialInternalState(width, height, initialLevel, options.seed);
  let machine = createStateMachine();
  let unsubscribeMachine = machine.subscribe((snapshot) => {
    internal = {
      ...internal,
      session: {
        ...internal.session,
        phase: snapshot.phase,
        holdUsedThisTurn: !snapshot.holdAvailable,
      },
    };
  });

  function resetStateMachine() {
    unsubscribeMachine();
    machine = createStateMachine();
    unsubscribeMachine = machine.subscribe((snapshot) => {
      internal = {
        ...internal,
        session: {
          ...internal.session,
          phase: snapshot.phase,
          holdUsedThisTurn: !snapshot.holdAvailable,
        },
      };
    });
  }

  function emitState() {
    const snapshot = cloneSessionState(internal.session);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function updateSpeed(level: number) {
    const gravityMs = Math.max(MIN_GRAVITY_MS, Math.round(1000 * Math.pow(0.85, level)));
    const speed: SpeedProfile = {
      gravityMs,
      lockDelayMs: LOCK_DELAY_MS,
    };
    const gravityConfig: GravityConfig = {
      gravityMs: speed.gravityMs,
      lockDelayMs: speed.lockDelayMs,
      lockDelayFrames: LOCK_DELAY_FRAMES,
    };
    const gravity = createGravityState(gravityConfig);
    internal = {
      ...internal,
      session: {
        ...internal.session,
        speed,
        lock: mapLockSnapshot(gravity),
      },
      gravityConfig,
      gravity,
    };
  }

  function ensureNextQueue(seed: string | undefined) {
    const rng = seed ? createSevenBagRng(seed) : createSevenBagRng();
    const queue = createNextQueue(rng);
    internal = {
      ...internal,
      nextQueue: queue,
      session: {
        ...internal.session,
        rng: queue.rng,
        nextQueue: [...queue.queue],
        seed: queue.rng.seed,
      },
    };
  }

  function spawnPiece(type: TetrominoType, rotation: RotationState, board: Board): PieceState | null {
    const shape = getPieceShape(type, rotation);
    const boardWidth = board[0]?.length ?? DEFAULT_WIDTH;
    const pieceWidth = shape[0]?.length ?? 0;
    const spawnCol = Math.floor((boardWidth - pieceWidth) / 2);
    const position = { row: 0, col: spawnCol };
    const collision = checkCollision({ board, shape, position });
    if (collision.collides) {
      return null;
    }
    return {
      type,
      rotation,
      position,
    };
  }

  function lockActivePiece(fromHardDrop = false) {
    const active = internal.session.active;
    if (!active) {
      return;
    }
    const shape = getPieceShape(active.type, active.rotation);
    const { board: nextBoard, clearedLines } = lockPiece({
      board: internal.session.board,
      shape,
      position: active.position,
      type: active.type,
    });

    let stats = internal.session.stats;
    if (clearedLines.length > 0) {
      stats = applyLineClear(stats, clearedLines.length);
    }
    if (!fromHardDrop) {
      internal = {
        ...internal,
        session: {
          ...internal.session,
          stats,
        },
      };
    } else {
      internal = {
        ...internal,
        session: {
          ...internal.session,
          stats,
        },
      };
    }

    const updatedQueue = internal.nextQueue ? advanceQueue(internal.nextQueue) : null;
    internal = {
      ...internal,
      session: {
        ...internal.session,
        board: nextBoard,
        active: null,
        nextQueue: updatedQueue ? [...updatedQueue.queue] : internal.session.nextQueue,
        rng: updatedQueue ? updatedQueue.rng : internal.session.rng,
        ghost: null,
      },
      nextQueue: updatedQueue,
    };

    updateSpeed(internal.session.stats.level);
    internal = {
      ...internal,
      pendingLockReset: false,
    };

    if (!updatedQueue) {
      machine.dispatch({ type: 'gameOver' });
      internal = {
        ...internal,
        running: false,
      };
      emitState();
      return;
    }

  const nextPiece = spawnPiece(updatedQueue.active, INITIAL_ROTATION, internal.session.board);
    if (!nextPiece) {
      machine.dispatch({ type: 'gameOver' });
      internal = {
        ...internal,
        running: false,
        session: {
          ...internal.session,
          active: null,
          ghost: null,
        },
      };
      emitState();
      return;
    }

    internal = {
      ...internal,
      session: {
        ...internal.session,
        active: nextPiece,
  ghost: computeGhostPosition({ board: internal.session.board, piece: nextPiece }),
      },
    };

    internal = {
      ...internal,
      hold: resetHold(internal.hold),
    };

    machine.dispatch({ type: 'lock' });
    emitState();
  }

  function moveHorizontal(direction: 'left' | 'right') {
    if (!internal.running || internal.session.phase !== 'playing') {
      return;
    }
    const active = internal.session.active;
    if (!active) {
      return;
    }
    const delta = direction === 'left' ? -1 : 1;
    const shape = getPieceShape(active.type, active.rotation);
    const target = {
      row: active.position.row,
      col: active.position.col + delta,
    };
    const collision = checkCollision({ board: internal.session.board, shape, position: target });
    if (collision.collides) {
      return;
    }
    const updated: PieceState = {
      ...active,
      position: target,
    };
    internal = {
      ...internal,
      session: {
        ...internal.session,
        active: updated,
  ghost: computeGhostPosition({ board: internal.session.board, piece: updated }),
      },
      pendingLockReset: true,
    };
    emitState();
  }

  function rotatePiece(direction: RotationDirection) {
    if (!internal.running || internal.session.phase !== 'playing') {
      return;
    }
    const active = internal.session.active;
    if (!active) {
      return;
    }
    const context = createRotationContext({
      width,
      height,
      isOccupied(row: number, col: number) {
        if (row < 0 || row >= height || col < 0 || col >= width) {
          return true;
        }
        return internal.session.board[row][col]?.occupied ?? false;
      },
    });

    const result = attemptSrsRotation(active, direction, context);
    if (!result.success) {
      return;
    }

    internal = {
      ...internal,
      session: {
        ...internal.session,
        active: result.piece,
  ghost: computeGhostPosition({ board: internal.session.board, piece: result.piece }),
      },
      pendingLockReset: true,
    };
    emitState();
  }

  function softDrop() {
    if (!internal.running || internal.session.phase !== 'playing') {
      return;
    }
    const active = internal.session.active;
    if (!active) {
      return;
    }
    const shape = getPieceShape(active.type, active.rotation);
    const target = {
      row: active.position.row + 1,
      col: active.position.col,
    };
    const collision = checkCollision({ board: internal.session.board, shape, position: target });
    if (collision.collides) {
      internal = {
        ...internal,
        pendingLockReset: true,
      };
      return;
    }

    const stats = applySoftDrop(internal.session.stats, 1);

    const updated: PieceState = {
      ...active,
      position: target,
    };

    internal = {
      ...internal,
      session: {
        ...internal.session,
        active: updated,
        stats,
  ghost: computeGhostPosition({ board: internal.session.board, piece: updated }),
      },
      pendingLockReset: true,
    };
    emitState();
  }

  function hardDrop() {
    if (!internal.running || internal.session.phase !== 'playing') {
      return;
    }
    const active = internal.session.active;
    if (!active) {
      return;
    }
    const shape = getPieceShape(active.type, active.rotation);
    let distance = 0;
    let position = active.position;
    while (true) {
      const target = { row: position.row + 1, col: position.col };
      const collision = checkCollision({ board: internal.session.board, shape, position: target });
      if (collision.collides) {
        break;
      }
      position = target;
      distance += 1;
    }

    if (distance > 0) {
      const stats = applyHardDrop(internal.session.stats, distance);
      const updated: PieceState = {
        ...active,
        position,
      };
      internal = {
        ...internal,
        session: {
          ...internal.session,
          active: updated,
          stats,
        },
      };
    }

    lockActivePiece(true);
  }

  function handleHold() {
    if (!internal.running || internal.session.phase !== 'playing') {
      return;
    }
    const active = internal.session.active;
    if (!active || !machine.canHold()) {
      return;
    }

    if (internal.hold.slot === null && (!internal.nextQueue || internal.nextQueue.queue.length === 0)) {
      return;
    }

    const nextQueuePiece = internal.hold.slot === null
      ? internal.nextQueue?.queue[0] ?? null
      : null;

    let holdResult;
    try {
      holdResult = performHold({
        state: internal.hold,
        active: active.type,
        nextQueuePiece,
      });
    } catch (error) {
      return;
    }

    let nextQueueState = internal.nextQueue;
    let nextActiveType: TetrominoType;

    if (holdResult.consumesQueue) {
      if (!nextQueueState) {
        return;
      }
      nextQueueState = advanceQueue(nextQueueState);
      nextActiveType = nextQueueState.active;
    } else {
      nextActiveType = holdResult.nextActive;
    }

    const spawn = spawnPiece(nextActiveType, INITIAL_ROTATION, internal.session.board);
    if (!spawn) {
      machine.dispatch({ type: 'gameOver' });
      internal = {
        ...internal,
        running: false,
        hold: holdResult.state,
        session: {
          ...internal.session,
          hold: holdResult.state.slot,
          active: null,
          ghost: null,
        },
      };
      emitState();
      return;
    }

    internal = {
      ...internal,
      hold: holdResult.state,
      nextQueue: nextQueueState,
      session: {
        ...internal.session,
        hold: holdResult.state.slot,
        active: spawn,
        nextQueue: nextQueueState ? [...nextQueueState.queue] : internal.session.nextQueue,
        rng: nextQueueState ? nextQueueState.rng : internal.session.rng,
        ghost: computeGhostPosition({ board: internal.session.board, piece: spawn }),
      },
      gravity: createGravityState(internal.gravityConfig),
      pendingLockReset: false,
    };

    machine.dispatch({ type: 'useHold' });
    emitState();
  }

  function processTick(deltaMs: number) {
    if (!internal.running || internal.session.phase !== 'playing') {
      return;
    }
    const active = internal.session.active;
    if (!active) {
      return;
    }
    const shape = getPieceShape(active.type, active.rotation);
    const grounded = checkCollision({
      board: internal.session.board,
      shape,
      position: { row: active.position.row + 1, col: active.position.col },
    }).collides;

    const gravityResult = stepGravity(internal.gravity, internal.gravityConfig, {
      deltaMs,
      frames: 1,
      grounded,
      resetLock: grounded && internal.pendingLockReset,
    });

    internal = {
      ...internal,
      gravity: gravityResult.state,
      pendingLockReset: false,
    };

    if (grounded) {
      if (gravityResult.shouldLock) {
        lockActivePiece();
        return;
      }
      internal = {
        ...internal,
        session: {
          ...internal.session,
          lock: mapLockSnapshot(gravityResult.state),
        },
      };
      emitState();
      return;
    }

    let drops = gravityResult.dropRows;
    let updatedPiece = active;
    while (drops > 0) {
      const target = { row: updatedPiece.position.row + 1, col: updatedPiece.position.col };
      const collision = checkCollision({ board: internal.session.board, shape, position: target });
      if (collision.collides) {
        const lockState = stepGravity(internal.gravity, internal.gravityConfig, {
          deltaMs: 0,
          frames: 0,
          grounded: true,
          resetLock: false,
        });
        internal = {
          ...internal,
          gravity: lockState.state,
          session: {
            ...internal.session,
            lock: mapLockSnapshot(lockState.state),
          },
        };
        break;
      }
      updatedPiece = {
        ...updatedPiece,
        position: target,
      };
      drops -= 1;
    }

    internal = {
      ...internal,
      session: {
        ...internal.session,
        active: updatedPiece,
  ghost: computeGhostPosition({ board: internal.session.board, piece: updatedPiece }),
        lock: mapLockSnapshot(internal.gravity),
      },
    };

    emitState();
  }

  function startGame() {
    resetStateMachine();
    const baseBoard = createEmptyBoard(height, width);
    ensureNextQueue(options.seed);
    updateSpeed(initialLevel);
    const queue = internal.nextQueue;
    const stats = createInitialStats();
    let activePiece: PieceState | null = null;
    if (queue) {
  activePiece = spawnPiece(queue.active, INITIAL_ROTATION, baseBoard);
    }

    internal = {
      ...internal,
      running: true,
      hold: createHoldState(),
      session: {
        ...internal.session,
        board: baseBoard,
        active: activePiece,
        hold: null,
        stats,
  ghost: computeGhostPosition({ board: baseBoard, piece: activePiece }),
        lock: mapLockSnapshot(internal.gravity),
      },
    };

    machine.dispatch({ type: 'start' });
    emitState();
  }

  function stopGame() {
    resetStateMachine();
    internal = createInitialInternalState(width, height, initialLevel, options.seed);
    emitState();
  }

  function debugForceGameOver() {
    const filledBoard = internal.session.board.map((row) =>
      row.map((cell) => ({
        ...cell,
        occupied: true,
        type: cell.type ?? 'I',
        lockFrame: undefined,
      })),
    );

    internal = {
      ...internal,
      running: false,
      session: {
        ...internal.session,
        board: filledBoard,
        active: null,
        ghost: null,
      },
    };

    machine.dispatch({ type: 'gameOver' });
    emitState();
  }

  const api: GameLoop & { debugForceGameOver?: () => void } = {
    start() {
      startGame();
    },
    stop() {
      stopGame();
    },
    tick(deltaMs: number) {
      processTick(deltaMs);
    },
    applyInput(input: ControlInput) {
      switch (input.type) {
        case 'move':
          moveHorizontal(input.direction);
          break;
        case 'rotate':
          rotatePiece(input.direction);
          break;
        case 'softDrop':
          softDrop();
          break;
        case 'hardDrop':
          hardDrop();
          break;
        case 'hold':
          handleHold();
          break;
        case 'pause':
          machine.dispatch({ type: 'pause' });
          emitState();
          break;
        case 'resume':
          machine.dispatch({ type: 'resume' });
          emitState();
          break;
        default:
          break;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      let active = true;
      return () => {
        if (!active) {
          return;
        }
        active = false;
        listeners.delete(listener);
      };
    },
    getState() {
      return cloneSessionState(internal.session);
    },
  };

  api.debugForceGameOver = () => {
    debugForceGameOver();
  };

  return api;
}

function mapLockSnapshot(state: GravityState) {
  return {
    isLocking: state.isLocking,
    elapsedMs: state.lockElapsedMs,
    frames: state.lockFrames,
  };
}

function cloneSessionState(state: GameSessionState): GameSessionState {
  return {
    board: state.board.map((row) => row.map((cell) => ({ ...cell }))),
    active: state.active ? { ...state.active, position: { ...state.active.position } } : null,
    hold: state.hold,
    holdUsedThisTurn: state.holdUsedThisTurn,
    nextQueue: [...state.nextQueue],
    rng: {
      seed: state.rng.seed,
      bag: [...state.rng.bag],
      history: [...state.rng.history],
    },
    stats: { ...state.stats },
    speed: { ...state.speed },
    lock: { ...state.lock },
    phase: state.phase,
    ghost: state.ghost ? { ...state.ghost } : null,
    seed: state.seed,
  };
}

function createInitialInternalState(
  width: number,
  height: number,
  initialLevel: number,
  seed?: string,
): InternalState {
  const board = createEmptyBoard(height, width);
  const rng = seed ? createSevenBagRng(seed) : createSevenBagRng();
  const queue = createNextQueue(rng);
  const speed: SpeedProfile = {
    gravityMs: Math.max(MIN_GRAVITY_MS, Math.round(1000 * Math.pow(0.85, initialLevel))),
    lockDelayMs: LOCK_DELAY_MS,
  };
  const gravityConfig: GravityConfig = {
    gravityMs: speed.gravityMs,
    lockDelayMs: speed.lockDelayMs,
    lockDelayFrames: LOCK_DELAY_FRAMES,
  };
  const gravity = createGravityState(gravityConfig);

  return {
    session: {
      board,
      active: null,
      hold: null,
      holdUsedThisTurn: false,
      nextQueue: [...queue.queue],
      rng: queue.rng,
      stats: createInitialStats(),
      speed,
      lock: mapLockSnapshot(gravity),
      phase: 'ready',
      ghost: null,
      seed: queue.rng.seed,
    },
    gravity,
    gravityConfig,
    nextQueue: queue,
    hold: createHoldState(),
    running: false,
    pendingLockReset: false,
    seed: queue.rng.seed,
  };
}
