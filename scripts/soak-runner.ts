#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createGameLoop,
  type GameLoop,
  type GameSessionState,
} from '../src/core/game-loop';
import { getPieceShape } from '../src/core/srs';

import type { Board } from '../src/core/collision';

interface SoakConfig {
  durationMs: number;
  frameMs: number;
  reportDir: string;
  seed?: string;
  startLevel: number;
  restartHeight: number;
  maxRestarts: number;
  logIntervalMs: number;
}

interface SoakMetrics {
  frames: number;
  simulatedMs: number;
  piecesPlaced: number;
  restarts: number;
  moves: number;
  rotations: number;
  hardDrops: number;
  planBuilds: number;
  planFailures: number;
  maxHeight: number;
  maxLockMs: number;
  maxLockFrames: number;
  peakRss: number;
  peakHeapUsed: number;
  peakExternal: number;
  progress: Array<{
    simulatedMs: number;
    lines: number;
    level: number;
    score: number;
    piecesPlaced: number;
    restarts: number;
  }>;
}

interface SoakReport {
  timestamp: string;
  config: SoakConfig & { rootDir: string };
  summary: {
    simulatedMinutes: number;
    simulatedMs: number;
    realDurationMs: number;
    framesSimulated: number;
    piecesPlaced: number;
    restarts: number;
    endedEarly: boolean;
    failureReason?: string;
  };
  game: {
    finalPhase: GameSessionState['phase'];
    score: number;
    lines: number;
    level: number;
    maxHeight: number;
    maxLockMs: number;
    maxLockFrames: number;
  };
  system: {
    peakRss: number;
    peakHeapUsed: number;
    peakExternal: number;
  };
  timeline: SoakMetrics['progress'];
  notes: string[];
}

interface PieceGoal {
  rotation: number;
  column: number;
  width: number;
}

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(rootDir: string): SoakConfig {
  const defaults: SoakConfig = {
    durationMs: 20 * 60 * 1000,
    frameMs: 1000 / 60,
    reportDir: resolve(rootDir, 'reports'),
    seed: undefined,
    startLevel: 0,
  restartHeight: 18,
  maxRestarts: 300,
    logIntervalMs: 60_000,
  };

  const args = process.argv.slice(2);
  for (const raw of args) {
    if (raw === '--help' || raw === '-h') {
      printHelp();
      process.exit(0);
    }
    const match = /^--([^=]+)=(.+)$/.exec(raw);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    switch (key) {
      case 'duration':
        defaults.durationMs = parseDuration(value, defaults.durationMs);
        break;
      case 'frame':
        defaults.frameMs = parseDuration(value, defaults.frameMs);
        break;
      case 'seed':
        defaults.seed = value;
        break;
      case 'report-dir':
        defaults.reportDir = resolve(value);
        break;
      case 'restart-height':
        defaults.restartHeight = parseInt(value, 10) || defaults.restartHeight;
        break;
      case 'max-restarts':
        defaults.maxRestarts = Math.max(0, parseInt(value, 10) || defaults.maxRestarts);
        break;
      case 'log-interval':
        defaults.logIntervalMs = parseDuration(value, defaults.logIntervalMs);
        break;
      case 'start-level':
        defaults.startLevel = Math.max(0, parseInt(value, 10) || defaults.startLevel);
        break;
      default:
        break;
    }
  }

  return defaults;
}

