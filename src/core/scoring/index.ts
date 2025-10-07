export interface GameStats {
  score: number;
  level: number;
  lines: number;
  dropDistanceSoft: number;
  dropDistanceHard: number;
}

export function createInitialStats(): GameStats {
  return {
    score: 0,
    level: 0,
    lines: 0,
    dropDistanceSoft: 0,
    dropDistanceHard: 0,
  };
}

const LINE_CLEAR_POINTS: Record<number, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

export function applyLineClear(stats: GameStats, linesCleared: number): GameStats {
  if (linesCleared <= 0) {
    return stats;
  }

  const basePoints = LINE_CLEAR_POINTS[linesCleared] ?? 0;
  const scoreDelta = basePoints * (stats.level + 1);
  const nextLines = stats.lines + linesCleared;
  const nextLevel = Math.floor(nextLines / 10);

  return {
    ...stats,
    score: stats.score + scoreDelta,
    lines: nextLines,
    level: nextLevel,
  };
}

export function applySoftDrop(stats: GameStats, cells: number): GameStats {
  if (cells <= 0) {
    return stats;
  }

  return {
    ...stats,
    score: stats.score + cells,
    dropDistanceSoft: stats.dropDistanceSoft + cells,
  };
}

export function applyHardDrop(stats: GameStats, cells: number): GameStats {
  if (cells <= 0) {
    return stats;
  }

  const hardDropPoints = cells * 2;

  return {
    ...stats,
    score: stats.score + hardDropPoints,
    dropDistanceHard: stats.dropDistanceHard + cells,
  };
}
