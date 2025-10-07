import type { GameSessionState } from '../core/game-loop';
import { getPieceShape } from '../core/srs';
import type { TetrominoType } from '../core/rng';

export interface HudOptions {
  mount: HTMLElement;
}

export interface HudInstance {
  update(snapshot: GameSessionState, extras?: HudUpdateOptions): void;
  destroy(): void;
}

export interface HudUpdateOptions {
  bestScore?: number;
}

const HOLD_GRID_SIZE = 4;
const NEXT_GRID_SIZE = 4;
const NEXT_VISIBLE_SLOTS = 3;

export function createHud(options: HudOptions): HudInstance {
  const { mount } = options;
  if (!mount) {
    throw new Error('HUD mount element is required');
  }

  const root = document.createElement('div');
  root.className = 'tetris-hud';
  mount.appendChild(root);

  const statsSection = document.createElement('section');
  statsSection.className = 'tetris-hud__section tetris-hud__section--stats';

  const scoreStat = createStat('Score', 'score-value');
  const bestStat = createStat('Best', 'best-value');
  const levelStat = createStat('Level', 'level-value');
  const linesStat = createStat('Lines', 'lines-value');
  const seedStat = createStat('Seed', 'seed-value');
  const statusStat = createStat('Status', 'status-value');

  statsSection.append(
    scoreStat.element,
    bestStat.element,
    levelStat.element,
    linesStat.element,
    seedStat.element,
    statusStat.element,
  );

  const holdSection = document.createElement('section');
  holdSection.className = 'tetris-hud__section tetris-hud__section--hold';

  const holdLabel = document.createElement('span');
  holdLabel.className = 'tetris-hud__label';
  holdLabel.textContent = 'Hold';

  const holdPreview = document.createElement('div');
  holdPreview.className = 'tetris-hud__hold-preview';
  holdPreview.dataset.testid = 'hold-preview';
  holdPreview.setAttribute('role', 'img');
  holdPreview.setAttribute('aria-label', 'Hold piece');
  holdPreview.setAttribute('aria-disabled', 'true');
  holdPreview.setAttribute('data-piece', 'none');
  holdPreview.setAttribute('data-used', 'true');

  const holdCells: HTMLElement[] = [];
  for (let row = 0; row < HOLD_GRID_SIZE; row += 1) {
    for (let col = 0; col < HOLD_GRID_SIZE; col += 1) {
      const cell = document.createElement('span');
      cell.className = 'tetris-hud__hold-cell';
      cell.dataset.role = 'hold-cell';
      cell.setAttribute('data-piece', 'none');
      holdPreview.appendChild(cell);
      holdCells.push(cell);
    }
  }

  holdSection.append(holdLabel, holdPreview);
  root.append(statsSection, holdSection);

  const nextSection = document.createElement('section');
  nextSection.className = 'tetris-hud__section tetris-hud__section--next';

  const nextLabel = document.createElement('span');
  nextLabel.className = 'tetris-hud__label';
  nextLabel.textContent = 'Next';
  nextSection.appendChild(nextLabel);

  const nextSlots: Array<{ slot: HTMLElement; cells: HTMLElement[] }> = [];
  for (let index = 0; index < NEXT_VISIBLE_SLOTS; index += 1) {
    const slot = document.createElement('div');
    slot.className = 'tetris-hud__next-slot';
    slot.dataset.testid = 'next-slot';
    slot.setAttribute('data-piece', 'none');
  slot.setAttribute('role', 'img');
    slot.setAttribute('aria-label', `Next piece ${index + 1}`);

    const cells = createPreviewGrid(slot, 'tetris-hud__next-cell', 'next-cell', NEXT_GRID_SIZE);
    nextSlots.push({ slot, cells });
    nextSection.appendChild(slot);
  }

  root.appendChild(nextSection);

  const liveRegion = document.createElement('div');
  liveRegion.className = 'tetris-hud__live';
  liveRegion.dataset.testid = 'hud-live';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');
  root.appendChild(liveRegion);

  let destroyed = false;

  let lastBestScore = 0;

  function updateStats(snapshot: GameSessionState, bestScore: number) {
    scoreStat.value.textContent = snapshot.stats.score.toString();
    bestStat.value.textContent = bestScore.toString();
    levelStat.value.textContent = snapshot.stats.level.toString();
    linesStat.value.textContent = snapshot.stats.lines.toString();
    seedStat.value.textContent = snapshot.seed;
    statusStat.value.textContent = mapPhaseToLabel(snapshot.phase);

    liveRegion.textContent = `Status ${statusStat.value.textContent}, Score ${scoreStat.value.textContent}, Best ${bestStat.value.textContent}, Level ${levelStat.value.textContent}, Lines ${linesStat.value.textContent}`;
  }

  function updateHold(snapshot: GameSessionState) {
    const piece = snapshot.hold;
    const used = snapshot.holdUsedThisTurn || snapshot.phase !== 'playing';

    holdPreview.setAttribute('data-piece', piece ?? 'none');
    holdPreview.setAttribute('data-used', used ? 'true' : 'false');
    holdPreview.setAttribute('aria-disabled', used ? 'true' : 'false');

    for (const cell of holdCells) {
      cell.setAttribute('data-piece', 'none');
    }

    if (!piece) {
      return;
    }

    renderPieceIntoGrid(piece, holdCells, HOLD_GRID_SIZE);
  }

  function updateNext(snapshot: GameSessionState) {
    const queue = snapshot.nextQueue ?? [];

    for (let index = 0; index < nextSlots.length; index += 1) {
      const piece = queue[index] ?? null;
      const slot = nextSlots[index];
      slot.slot.setAttribute('data-piece', piece ?? 'none');

      for (const cell of slot.cells) {
        cell.setAttribute('data-piece', 'none');
      }

      if (!piece) {
        continue;
      }

      renderPieceIntoGrid(piece, slot.cells, NEXT_GRID_SIZE);
    }
  }

  function update(snapshot: GameSessionState, extras?: HudUpdateOptions) {
    if (destroyed) {
      return;
    }
    if (typeof extras?.bestScore === 'number' && Number.isFinite(extras.bestScore)) {
      lastBestScore = Math.max(0, Math.floor(extras.bestScore));
    }
    updateStats(snapshot, lastBestScore);
    updateHold(snapshot);
    updateNext(snapshot);
  }

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    if (root.parentElement === mount) {
      mount.removeChild(root);
    }
  }

  return {
    update,
    destroy,
  };
}