function parseDuration(value: string, fallback: number): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith('ms')) {
    const parsed = Number(trimmed.slice(0, -2));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (trimmed.endsWith('s')) {
    const parsed = Number(trimmed.slice(0, -1));
    return Number.isFinite(parsed) ? parsed * 1000 : fallback;
  }
  if (trimmed.endsWith('m')) {
    const parsed = Number(trimmed.slice(0, -1));
    return Number.isFinite(parsed) ? parsed * 60_000 : fallback;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function printHelp(): void {
  console.log(`Usage: npm run soak [-- --option=value]

Options:
  --duration=<value>        Simulated duration (default: 20m). Accepts ms, s, m suffixes.
  --frame=<value>           Frame delta in ms (default: 16.6667ms).
  --seed=<hex>              Seed for seven-bag RNG (default: random).
  --report-dir=<path>       Output directory for JSON report (default: ./reports).
  --restart-height=<rows>   Trigger restart if stack exceeds this height (default: 18).
  --max-restarts=<count>    Maximum automatic restarts before failing (default: 300).
  --log-interval=<value>    Interval for progress logging (default: 1m).
  --start-level=<level>     Initial level for the session (default: 0).
`);
}

function computeColumnHeights(board: Board): number[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const heights = Array<number>(cols).fill(0);

  for (let col = 0; col < cols; col += 1) {
    let height = 0;
    for (let row = 0; row < rows; row += 1) {
      if (board[row][col]?.occupied) {
        height = rows - row;
        break;
      }
    }
    heights[col] = height;
  }

  return heights;
}

function computePeakHeight(board: Board): number {
  return computeColumnHeights(board).reduce((max, value) => Math.max(max, value), 0);
}

function determineGoal(
  state: GameSessionState,
  piecesPlaced: number,
  heights: number[],
): PieceGoal | null {
  if (!state.active) {
    return null;
  }

  const boardWidth = state.board[0]?.length ?? 10;
  const boardHeight = state.board.length;
  const piece = state.active;
  const rotations = [0, 1, 2, 3] as const;

  let bestRotation = piece.rotation;
  let bestWidth = Number.POSITIVE_INFINITY;

  for (const offset of rotations) {
    const targetRotation = (piece.rotation + offset) % 4 as typeof rotations[number];
    const shape = getPieceShape(piece.type, targetRotation);
    const width = shape[0]?.length ?? 0;
    if (width < bestWidth) {
      bestWidth = width;
      bestRotation = targetRotation;
    }
  }

  const shape = getPieceShape(piece.type, bestRotation);
  const targetWidth = shape[0]?.length ?? 0;
  const shapeHeight = shape.length;

  let bestColumn = piece.position.col;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let col = 0; col <= boardWidth - targetWidth; col += 1) {
    let segmentHeight = 0;
    for (let widthIndex = 0; widthIndex < targetWidth; widthIndex += 1) {
      segmentHeight = Math.max(segmentHeight, heights[col + widthIndex] ?? 0);
    }

    if (segmentHeight + shapeHeight > boardHeight) {
      continue;
    }

    const centerBias = Math.abs(col + targetWidth / 2 - boardWidth / 2);
    const score = segmentHeight * 10 + centerBias + (piecesPlaced % 5);

    if (score < bestScore) {
      bestScore = score;
      bestColumn = col;
    }
  }

  const clampedColumn = Math.min(Math.max(bestColumn, 0), Math.max(0, boardWidth - targetWidth));

  return {
    rotation: bestRotation,
    column: clampedColumn,
    width: Math.max(1, targetWidth),
  };
}

async function main(): Promise<void> {
  const config = parseArgs(ROOT_DIR);
  const metrics: SoakMetrics = {
    frames: 0,
    simulatedMs: 0,
    piecesPlaced: 0,
    restarts: 0,
    moves: 0,
    rotations: 0,
    hardDrops: 0,
    planBuilds: 0,
    planFailures: 0,
    maxHeight: 0,
    maxLockMs: 0,
    maxLockFrames: 0,
    peakRss: 0,
    peakHeapUsed: 0,
    peakExternal: 0,
    progress: [],
  };

  const reportNotes: string[] = [];

  const gameLoop: GameLoop = createGameLoop({
    seed: config.seed,
    initialLevel: config.startLevel,
  });

  let latestState: GameSessionState = gameLoop.getState();

  const unsubscribe = gameLoop.subscribe((snapshot) => {
    latestState = snapshot;
    metrics.maxHeight = Math.max(metrics.maxHeight, computePeakHeight(snapshot.board));
    metrics.maxLockMs = Math.max(metrics.maxLockMs, Math.round(snapshot.lock.elapsedMs));
    metrics.maxLockFrames = Math.max(metrics.maxLockFrames, snapshot.lock.frames);
    const memory = process.memoryUsage();
    metrics.peakRss = Math.max(metrics.peakRss, memory.rss);
    metrics.peakHeapUsed = Math.max(metrics.peakHeapUsed, memory.heapUsed);
    metrics.peakExternal = Math.max(metrics.peakExternal, memory.external);
  });

  gameLoop.start();

  const wallClockStart = Date.now();
  let failureReason: string | undefined;
  let currentGoal: PieceGoal | null = null;
  let justDropped = false;
  let moveStallCounter = 0;
  let nextLogAt = config.logIntervalMs;

  const notifyProgress = () => {
    console.log(
      `[soak] simulated ${(metrics.simulatedMs / 60_000).toFixed(2)} min | score ${latestState.stats.score} | lines ${latestState.stats.lines} | level ${latestState.stats.level} | restarts ${metrics.restarts}`,
    );
    metrics.progress.push({
      simulatedMs: metrics.simulatedMs,
      lines: latestState.stats.lines,
      level: latestState.stats.level,
      score: latestState.stats.score,
      piecesPlaced: metrics.piecesPlaced,
      restarts: metrics.restarts,
    });
  };

  while (metrics.simulatedMs < config.durationMs) {
    if (latestState.phase === 'ready') {
      gameLoop.start();
      currentGoal = null;
      justDropped = false;
      moveStallCounter = 0;
    }

    if (latestState.phase === 'paused') {
      gameLoop.applyInput({ type: 'resume' });
    }

    if (latestState.phase === 'gameOver') {
      metrics.restarts += 1;
      if (metrics.restarts > config.maxRestarts) {
        failureReason = `Exceeded maximum restarts (${config.maxRestarts})`;
        break;
      }
      reportNotes.push(`Restart triggered after ${metrics.simulatedMs}ms simulated time`);
      gameLoop.stop();
      currentGoal = null;
      justDropped = false;
      moveStallCounter = 0;
      gameLoop.start();
      continue;
    }

  const heights = computeColumnHeights(latestState.board);
  const peakHeight = heights.length > 0 ? Math.max(...heights) : 0;

    if (peakHeight >= config.restartHeight) {
      metrics.restarts += 1;
      reportNotes.push(
        `Restart due to stack height ${peakHeight} at ${(metrics.simulatedMs / 1000).toFixed(1)}s`,
      );
      if (metrics.restarts > config.maxRestarts) {
        failureReason = `Exceeded maximum restarts (${config.maxRestarts})`;
        break;
      }
      gameLoop.stop();
      currentGoal = null;
      justDropped = false;
      moveStallCounter = 0;
      gameLoop.start();
      continue;
    }

    if (!justDropped && latestState.phase === 'playing' && latestState.active) {
      if (!currentGoal) {
        currentGoal = determineGoal(latestState, metrics.piecesPlaced, heights);
        if (currentGoal) {
          metrics.planBuilds += 1;
        } else {
          metrics.planFailures += 1;
        }
      }

      if (currentGoal) {
        const piece = latestState.active;
        const boardWidth = latestState.board[0]?.length ?? 10;
        const targetColumn = Math.min(
          Math.max(currentGoal.column, 0),
          Math.max(0, boardWidth - currentGoal.width),
        );

        if (piece.rotation !== currentGoal.rotation) {
          gameLoop.applyInput({ type: 'rotate', direction: 'cw' });
          metrics.rotations += 1;
        } else if (piece.position.col < targetColumn) {
          const before = piece.position.col;
          gameLoop.applyInput({ type: 'move', direction: 'right', repeat: false });
          const after = latestState.active?.position.col ?? before;
          metrics.moves += 1;
          moveStallCounter = after === before ? moveStallCounter + 1 : 0;
        } else if (piece.position.col > targetColumn) {
          const before = piece.position.col;
          gameLoop.applyInput({ type: 'move', direction: 'left', repeat: false });
          const after = latestState.active?.position.col ?? before;
          metrics.moves += 1;
          moveStallCounter = after === before ? moveStallCounter + 1 : 0;
        } else {
          gameLoop.applyInput({ type: 'hardDrop' });
          metrics.hardDrops += 1;
          metrics.piecesPlaced += 1;
          justDropped = true;
          currentGoal = null;
          moveStallCounter = 0;
        }

        if (moveStallCounter >= 4) {
          reportNotes.push(
            `Forced drop due to horizontal stall at ${(metrics.simulatedMs / 1000).toFixed(2)}s`,
          );
          gameLoop.applyInput({ type: 'hardDrop' });
          metrics.hardDrops += 1;
          metrics.piecesPlaced += 1;
          justDropped = true;
          currentGoal = null;
          moveStallCounter = 0;
        }
      }
    }

    gameLoop.tick(config.frameMs);
    metrics.frames += 1;
    metrics.simulatedMs += config.frameMs;

    if (justDropped) {
      justDropped = false;
    }

    if (metrics.simulatedMs >= nextLogAt) {
      notifyProgress();
      nextLogAt += config.logIntervalMs;
    }
  }

  const realDurationMs = Date.now() - wallClockStart;

  if (!failureReason && metrics.simulatedMs < config.durationMs) {
    failureReason = 'Simulation ended before reaching target duration';
  }

  if (!failureReason) {
    notifyProgress();
  }

  unsubscribe();

  const report: SoakReport = {
    timestamp: new Date().toISOString(),
    config: { ...config, rootDir: ROOT_DIR },
    summary: {
      simulatedMinutes: metrics.simulatedMs / 60_000,
      simulatedMs: metrics.simulatedMs,
      realDurationMs,
      framesSimulated: metrics.frames,
      piecesPlaced: metrics.piecesPlaced,
      restarts: metrics.restarts,
      endedEarly: Boolean(failureReason),
      failureReason,
    },
    game: {
      finalPhase: latestState.phase,
      score: latestState.stats.score,
      lines: latestState.stats.lines,
      level: latestState.stats.level,
      maxHeight: metrics.maxHeight,
      maxLockMs: metrics.maxLockMs,
      maxLockFrames: metrics.maxLockFrames,
    },
    system: {
      peakRss: metrics.peakRss,
      peakHeapUsed: metrics.peakHeapUsed,
      peakExternal: metrics.peakExternal,
    },
    timeline: metrics.progress,
    notes: reportNotes,
  };

  await mkdir(config.reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = resolve(config.reportDir, `soak-${timestamp}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  if (failureReason) {
    console.error(`\n[soak] FAILED: ${failureReason}`);
    console.error(`Report written to ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  console.log('\n[soak] SUCCESS');
  console.log(`Simulated ${(metrics.simulatedMs / 60_000).toFixed(2)} minutes in ${
    realDurationMs / 1000
  }s (wall clock)`);
  console.log(`Pieces placed: ${metrics.piecesPlaced} | Restarts: ${metrics.restarts}`);
  console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
  console.error('[soak] Unexpected error:', error);
  process.exitCode = 1;
});
