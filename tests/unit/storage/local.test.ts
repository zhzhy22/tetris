import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHighScoresStore,
  createSettingsStore,
  type HighScoreEntry,
  type StoredHighScoresPayload,
  type StoredSettingsPayload,
} from '../../../src/storage/local';
import type { Settings } from '../../../src/ui/settings-panel';
import type { ControlTuning } from '../../../src/input/control-scheme';

const defaultSettings: Settings = {
  soundEnabled: true,
  highContrast: false,
  showGhost: true,
  showDebugOverlay: false,
};

const defaultTuning: ControlTuning = {
  dasMs: 170,
  arrMs: 40,
  swipeThresholdPx: 15,
  softDropDurationMs: 150,
  hardDropDurationMs: 150,
};

describe('storage/local', () => {
  const storage = window.localStorage;
  const key = 'tetris:settings';

  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no settings are stored', async () => {
    const store = createSettingsStore({ storage, key });
    const result = await store.load();
    expect(result).toBeNull();
  });

  it('persists and restores settings payloads', async () => {
    const store = createSettingsStore({ storage, key });
    const payload: StoredSettingsPayload = {
      settings: { ...defaultSettings, soundEnabled: false },
      tuning: { ...defaultTuning, arrMs: 35 },
    };

    await store.save(payload);
    const raw = storage.getItem(key);
    expect(raw).not.toBeNull();

    const loaded = await store.load();
    expect(loaded).toEqual(payload);
  });

  it('handles malformed JSON by returning null and warning', async () => {
    storage.setItem(key, '{invalid json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const store = createSettingsStore({ storage, key });
    const result = await store.load();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('clears stored values via clear()', async () => {
    const store = createSettingsStore({ storage, key });
    await store.save({ settings: defaultSettings, tuning: defaultTuning });

    await store.clear();
    expect(storage.getItem(key)).toBeNull();
  });

  describe('high scores store', () => {
    const scoresKey = 'tetris:high-scores-test';
    const baseEntry: HighScoreEntry = {
      score: 12000,
      lines: 80,
      level: 9,
      recordedAt: '2024-03-24T12:00:00.000Z',
    };

    it('returns empty array when no scores are stored', async () => {
      const store = createHighScoresStore({ storage, key: scoresKey });
      expect(await store.load()).toEqual([]);
    });

    it('persists and sorts high scores, enforcing limit', async () => {
      const store = createHighScoresStore({ storage, key: scoresKey, limit: 3 });
      const payload: StoredHighScoresPayload = {
        entries: [
          baseEntry,
          { score: 5000, lines: 40, level: 4, recordedAt: '2024-03-23T08:00:00.000Z' },
          { score: 15000, lines: 100, level: 12, recordedAt: '2024-03-24T13:00:00.000Z' },
        ],
      };

      await store.save(payload.entries);

  const loaded = await store.load();
  expect(loaded.map((entry: HighScoreEntry) => entry.score)).toEqual([15000, 12000, 5000]);

      const updated = await store.append({
        score: 3000,
        lines: 25,
        level: 3,
        recordedAt: '2024-03-24T15:00:00.000Z',
      });

      expect(updated.length).toBe(3);
      expect(updated[2]?.score).toBe(5000);

      const next = await store.append({
        score: 20000,
        lines: 150,
        level: 18,
        recordedAt: '2024-03-24T16:00:00.000Z',
      });

  expect(next.map((entry: HighScoreEntry) => entry.score)).toEqual([20000, 15000, 12000]);
    });

    it('treats malformed payloads as empty array', async () => {
      const store = createHighScoresStore({ storage, key: scoresKey });
      storage.setItem(
        scoresKey,
        JSON.stringify({ entries: [{ foo: 'bar' }] }),
      );

      expect(await store.load()).toEqual([]);
    });

    it('clears stored high scores', async () => {
      const store = createHighScoresStore({ storage, key: scoresKey });
      await store.save([baseEntry]);
      await store.clear();
      expect(storage.getItem(scoresKey)).toBeNull();
    });
  });
});
