import { getPieceShape, type PieceState } from '../core/srs';
import type { Board } from '../core/board';
import type { TetrominoType } from '../core/rng';

export interface RenderSnapshot {
  board: Board;
  active: PieceState | null;
  ghost: { row: number; col: number } | null;
  nextQueue: TetrominoType[];
  hold: TetrominoType | null;
  effects?: {
    lineClearRows?: number[];
    warning?: boolean;
  };
}

export interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  dpr?: number;
  theme: 'default' | 'high-contrast';
}

export interface CanvasRenderer {
  init(options: CanvasRendererOptions): void;
  resize(width: number, height: number): void;
  render(snapshot: RenderSnapshot): void;
  destroy(): void;
}

type ThemeName = 'default' | 'high-contrast';

type CellKind =
  | { type: 'empty' }
  | { type: 'board'; piece: TetrominoType }
  | { type: 'active'; piece: TetrominoType }
  | { type: 'ghost'; piece: TetrominoType }
  | { type: 'lineClear'; piece: TetrominoType | null };

interface ThemePalette {
  background: string;
  grid: string;
  ghost: string;
  warning: string;
  pieces: Record<TetrominoType, string>;
}

const PALETTES: Record<ThemeName, ThemePalette> = {
  default: {
    background: '#0f172a',
    grid: '#1f2937',
    ghost: 'rgba(255,255,255,0.35)',
    warning: '#fbbf24',
    pieces: {
      I: '#00f0f0',
      O: '#f7d308',
      T: '#a000f0',
      S: '#00f000',
      Z: '#f00000',
      J: '#0000f0',
      L: '#f0a000',
    },
  },
  'high-contrast': {
    background: '#000000',
    grid: '#ffffff',
    ghost: 'rgba(255,255,255,0.5)',
    warning: '#ffffff',
    pieces: {
      I: '#00ffff',
      O: '#ffff00',
      T: '#ff00ff',
      S: '#00ff00',
      Z: '#ff0000',
      J: '#0000ff',
      L: '#ff8800',
    },
  },
};

interface InternalState {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  dpr: number;
  theme: ThemeName;
  logicalWidth: number;
  logicalHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  rowSignatures: string[];
  scaled: boolean;
}

function ensureContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context unavailable');
  }
  return context;
}

function clampDpr(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 1;
  }
  return Math.max(1, Math.min(4, value));
}

function createCellGrid(height: number, width: number): CellKind[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'empty' as const })),
  );
}

function applyBoard(grid: CellKind[][], board: Board) {
  for (let row = 0; row < board.length; row += 1) {
    const cols = board[row];
    for (let col = 0; col < cols.length; col += 1) {
      const cell = cols[col];
      if (!cell.occupied || !isTetrominoType(cell.type)) {
        continue;
      }
      grid[row][col] = { type: 'board', piece: cell.type };
    }
  }
}

function applyPiece(grid: CellKind[][], piece: PieceState, kind: 'active' | 'ghost') {
  const shape = getPieceShape(piece.type, piece.rotation);
  for (let r = 0; r < shape.length; r += 1) {
    for (let c = 0; c < shape[r].length; c += 1) {
      if (!shape[r][c]) {
        continue;
      }
      const row = piece.position.row + r;
      const col = piece.position.col + c;
      if (row < 0 || row >= grid.length || col < 0 || col >= grid[row].length) {
        continue;
      }
      if (kind === 'ghost') {
        if (grid[row][col].type === 'empty' || grid[row][col].type === 'lineClear') {
          grid[row][col] = { type: 'ghost', piece: piece.type };
        }
      } else {
        grid[row][col] = { type: 'active', piece: piece.type };
      }
    }
  }
}

function applyLineClears(grid: CellKind[][], rows: number[]) {
  for (const row of rows) {
    if (row < 0 || row >= grid.length) {
      continue;
    }
    for (let col = 0; col < grid[row].length; col += 1) {
      const current = grid[row][col];
      grid[row][col] = { type: 'lineClear', piece: current.type === 'empty' ? null : 'I' };
    }
  }
}

function isTetrominoType(value: string | undefined): value is TetrominoType {
  return value === 'I' || value === 'O' || value === 'T' || value === 'S' || value === 'Z' || value === 'J' || value === 'L';
}

