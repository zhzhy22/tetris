import type { ControlInput } from '../core/game-loop';
import { createRafLoop, type FrameEvent, type RafLoop } from '../utils/raf-loop';

export type ControlSchemeListener = (input: ControlInput) => void;

export interface ControlTuning {
  dasMs: number;
  arrMs: number;
  swipeThresholdPx: number;
  softDropDurationMs: number;
  hardDropDurationMs: number;
}

export interface ControlSchemeSnapshot {
  tuning: ControlTuning;
}

export interface ControlScheme {
  subscribe(listener: ControlSchemeListener): () => void;
  setTuning(tuning: Partial<ControlTuning>): void;
  resetTuning(): void;
  getSnapshot(): ControlSchemeSnapshot;
  destroy(): void;
}

export interface ControlSchemeOptions {
  target: HTMLElement | Document;
  rafLoop?: RafLoop;
  window?: Window;
  initialTuning?: Partial<ControlTuning>;
}

export const DEFAULT_CONTROL_TUNING: ControlTuning = {
  dasMs: 170,
  arrMs: 40,
  swipeThresholdPx: 15,
  softDropDurationMs: 150,
  hardDropDurationMs: 150,
};

export const CONTROL_TUNING_LIMITS = {
  dasMs: { min: 150, max: 220 },
  arrMs: { min: 30, max: 60 },
  swipeThresholdPx: { min: 10, max: 25 },
  softDropDurationMs: { min: 120, max: 200 },
  hardDropDurationMs: { min: 120, max: 200 },
} as const;

type MoveDirection = 'left' | 'right';

interface MoveState {
  pressed: boolean;
  dasElapsed: number;
  arrElapsed: number;
  dasTriggered: boolean;
}

interface SoftDropState {
  pressed: boolean;
}

interface PointerState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normaliseKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function createControlScheme(options: ControlSchemeOptions): ControlScheme {
  const target = options.target;
  const hostWindow = options.window ?? window;
  const keyboardTarget: Document | Window = options.window ?? (
    target instanceof Document ? target : target.ownerDocument ?? window
  );
  const pointerTarget: HTMLElement | Document = target instanceof Document
    ? target.body ?? hostWindow.document?.body ?? target
    : target;
  const ownsLoop = !options.rafLoop;
  const rafLoop = options.rafLoop ?? createRafLoop();

  let tuning: ControlTuning = {
    ...DEFAULT_CONTROL_TUNING,
    ...options.initialTuning,
  };

  const listeners = new Set<ControlSchemeListener>();
  const subscriptions: Array<() => void> = [];

  const moveState: Record<MoveDirection, MoveState> = {
    left: { pressed: false, dasElapsed: 0, arrElapsed: 0, dasTriggered: false },
    right: { pressed: false, dasElapsed: 0, arrElapsed: 0, dasTriggered: false },
  };

  const softDropState: SoftDropState = {
    pressed: false,
  };

  let pointerState: PointerState | null = null;

  const emit = (input: ControlInput) => {
    for (const listener of listeners) {
      listener(input);
    }
  };

  const updateMoveRepeat = (direction: MoveDirection, deltaMs: number) => {
    const state = moveState[direction];
    if (!state.pressed) {
      state.dasElapsed = 0;
      state.arrElapsed = 0;
      state.dasTriggered = false;
      return;
    }

    if (!state.dasTriggered) {
      state.dasElapsed += deltaMs;
      if (state.dasElapsed >= tuning.dasMs) {
        state.dasTriggered = true;
        state.arrElapsed = 0;
        emit({ type: 'move', direction, repeat: true });
      }
      return;
    }

    state.arrElapsed += deltaMs;
    while (state.arrElapsed >= tuning.arrMs) {
      state.arrElapsed -= tuning.arrMs;
      emit({ type: 'move', direction, repeat: true });
    }
  };

  const updateSoftDrop = (deltaMs: number) => {
    if (!softDropState.pressed) {
      return;
    }
    if (deltaMs <= 0) {
      return;
    }
    emit({ type: 'softDrop', repeat: true });
  };

