import type { GameSessionState } from '../core/game-loop';

export interface DebugOverlayOptions {
  mount: HTMLElement;
  sampleSize?: number;
}

export interface DebugOverlayInstance {
  recordFrame(deltaMs: number): void;
  update(state: GameSessionState): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

interface MetricElements {
  fps: HTMLElement;
  frame: HTMLElement;
  gravity: HTMLElement;
  lock: HTMLElement;
  phase: HTMLElement;
  level: HTMLElement;
}

export function createDebugOverlay(options: DebugOverlayOptions): DebugOverlayInstance {
  const { mount } = options;
  if (!mount) {
    throw new Error('Debug overlay mount element is required');
  }

  const root = document.createElement('section');
  root.className = 'debug-overlay';
  root.dataset.testid = 'debug-overlay';
  root.setAttribute('role', 'complementary');
  root.setAttribute('aria-label', 'Debug metrics');
  root.setAttribute('data-visible', 'false');
  root.hidden = true;

  const title = document.createElement('h3');
  title.className = 'debug-overlay__title';
  title.textContent = 'Debug Overlay';
  root.appendChild(title);

  const list = document.createElement('dl');
  list.className = 'debug-overlay__metrics';
  root.appendChild(list);

  const metrics: MetricElements = {
    fps: createMetric(list, 'FPS', 'debug-overlay-fps'),
    frame: createMetric(list, 'Frame (ms)', 'debug-overlay-frame'),
    gravity: createMetric(list, 'Gravity step', 'debug-overlay-gravity'),
    lock: createMetric(list, 'Lock delay', 'debug-overlay-lock'),
    phase: createMetric(list, 'Phase', 'debug-overlay-phase'),
    level: createMetric(list, 'Level', 'debug-overlay-level'),
  };

  const maxSamples = Math.max(1, options.sampleSize ?? 60);
  const frameSamples: number[] = [];
  let frameSum = 0;
  let lastDelta = 0;
  let attached = false;

  metrics.gravity.textContent = '0 ms';
  metrics.lock.textContent = 'Idle';
  metrics.phase.textContent = 'ready';
  metrics.level.textContent = '0';

  function updateFrameMetrics() {
    const sampleCount = frameSamples.length;
    const averageDelta = sampleCount === 0 ? 0 : frameSum / sampleCount;
    const fps = averageDelta > 0 ? 1000 / averageDelta : 0;
    metrics.fps.textContent = fps.toFixed(1);
    metrics.frame.textContent = lastDelta > 0 ? lastDelta.toFixed(2) : '0.00';
  }

  function recordFrame(deltaMs: number) {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      return;
    }
    lastDelta = deltaMs;
    if (deltaMs === 0) {
      updateFrameMetrics();
      return;
    }
    frameSamples.push(deltaMs);
    frameSum += deltaMs;
    if (frameSamples.length > maxSamples) {
      const removed = frameSamples.shift();
      if (typeof removed === 'number') {
        frameSum -= removed;
      }
    }
    updateFrameMetrics();
  }

  function updateLock(state: GameSessionState) {
    const { lock, speed } = state;
    if (!lock.isLocking) {
      metrics.lock.textContent = 'Idle';
      return;
    }
    const elapsedMs = Math.max(0, Math.round(lock.elapsedMs));
    const totalMs = Math.max(0, Math.round(speed.lockDelayMs));
    const lockFrames = Math.max(0, lock.frames);
    metrics.lock.textContent = `Locking ${elapsedMs} / ${totalMs} ms (${lockFrames} frames)`;
  }

  function update(state: GameSessionState) {
    metrics.gravity.textContent = `${Math.max(0, Math.round(state.speed.gravityMs))} ms`;
    metrics.phase.textContent = state.phase;
    metrics.level.textContent = Math.max(0, state.stats.level).toString();
    updateLock(state);
  }

  function setVisible(visible: boolean) {
    const flag = visible ? 'true' : 'false';
    root.setAttribute('data-visible', flag);
    if (visible) {
      if (!attached) {
        mount.appendChild(root);
        attached = true;
      }
      root.hidden = false;
    } else {
      root.hidden = true;
      if (attached && root.parentElement === mount) {
        mount.removeChild(root);
      }
      attached = false;
    }
  }

  function destroy() {
    if (attached && root.parentElement === mount) {
      mount.removeChild(root);
    }
    attached = false;
  }

  updateFrameMetrics();

  return {
    recordFrame,
    update,
    setVisible,
    destroy,
  };
}

function createMetric(list: HTMLElement, label: string, testId: string): HTMLElement {
  const term = document.createElement('dt');
  term.className = 'debug-overlay__metric-label';
  term.textContent = label;

  const value = document.createElement('dd');
  value.className = 'debug-overlay__metric-value';
  value.dataset.testid = testId;
  value.textContent = '0';

  list.append(term, value);
  return value;
}
