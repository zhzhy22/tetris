import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasRenderer, type CanvasRenderer } from '../../../src/render/canvas-renderer';
import { createEmptyBoard } from '../../../src/core/board';
import type { PieceState } from '../../../src/core/srs';
import type { TetrominoType } from '../../../src/core/rng';
import type { Board } from '../../../src/core/board';

type Operation =
  | { type: 'scale'; x: number; y: number }
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; fillStyle: string; alpha: number }
  | { type: 'clearRect'; x: number; y: number; w: number; h: number }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'setGlobalAlpha'; value: number };

class MockContext2D {
  public fillStyle = '#000000';
  public globalAlpha = 1;
  public operations: Operation[] = [];

  scale = vi.fn((x: number, y: number) => {
    this.operations.push({ type: 'scale', x, y });
  });

  setTransform = vi.fn();

  clearRect = vi.fn((x: number, y: number, w: number, h: number) => {
    this.operations.push({ type: 'clearRect', x, y, w, h });
  });

  fillRect = vi.fn((x: number, y: number, w: number, h: number) => {
    this.operations.push({
      type: 'fillRect',
      x,
      y,
      w,
      h,
      fillStyle: this.fillStyle,
      alpha: this.globalAlpha,
    });
  });

  save = vi.fn(() => {
    this.operations.push({ type: 'save' });
  });

  restore = vi.fn(() => {
    this.operations.push({ type: 'restore' });
  });

  beginPath = vi.fn();
  closePath = vi.fn();
  strokeRect = vi.fn();
  translate = vi.fn();
  lineWidth = 1;

  get globalCompositeOperation(): string {
    return 'source-over';
  }

  set globalCompositeOperation(_value: string) {
    // noop for tests
  }

  setGlobalAlpha(value: number) {
    this.globalAlpha = value;
    this.operations.push({ type: 'setGlobalAlpha', value });
  }

  takeOperations(): Operation[] {
    const ops = [...this.operations];
    this.operations.length = 0;
    return ops;
  }
}

interface MockCanvas {
  canvas: HTMLCanvasElement;
  context: MockContext2D;
}

function createMockCanvas(): MockCanvas {
  const context = new MockContext2D();
  const style: Record<string, string> = { width: '', height: '' };
  const canvas = {
    width: 0,
    height: 0,
    style,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement;
  return { canvas, context };
}

function createSnapshot(board: Board, active: PieceState | null = null) {
  return {
    board,
    active,
    ghost: null,
    nextQueue: ['I', 'O', 'T'] as TetrominoType[],
    hold: null as TetrominoType | null,
    effects: {},
  };
}

describe('render/canvas-renderer', () => {
  let renderer: CanvasRenderer;
  let mock: MockCanvas;

  beforeEach(() => {
    mock = createMockCanvas();
    renderer = createCanvasRenderer();
  });

  afterEach(() => {
    renderer.destroy();
  });

  it('initializes canvas with DPR-aware scaling', () => {
    renderer.init({ canvas: mock.canvas, dpr: 2, theme: 'default' });
    renderer.resize(200, 400);

    expect(mock.canvas.width).toBe(400);
    expect(mock.canvas.height).toBe(800);
    expect(mock.canvas.style.width).toBe('200px');
    expect(mock.canvas.style.height).toBe('400px');

    expect(mock.context.scale).toHaveBeenCalledTimes(2);
    expect(mock.context.scale).toHaveBeenLastCalledWith(2, 2);
  });

  it('reapplies DPR scaling when resized after initialization', () => {
    renderer.init({ canvas: mock.canvas, dpr: 2, theme: 'default' });
    renderer.resize(200, 400);
    mock.context.scale.mockClear();

    renderer.resize(150, 300);

    expect(mock.context.scale).toHaveBeenCalledTimes(1);
    expect(mock.context.scale).toHaveBeenCalledWith(2, 2);
  });

  it('renders active pieces and ghost using board coordinates', () => {
    renderer.init({ canvas: mock.canvas, dpr: 1, theme: 'default' });
    renderer.resize(100, 60);

    const board = createEmptyBoard(6, 5);
    board[5][2].occupied = true;
    board[5][2].type = 'T';

    const active: PieceState = {
      type: 'O',
      rotation: 0,
      position: { row: 2, col: 1 },
    };

    const snapshot = {
      ...createSnapshot(board, active),
      ghost: { row: 4, col: 1 },
    };

    renderer.render(snapshot);
    const ops = mock.context.takeOperations();

    const fillOps = ops.filter((op) => op.type === 'fillRect');
    const activeOps = fillOps.filter((op) => op.fillStyle === '#f7d308');
    expect(activeOps).toHaveLength(4);

    const positions = activeOps
      .map((op) => ({ x: op.x, y: op.y }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    expect(positions).toEqual([
      { x: 20, y: 20 },
      { x: 40, y: 20 },
      { x: 20, y: 30 },
      { x: 40, y: 30 },
    ]);

    const ghostOp = fillOps.find((op) => op.fillStyle === 'rgba(255,255,255,0.35)');
    expect(ghostOp).toBeTruthy();
    expect(ghostOp?.x).toBe(20);
    expect(ghostOp?.y).toBe(40);

    const boardOp = fillOps.find((op) => op.fillStyle === '#a000f0');
    expect(boardOp).toBeTruthy();
    expect(boardOp?.x).toBe(40);
    expect(boardOp?.y).toBe(50);
  });

  it('updates only dirty rows between renders', () => {
    renderer.init({ canvas: mock.canvas, dpr: 1, theme: 'default' });
    renderer.resize(100, 60);

    const board = createEmptyBoard(6, 5);
    const active: PieceState = {
      type: 'O',
      rotation: 0,
      position: { row: 2, col: 1 },
    };
    const snapshot = {
      ...createSnapshot(board, active),
      ghost: { row: 4, col: 1 },
    };

    renderer.render(snapshot);
    mock.context.takeOperations();

    renderer.render(snapshot);
    const secondOps = mock.context.takeOperations();

    expect(secondOps.filter((op) => op.type === 'fillRect')).toHaveLength(0);
    expect(secondOps.filter((op) => op.type === 'clearRect')).toHaveLength(0);
  });

  it('does not render a ghost when no active piece exists', () => {
    renderer.init({ canvas: mock.canvas, dpr: 1, theme: 'default' });
    renderer.resize(100, 60);

    const board = createEmptyBoard(6, 5);
    const snapshot = {
      ...createSnapshot(board, null),
      ghost: { row: 2, col: 2 },
    };

    renderer.render(snapshot);
    const ops = mock.context.takeOperations();

    const ghostOps = ops.filter(
      (op) => op.type === 'fillRect' && op.fillStyle === 'rgba(255,255,255,0.35)',
    );
    expect(ghostOps).toHaveLength(0);
  });
});