export function createCanvasRenderer(): CanvasRenderer {
  const state: InternalState = {
    canvas: null,
    ctx: null,
    dpr: 1,
    theme: 'default',
    logicalWidth: 10,
    logicalHeight: 20,
    pixelWidth: 10,
    pixelHeight: 20,
    rowSignatures: [],
    scaled: false,
  };

  function configureCanvas(ctx: CanvasRenderingContext2D) {
    if (!state.scaled) {
      ctx.scale(state.dpr, state.dpr);
      state.scaled = true;
    }
    ctx.imageSmoothingEnabled = false;
  }

  function updateCanvasSize(width: number, height: number) {
    if (!state.canvas || !state.ctx) {
      return;
    }
    state.pixelWidth = width;
    state.pixelHeight = height;
    state.canvas.width = Math.round(width * state.dpr);
    state.canvas.height = Math.round(height * state.dpr);
    (state.canvas.style as CSSStyleDeclaration).width = `${width}px`;
    (state.canvas.style as CSSStyleDeclaration).height = `${height}px`;
    state.scaled = false;
    configureCanvas(state.ctx);
  }

  function drawRow(
    ctx: CanvasRenderingContext2D,
    palette: ThemePalette,
    cells: CellKind[],
    rowIndex: number,
    cellWidth: number,
    cellHeight: number,
    boardWidth: number,
  ) {
    const y = rowIndex * cellHeight;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, y, boardWidth * cellWidth, cellHeight);

    for (let col = 0; col < cells.length; col += 1) {
      const cell = cells[col];
      const x = col * cellWidth;

      switch (cell.type) {
        case 'board':
        case 'active': {
          ctx.fillStyle = palette.pieces[cell.piece];
          ctx.fillRect(x, y, cellWidth, cellHeight);
          break;
        }
        case 'ghost': {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = palette.ghost;
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.restore();
          break;
        }
        case 'lineClear': {
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = palette.warning;
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.restore();
          break;
        }
        default:
          break;
      }
    }
  }

  function computeRowSignature(cells: CellKind[]): string {
    return cells
      .map((cell) => {
        switch (cell.type) {
          case 'board':
            return `b${cell.piece}`;
          case 'active':
            return `a${cell.piece}`;
          case 'ghost':
            return `g${cell.piece}`;
          case 'lineClear':
            return 'l';
          default:
            return '_';
        }
      })
      .join('');
  }

  function composeGrid(snapshot: RenderSnapshot): CellKind[][] {
    const boardHeight = snapshot.board.length;
    const boardWidth = boardHeight > 0 ? snapshot.board[0].length : 0;
    const grid = createCellGrid(boardHeight, boardWidth);

    applyBoard(grid, snapshot.board);
    if (snapshot.effects?.lineClearRows) {
      applyLineClears(grid, snapshot.effects.lineClearRows);
    }
    if (snapshot.ghost && snapshot.active) {
      const ghostPiece: PieceState = { ...snapshot.active, position: snapshot.ghost };
      applyPiece(grid, ghostPiece, 'ghost');
    }
    if (snapshot.active) {
      applyPiece(grid, snapshot.active, 'active');
    }

    return grid;
  }

  function renderSnapshot(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
    const palette = PALETTES[state.theme];
    const boardHeight = snapshot.board.length;
    const boardWidth = boardHeight > 0 ? snapshot.board[0].length : 0;

    if (boardHeight === 0 || boardWidth === 0) {
      return;
    }

    state.logicalWidth = boardWidth;
    state.logicalHeight = boardHeight;

    const cellWidth = state.pixelWidth / boardWidth;
    const cellHeight = state.pixelHeight / boardHeight;

    const grid = composeGrid(snapshot);
    const dirtyRows: number[] = [];

    for (let row = 0; row < grid.length; row += 1) {
      const signature = computeRowSignature(grid[row]);
      if (state.rowSignatures[row] !== signature) {
        dirtyRows.push(row);
        state.rowSignatures[row] = signature;
      }
    }

    if (dirtyRows.length === 0) {
      return;
    }

    for (const row of dirtyRows) {
      drawRow(ctx, palette, grid[row], row, cellWidth, cellHeight, boardWidth);
    }
  }

  return {
    init(options) {
      state.canvas = options.canvas;
      state.ctx = ensureContext(options.canvas);
      state.dpr = clampDpr(options.dpr ?? globalThis.devicePixelRatio ?? 1);
      state.theme = options.theme;
      state.rowSignatures = [];
      state.scaled = false;
      configureCanvas(state.ctx);
    },
    resize(width, height) {
      updateCanvasSize(width, height);
      state.rowSignatures = [];
    },
    render(snapshot) {
      if (!state.ctx || !state.canvas) {
        throw new Error('CanvasRenderer not initialized');
      }
      renderSnapshot(state.ctx, snapshot);
    },
    destroy() {
      state.canvas = null;
      state.ctx = null;
      state.rowSignatures = [];
      state.scaled = false;
    },
  };
}
