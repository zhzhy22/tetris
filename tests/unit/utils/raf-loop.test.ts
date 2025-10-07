import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRafLoop, type FrameEvent } from '../../../src/utils/raf-loop';

type FrameCallback = Parameters<typeof requestAnimationFrame>[0];

describe('createRafLoop', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  let pendingCallback: FrameCallback | null;
  let nextHandle: number;

  beforeEach(() => {
    pendingCallback = null;
    nextHandle = 1;

    globalThis.requestAnimationFrame = (callback: FrameCallback) => {
      pendingCallback = callback;
      return nextHandle++;
    };

    globalThis.cancelAnimationFrame = () => {
      pendingCallback = null;
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  function runFrame(timestamp: number) {
    if (!pendingCallback) {
      throw new Error('No frame scheduled');
    }
    const callback = pendingCallback;
    pendingCallback = null;
    callback(timestamp);
  }

  it('emits delta time for successive frames and allows unsubscribe', () => {
    const loop = createRafLoop();
    const deltas: number[] = [];

    const unsubscribe = loop.subscribe((event: FrameEvent) => {
      deltas.push(event.deltaMs);
    });

    loop.start();

    runFrame(0);
    runFrame(16);
    runFrame(33.5);

    unsubscribe();
    expect(() => runFrame(50)).toThrowError(/No frame scheduled/);

    expect(deltas.length).toBe(3);
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(16, 5);
    expect(deltas[2]).toBeCloseTo(17.5, 5);

    const state = loop.getSnapshot();
    expect(state.running).toBe(true);
    expect(state.paused).toBe(false);
  });

  it('supports pause and resume without accumulating delta drift', () => {
    const loop = createRafLoop();
    const deltas: number[] = [];

    loop.subscribe((event: FrameEvent) => {
      deltas.push(event.deltaMs);
    });

    loop.start();
    runFrame(5);
    runFrame(21);

    loop.pause();
    expect(loop.getSnapshot().paused).toBe(true);
    expect(pendingCallback).toBeNull();

    loop.resume();
    expect(loop.getSnapshot().paused).toBe(false);

    runFrame(100);
    runFrame(116);

    expect(deltas).toHaveLength(4);
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(16, 5);
    expect(deltas[2]).toBe(0);
    expect(deltas[3]).toBeCloseTo(16, 5);
  });

  it('stop resets running state and prevents further frames', () => {
    const loop = createRafLoop();
    const deltas: number[] = [];

    loop.subscribe((event: FrameEvent) => {
      deltas.push(event.deltaMs);
    });

    loop.start();
    runFrame(0);

    loop.stop();
    expect(loop.getSnapshot().running).toBe(false);
    expect(loop.getSnapshot().paused).toBe(false);
    expect(pendingCallback).toBeNull();

    expect(() => runFrame(16)).toThrowError(/No frame scheduled/);
    expect(deltas.length).toBe(1);
  });
});
