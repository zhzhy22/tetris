export interface FrameEvent {
  time: number;
  deltaMs: number;
  frame: number;
}

export interface RafLoopSnapshot {
  running: boolean;
  paused: boolean;
  frame: number;
}

export interface RafLoop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  subscribe(listener: (event: FrameEvent) => void): () => void;
  getSnapshot(): RafLoopSnapshot;
}

export function createRafLoop(): RafLoop {
  const listeners = new Set<(event: FrameEvent) => void>();

  let running = false;
  let paused = false;
  let frame = 0;
  let frameHandle: number | null = null;
  let lastTimestamp: number | null = null;

  const dispatch = (event: FrameEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const cancelScheduledFrame = () => {
    if (frameHandle !== null) {
      cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
  };

  const scheduleNextFrame = () => {
    if (frameHandle !== null || !running || paused || listeners.size === 0) {
      return;
    }
    frameHandle = requestAnimationFrame(handleFrame);
  };

  const handleFrame = (timestamp: number) => {
    frameHandle = null;

    if (!running || paused || listeners.size === 0) {
      lastTimestamp = null;
      scheduleNextFrame();
      return;
    }

    const delta = lastTimestamp === null ? 0 : Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    frame += 1;

    dispatch({ time: timestamp, deltaMs: delta, frame });

    scheduleNextFrame();
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      paused = false;
      frame = 0;
      lastTimestamp = null;
      scheduleNextFrame();
    },
    stop() {
      if (!running) {
        return;
      }
      cancelScheduledFrame();
      running = false;
      paused = false;
      frame = 0;
      lastTimestamp = null;
    },
    pause() {
      if (!running || paused) {
        return;
      }
      paused = true;
      lastTimestamp = null;
      cancelScheduledFrame();
    },
    resume() {
      if (!running || !paused) {
        return;
      }
      paused = false;
      lastTimestamp = null;
      scheduleNextFrame();
    },
    subscribe(listener) {
      listeners.add(listener);
      if (running && !paused) {
        scheduleNextFrame();
      }
      let active = true;
      return () => {
        if (!active) {
          return;
        }
        active = false;
        listeners.delete(listener);
        if (listeners.size === 0) {
          lastTimestamp = null;
          cancelScheduledFrame();
        }
      };
    },
    getSnapshot() {
      return {
        running,
        paused,
        frame,
      };
    },
  };
}