  const onFrame = (event: FrameEvent) => {
    const delta = event.deltaMs;
    updateMoveRepeat('left', delta);
    updateMoveRepeat('right', delta);
    updateSoftDrop(delta);
  };

  const keydownListener = (event: KeyboardEvent) => {
    const key = normaliseKey(event.key);
    switch (key) {
      case 'ArrowLeft':
      case 'a':
        handleMoveKey(event, 'left');
        break;
      case 'ArrowRight':
      case 'd':
        handleMoveKey(event, 'right');
        break;
      case 'ArrowDown':
      case 's':
        handleSoftDropKey(event);
        break;
      case 'ArrowUp':
      case 'x':
        handleRotate(event, 'cw');
        break;
      case 'z':
        handleRotate(event, 'ccw');
        break;
      case ' ': // Space emits as ' '
      case 'Space':
        handleHardDrop(event);
        break;
      case 'Shift':
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'c':
        handleHold(event);
        break;
      case 'p':
      case 'Escape':
        handlePause(event);
        break;
      default:
        break;
    }
  };

  const keyupListener = (event: KeyboardEvent) => {
    const key = normaliseKey(event.key);
    switch (key) {
      case 'ArrowLeft':
      case 'a':
        releaseMove('left');
        break;
      case 'ArrowRight':
      case 'd':
        releaseMove('right');
        break;
      case 'ArrowDown':
      case 's':
        softDropState.pressed = false;
        break;
      default:
        break;
    }
  };

