import type { HighScoreEntry, StoredHighScoresPayload } from './schema';
import type { ControlTuning } from '../input/control-scheme';
import type { Settings } from '../ui/settings-panel';

export const SETTINGS_STORAGE_KEY = 'tetris:settings';
export const HIGH_SCORES_STORAGE_KEY = 'tetris:high-scores';
export const DEFAULT_HIGH_SCORES_LIMIT = 10;

export interface StoredSettingsPayload {
  settings: Settings;
  tuning: ControlTuning;
}

export interface SettingsStore {
  load(): Promise<StoredSettingsPayload | null>;
  save(payload: StoredSettingsPayload): Promise<void>;
  clear(): Promise<void>;
}

export interface HighScoresStore {
  load(): Promise<HighScoreEntry[]>;
  save(entries: HighScoreEntry[]): Promise<void>;
  append(entry: HighScoreEntry): Promise<HighScoreEntry[]>;
  clear(): Promise<void>;
}

export interface SettingsStoreOptions {
  storage?: Storage | null;
  key?: string;
  logger?: Pick<Console, 'warn' | 'error'>;
}

export interface HighScoresStoreOptions {
  storage?: Storage | null;
  key?: string;
  limit?: number;
  logger?: Pick<Console, 'warn'>;
}

interface SettingsRecord {
  settings: Settings;
  tuning: ControlTuning;
}

function selectStorage(storage?: Storage | null): Storage | null {
  if (storage) {
    return storage;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<Settings>;
  return (
    isBoolean(candidate.soundEnabled) &&
    isBoolean(candidate.highContrast) &&
    isBoolean(candidate.showGhost) &&
    isBoolean(candidate.showDebugOverlay)
  );
}

function isControlTuning(value: unknown): value is ControlTuning {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ControlTuning>;
  return (
    isNumber(candidate.dasMs) &&
    isNumber(candidate.arrMs) &&
    isNumber(candidate.swipeThresholdPx) &&
    isNumber(candidate.softDropDurationMs) &&
    isNumber(candidate.hardDropDurationMs)
  );
}

function parsePayload(raw: string | null, logger: Pick<Console, 'warn'>): StoredSettingsPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SettingsRecord;
    if (isSettings(parsed.settings) && isControlTuning(parsed.tuning)) {
      return {
        settings: { ...parsed.settings },
        tuning: { ...parsed.tuning },
      };
    }
    logger.warn('Invalid settings payload in storage, falling back to defaults');
  } catch (error) {
    logger.warn('Failed to parse stored settings payload', error);
  }
  return null;
}

function isHighScoreEntry(value: unknown): value is HighScoreEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<HighScoreEntry>;
  return (
    isNumber(candidate.score) &&
    isNumber(candidate.lines) &&
    isNumber(candidate.level) &&
    isString(candidate.recordedAt)
  );
}

function normalizeHighScores(
  entries: unknown,
  limit: number,
  logger: Pick<Console, 'warn'>,
): HighScoreEntry[] {
  if (!Array.isArray(entries)) {
    logger.warn('Invalid high score payload in storage, resetting list');
    return [];
  }

  const normalized: HighScoreEntry[] = [];

  for (const entry of entries) {
    if (!isHighScoreEntry(entry)) {
      logger.warn('Skipping malformed high score entry from storage');
      return [];
    }
    normalized.push(sanitizeHighScoreEntry(entry, logger));
  }

  normalized.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
  });

  return normalized.slice(0, Math.max(0, limit));
}

function sanitizeHighScoreEntry(entry: HighScoreEntry, logger?: Pick<Console, 'warn'>): HighScoreEntry {
  const parsed = new Date(entry.recordedAt);
  const isInvalid = Number.isNaN(parsed.getTime());
  if (isInvalid && logger) {
    logger.warn('Replacing invalid high score timestamp');
  }
  const recordedAt = isInvalid ? new Date() : parsed;
  return {
    score: entry.score,
    lines: entry.lines,
    level: entry.level,
    recordedAt: recordedAt.toISOString(),
  };
}

function prepareHighScorePayload(entries: HighScoreEntry[], limit: number): StoredHighScoresPayload {
  const normalized = [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
  });

  return {
    entries: normalized
      .slice(0, Math.max(0, limit))
      .map((entry) => sanitizeHighScoreEntry(entry)),
  };
}

export function createSettingsStore(options: SettingsStoreOptions = {}): SettingsStore {
  const storage = selectStorage(options.storage);
  const key = options.key ?? SETTINGS_STORAGE_KEY;
  const logger: Pick<Console, 'warn' | 'error'> = options.logger ?? console;

  function load(): Promise<StoredSettingsPayload | null> {
    if (!storage) {
      return Promise.resolve(null);
    }
    const raw = storage.getItem(key);
    return Promise.resolve(parsePayload(raw, logger));
  }

  function save(payload: StoredSettingsPayload): Promise<void> {
    if (!storage) {
      return Promise.resolve();
    }
    try {
      storage.setItem(
        key,
        JSON.stringify({
          settings: { ...payload.settings },
          tuning: { ...payload.tuning },
        }),
      );
    } catch (error) {
      logger.warn('Failed to persist settings payload', error);
    }
    return Promise.resolve();
  }

  function clear(): Promise<void> {
    if (!storage) {
      return Promise.resolve();
    }
    try {
      storage.removeItem(key);
    } catch (error) {
      logger.warn('Failed to clear stored settings', error);
    }
    return Promise.resolve();
  }

  return {
    load,
    save,
    clear,
  };
}

export function createHighScoresStore(options: HighScoresStoreOptions = {}): HighScoresStore {
  const storage = selectStorage(options.storage);
  const key = options.key ?? HIGH_SCORES_STORAGE_KEY;
  const limit = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(0, Math.floor(options.limit))
    : DEFAULT_HIGH_SCORES_LIMIT;
  const logger: Pick<Console, 'warn'> = options.logger ?? console;

  function load(): Promise<HighScoreEntry[]> {
    if (!storage) {
      return Promise.resolve([]);
    }
    const raw = storage.getItem(key);
    if (!raw) {
      return Promise.resolve([]);
    }
    try {
      const parsed = JSON.parse(raw) as StoredHighScoresPayload;
      return Promise.resolve(normalizeHighScores(parsed.entries, limit, logger));
    } catch (error) {
      logger.warn('Failed to parse stored high scores', error);
      return Promise.resolve([]);
    }
  }

  function persist(entries: HighScoreEntry[]): HighScoreEntry[] {
    const payload = prepareHighScorePayload(entries, limit);
    if (!storage) {
      return payload.entries;
    }
    try {
      storage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      logger.warn('Failed to persist high scores', error);
    }
    return payload.entries;
  }

  function save(entries: HighScoreEntry[]): Promise<void> {
    persist(entries);
    return Promise.resolve();
  }

  async function append(entry: HighScoreEntry): Promise<HighScoreEntry[]> {
    const existing = await load();
    return persist([...existing, entry]);
  }

  function clear(): Promise<void> {
    if (!storage) {
      return Promise.resolve();
    }
    try {
      storage.removeItem(key);
    } catch (error) {
      logger.warn('Failed to clear stored high scores', error);
    }
    return Promise.resolve();
  }

  return {
    load,
    save,
    append,
    clear,
  };
}

export async function migrateSettingsStore(): Promise<void> {
  // No migrations defined for initial release; reserved for future schema evolution.
}

export type { HighScoreEntry, StoredHighScoresPayload } from './schema';
