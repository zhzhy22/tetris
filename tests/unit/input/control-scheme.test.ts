import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { type ControlInput } from '../../../src/core/game-loop';
import { createControlScheme, type ControlSchemeOptions } from '../../../src/input/control-scheme';
import { type FrameEvent, type RafLoop } from '../../../src/utils/raf-loop';

class StubRafLoop implements RafLoop {
  private listeners = new Set<(event: FrameEvent) => void>();
  private currentTime = 0;
  private frame = 0;

  start(): void {}
  stop(): void {}
  pause(): void {}
  resume(): void {}

  subscribe(listener: (event: FrameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    return {
      running: true,
      paused: false,
      frame: this.frame,
    };
  }

  emit(deltaMs: number) {
    this.currentTime += deltaMs;
    this.frame += 1;
    const event: FrameEvent = {
      deltaMs,
      time: this.currentTime,
      frame: this.frame,
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function ensurePointerEvent() {
  if (typeof window.PointerEvent === 'function') {
    return;
  }

  class FakePointerEvent extends Event {
    public readonly clientX: number;
    public readonly clientY: number;
    public readonly pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.clientX = init.clientX ?? 0;
      this.clientY = init.clientY ?? 0;
      this.pointerType = init.pointerType ?? 'touch';
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    value: FakePointerEvent,
  });
}

describe('input/control-scheme', () => {
  ensurePointerEvent();

  let rafLoop: StubRafLoop;
  let options: ControlSchemeOptions;

  beforeEach(() => {
    document.body.innerHTML = '';
    rafLoop = new StubRafLoop();
    options = {
      target: document.body,
      rafLoop,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('honors DAS/ARR thresholds for horizontal movement', () => {
    const scheme = createControlScheme(options);
    const inputs: ControlInput[] = [];
  const unsubscribe = scheme.subscribe((input: ControlInput) => inputs.push(input));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ type: 'move', direction: 'right', repeat: false });

    rafLoop.emit(100);
    expect(inputs).toHaveLength(1);

    rafLoop.emit(80);
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toMatchObject({ type: 'move', direction: 'right', repeat: true });

    rafLoop.emit(40);
    expect(inputs).toHaveLength(3);
    expect(inputs[2]).toMatchObject({ type: 'move', direction: 'right', repeat: true });

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    rafLoop.emit(200);
    expect(inputs).toHaveLength(3);

    unsubscribe();
    scheme.destroy();
  });

  it('emits soft drop every frame without ARR delay', () => {
    const scheme = createControlScheme(options);
    const inputs: ControlInput[] = [];
  const unsubscribe = scheme.subscribe((input: ControlInput) => inputs.push(input));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ type: 'softDrop', repeat: false });

    rafLoop.emit(16);
    rafLoop.emit(16);
    rafLoop.emit(16);

    expect(inputs).toHaveLength(4);
    expect(inputs.slice(1).every((input) => input.type === 'softDrop' && input.repeat === true)).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    rafLoop.emit(16);
    expect(inputs).toHaveLength(4);

    unsubscribe();
    scheme.destroy();
  });

  it('interprets touch gestures using configured thresholds', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);

    options = { ...options, target: surface };
    const scheme = createControlScheme(options);
    const inputs: ControlInput[] = [];
  const unsubscribe = scheme.subscribe((input: ControlInput) => inputs.push(input));

    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    // Horizontal swipe to the left
    now = 0;
    surface.dispatchEvent(new window.PointerEvent('pointerdown', {
      pointerType: 'touch',
      clientX: 50,
      clientY: 50,
      bubbles: true,
    }));

    now = 60;
    surface.dispatchEvent(new window.PointerEvent('pointermove', {
      pointerType: 'touch',
      clientX: 20,
      clientY: 52,
      bubbles: true,
    }));

    now = 90;
    surface.dispatchEvent(new window.PointerEvent('pointerup', {
      pointerType: 'touch',
      clientX: 20,
      clientY: 52,
      bubbles: true,
    }));

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ type: 'move', direction: 'left', repeat: false });

    inputs.length = 0;

    // Short swipe down triggers soft drop
    now = 0;
    surface.dispatchEvent(new window.PointerEvent('pointerdown', {
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
      bubbles: true,
    }));

    now = 100;
    surface.dispatchEvent(new window.PointerEvent('pointermove', {
      pointerType: 'touch',
      clientX: 5,
      clientY: 25,
      bubbles: true,
    }));

    now = 140;
    surface.dispatchEvent(new window.PointerEvent('pointerup', {
      pointerType: 'touch',
      clientX: 5,
      clientY: 25,
      bubbles: true,
    }));

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ type: 'softDrop', repeat: false });

    inputs.length = 0;

    // Long swipe down triggers hard drop
    now = 0;
    surface.dispatchEvent(new window.PointerEvent('pointerdown', {
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
      bubbles: true,
    }));

    now = 200;
    surface.dispatchEvent(new window.PointerEvent('pointermove', {
      pointerType: 'touch',
      clientX: -4,
      clientY: 60,
      bubbles: true,
    }));

    now = 210;
    surface.dispatchEvent(new window.PointerEvent('pointerup', {
      pointerType: 'touch',
      clientX: -4,
      clientY: 60,
      bubbles: true,
    }));

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ type: 'hardDrop' });

    unsubscribe();
    scheme.destroy();
  });
});