  const pointerDownListener = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    pointerState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startTime: performance.now(),
    };
  };

  const pointerMoveListener = (event: PointerEvent) => {
    if (!pointerState || event.pointerId !== pointerState.pointerId) {
      return;
    }
    pointerState.lastX = event.clientX;
    pointerState.lastY = event.clientY;
  };

  const pointerUpListener = (event: PointerEvent) => {
    if (!pointerState || event.pointerId !== pointerState.pointerId) {
      return;
    }

    const dx = pointerState.lastX - pointerState.startX;
    const dy = pointerState.lastY - pointerState.startY;
    const duration = performance.now() - pointerState.startTime;
    pointerState = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx >= tuning.swipeThresholdPx && absDy < 10) {
      emit({ type: 'move', direction: dx > 0 ? 'right' : 'left', repeat: false });
      return;
    }

    if (dy >= tuning.swipeThresholdPx) {
      if (dy >= 30 && duration >= tuning.hardDropDurationMs) {
        emit({ type: 'hardDrop' });
      } else if (duration < tuning.softDropDurationMs) {
        emit({ type: 'softDrop', repeat: false });
      }
      return;
    }

    if (dy <= -tuning.swipeThresholdPx && duration < 200) {
      emit({ type: 'rotate', direction: 'cw' });
    }
  };

  const handleMoveKey = (event: KeyboardEvent, direction: MoveDirection) => {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    const state = moveState[direction];
    if (!state.pressed) {
      state.pressed = true;
      state.dasElapsed = 0;
      state.arrElapsed = 0;
      state.dasTriggered = false;
      emit({ type: 'move', direction, repeat: false });
    }
  };

  const releaseMove = (direction: MoveDirection) => {
    const state = moveState[direction];
    state.pressed = false;
    state.dasElapsed = 0;
    state.arrElapsed = 0;
    state.dasTriggered = false;
  };

  const handleSoftDropKey = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    if (!softDropState.pressed) {
      softDropState.pressed = true;
      emit({ type: 'softDrop', repeat: false });
    }
  };

  const handleRotate = (event: KeyboardEvent, direction: 'cw' | 'ccw') => {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    emit({ type: 'rotate', direction });
  };

  const handleHardDrop = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    emit({ type: 'hardDrop' });
  };

  const handleHold = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    emit({ type: 'hold' });
  };

  const handlePause = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    emit({ type: 'pause' });
  };

  keyboardTarget.addEventListener('keydown', keydownListener as EventListener, { passive: false });
  keyboardTarget.addEventListener('keyup', keyupListener as EventListener, { passive: false });
  pointerTarget.addEventListener('pointerdown', pointerDownListener as EventListener, { passive: true });
  pointerTarget.addEventListener('pointermove', pointerMoveListener as EventListener, { passive: true });
  pointerTarget.addEventListener('pointerup', pointerUpListener as EventListener, { passive: true });

  subscriptions.push(() => keyboardTarget.removeEventListener('keydown', keydownListener as EventListener));
  subscriptions.push(() => keyboardTarget.removeEventListener('keyup', keyupListener as EventListener));
  subscriptions.push(() => pointerTarget.removeEventListener('pointerdown', pointerDownListener as EventListener));
  subscriptions.push(() => pointerTarget.removeEventListener('pointermove', pointerMoveListener as EventListener));
  subscriptions.push(() => pointerTarget.removeEventListener('pointerup', pointerUpListener as EventListener));

  const unsubscribeRaf = rafLoop.subscribe(onFrame);
  subscriptions.push(unsubscribeRaf);
  if (ownsLoop) {
    rafLoop.start();
  }

  const applyTuning = (partial: Partial<ControlTuning>) => {
    const updated: ControlTuning = { ...tuning };
    if (partial.dasMs !== undefined) {
  updated.dasMs = clamp(partial.dasMs, CONTROL_TUNING_LIMITS.dasMs.min, CONTROL_TUNING_LIMITS.dasMs.max);
    }
    if (partial.arrMs !== undefined) {
  updated.arrMs = clamp(partial.arrMs, CONTROL_TUNING_LIMITS.arrMs.min, CONTROL_TUNING_LIMITS.arrMs.max);
    }
    if (partial.swipeThresholdPx !== undefined) {
      updated.swipeThresholdPx = clamp(
        partial.swipeThresholdPx,
  CONTROL_TUNING_LIMITS.swipeThresholdPx.min,
  CONTROL_TUNING_LIMITS.swipeThresholdPx.max,
      );
    }
    if (partial.softDropDurationMs !== undefined) {
      updated.softDropDurationMs = clamp(
        partial.softDropDurationMs,
  CONTROL_TUNING_LIMITS.softDropDurationMs.min,
  CONTROL_TUNING_LIMITS.softDropDurationMs.max,
      );
    }
    if (partial.hardDropDurationMs !== undefined) {
      updated.hardDropDurationMs = clamp(
        partial.hardDropDurationMs,
  CONTROL_TUNING_LIMITS.hardDropDurationMs.min,
  CONTROL_TUNING_LIMITS.hardDropDurationMs.max,
      );
    }
    tuning = updated;
    for (const direction of Object.keys(moveState) as MoveDirection[]) {
      const state = moveState[direction];
      state.dasElapsed = Math.min(state.dasElapsed, tuning.dasMs);
      state.arrElapsed = Math.min(state.arrElapsed, tuning.arrMs);
    }
  };

  return {
    subscribe(listener: ControlSchemeListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setTuning(partial: Partial<ControlTuning>) {
      applyTuning(partial);
    },
    resetTuning() {
  tuning = { ...DEFAULT_CONTROL_TUNING };
      for (const direction of Object.keys(moveState) as MoveDirection[]) {
        const state = moveState[direction];
        state.dasElapsed = 0;
        state.arrElapsed = 0;
        state.dasTriggered = false;
      }
    },
    getSnapshot() {
      return {
        tuning: { ...tuning },
      };
    },
    destroy() {
      for (const dispose of subscriptions.splice(0, subscriptions.length)) {
        dispose();
      }
      listeners.clear();
      pointerState = null;
      if (ownsLoop) {
        rafLoop.stop();
      }
      softDropState.pressed = false;
      for (const direction of Object.keys(moveState) as MoveDirection[]) {
        releaseMove(direction);
      }
    },
  };
}
