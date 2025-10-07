export type GamePhase = 'ready' | 'playing' | 'paused' | 'gameOver';

export interface StateSnapshot {
  phase: GamePhase;
  holdAvailable: boolean;
}

export type StateEvent =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'gameOver' }
  | { type: 'useHold' }
  | { type: 'lock' }
  | { type: string };

export interface StateMachine {
  dispatch(event: StateEvent): void;
  getSnapshot(): StateSnapshot;
  canHold(): boolean;
  subscribe(listener: (snapshot: StateSnapshot) => void): () => void;
}

export function createStateMachine(): StateMachine {
  let snapshot: StateSnapshot = {
    phase: 'ready',
    holdAvailable: true,
  };
  const listeners = new Set<(snapshot: StateSnapshot) => void>();

  function emit(next: StateSnapshot) {
    for (const listener of listeners) {
      listener(next);
    }
  }

  function update(next: StateSnapshot) {
    if (snapshot.phase === next.phase && snapshot.holdAvailable === next.holdAvailable) {
      return;
    }
    snapshot = next;
    emit(snapshot);
  }

  return {
    dispatch(event: StateEvent) {
      const current = snapshot;
      let next = current;

      switch (event.type) {
        case 'start':
          if (current.phase === 'ready') {
            next = {
              phase: 'playing',
              holdAvailable: true,
            };
          }
          break;
        case 'pause':
          if (current.phase === 'playing') {
            next = {
              ...current,
              phase: 'paused',
            };
          }
          break;
        case 'resume':
          if (current.phase === 'paused') {
            next = {
              ...current,
              phase: 'playing',
            };
          }
          break;
        case 'gameOver':
          if (current.phase !== 'gameOver') {
            next = {
              phase: 'gameOver',
              holdAvailable: false,
            };
          }
          break;
        case 'useHold':
          if (current.phase === 'playing' && current.holdAvailable) {
            next = {
              ...current,
              holdAvailable: false,
            };
          }
          break;
        case 'lock':
          if (current.phase === 'playing' && !current.holdAvailable) {
            next = {
              ...current,
              holdAvailable: true,
            };
          }
          break;
        default:
          break;
      }

      update(next);
    },
    getSnapshot() {
      return snapshot;
    },
    canHold() {
      return snapshot.holdAvailable;
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
  };
}