function createStat(label: string, testId: string) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tetris-hud__stat';

  const labelElement = document.createElement('span');
  labelElement.className = 'tetris-hud__label';
  labelElement.textContent = label;

  const valueElement = document.createElement('span');
  valueElement.className = 'tetris-hud__value';
  valueElement.dataset.testid = testId;
  valueElement.textContent = '0';

  wrapper.append(labelElement, valueElement);

  return {
    element: wrapper,
    value: valueElement,
  };
}

function createPreviewGrid(
  mount: HTMLElement,
  cellClass: string,
  role: string,
  gridSize: number,
): HTMLElement[] {
  const cells: HTMLElement[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const cell = document.createElement('span');
      cell.className = cellClass;
      cell.dataset.role = role;
      cell.setAttribute('data-piece', 'none');
      mount.appendChild(cell);
      cells.push(cell);
    }
  }
  return cells;
}

function renderPieceIntoGrid(
  piece: TetrominoType,
  cells: HTMLElement[],
  gridSize: number,
) {
  const shape = getPieceShape(piece, 0);
  const height = shape.length;
  const width = shape[0]?.length ?? 0;
  const rowOffset = Math.max(0, Math.floor((gridSize - height) / 2));
  const colOffset = Math.max(0, Math.floor((gridSize - width) / 2));

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      if (!shape[row][col]) {
        continue;
      }

      const targetRow = rowOffset + row;
      const targetCol = colOffset + col;
      if (targetRow < 0 || targetRow >= gridSize || targetCol < 0 || targetCol >= gridSize) {
        continue;
      }

      const index = targetRow * gridSize + targetCol;
      const cell = cells[index];
      if (cell) {
        cell.setAttribute('data-piece', piece);
      }
    }
  }
}

function mapPhaseToLabel(phase: GameSessionState['phase']): string {
  switch (phase) {
    case 'playing':
      return 'Playing';
    case 'paused':
      return 'Paused';
    case 'gameOver':
      return 'Game Over';
    case 'ready':
    default:
      return 'Ready';
  }
}
