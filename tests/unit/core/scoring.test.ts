import { describe, expect, it } from 'vitest';

import {
  applyHardDrop,
  applyLineClear,
  applySoftDrop,
  createInitialStats,
  type GameStats,
} from '../../../src/core/scoring';

describe('scoring line clears', () => {
  it('awards points for single, double, triple, and tetris clears based on current level', () => {
    let stats = createInitialStats();

    stats = applyLineClear(stats, 1);
    expect(stats.score).toBe(100);
    expect(stats.lines).toBe(1);
    expect(stats.level).toBe(0);

    const afterDouble = applyLineClear(stats, 2);
    expect(afterDouble.score).toBe(100 + 300);
    expect(afterDouble.lines).toBe(3);
    expect(afterDouble.level).toBe(0);

    const afterTriple = applyLineClear(afterDouble, 3);
    expect(afterTriple.score).toBe(100 + 300 + 500);
    expect(afterTriple.lines).toBe(6);

    const afterTetris = applyLineClear(afterTriple, 4);
    expect(afterTetris.score).toBe(100 + 300 + 500 + 800);
    expect(afterTetris.lines).toBe(10);
  });

  it('increments level every 10 cleared lines and uses new level for subsequent scoring', () => {
    let stats = createInitialStats();

    stats = applyLineClear(stats, 4);
    stats = applyLineClear(stats, 4);
    stats = applyLineClear(stats, 2);

    expect(stats.lines).toBe(10);
    expect(stats.level).toBe(1);

    const next = applyLineClear(stats, 1);
    expect(next.score - stats.score).toBe(100 * (stats.level + 1));
    expect(next.level).toBe(1);
  });
});

describe('drop scoring', () => {
  it('adds soft drop score and accumulates drop distance', () => {
    const initial = createInitialStats();
    const next = applySoftDrop(initial, 5);

    expect(next.score).toBe(5);
    expect(next.dropDistanceSoft).toBe(5);
    expect(initial.dropDistanceSoft).toBe(0);
  });

  it('adds hard drop score and accumulates drop distance', () => {
    const initial = createInitialStats();
    const next = applyHardDrop(initial, 7);

    expect(next.score).toBe(14);
    expect(next.dropDistanceHard).toBe(7);
    expect(initial.dropDistanceHard).toBe(0);
  });
});
