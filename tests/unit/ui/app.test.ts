import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { createEmptyBoard } from '../../../src/core/board';
import { createApp, type AppOptions } from '../../../src/ui/app';

import type { SfxManager } from '../../../src/audio/sfx';
import type { GameLoop, GameSessionState } from '../../../src/core/game-loop';
import type { TetrominoType } from '../../../src/core/rng';
import type {
  ControlScheme,
  ControlSchemeListener,
  ControlSchemeOptions,
} from '../../../src/input/control-scheme';
import type { CanvasRenderer, RenderSnapshot } from '../../../src/render/canvas-renderer';
import type {
  HighScoreEntry,
  HighScoresStore,
  SettingsStore,
  StoredSettingsPayload,
} from '../../../src/storage/local';
import type {
  Settings,
  SettingsPanel,
  SettingsPanelOptions,
} from '../../../src/ui/settings-panel';
import type { RafLoop, FrameEvent } from '../../../src/utils/raf-loop';

const defaultTuning = {
  dasMs: 170,
  arrMs: 40,
  swipeThresholdPx: 15,
  softDropDurationMs: 150,
  hardDropDurationMs: 150,
};

async function flushAsyncTasks() {
  await Promise.resolve();
  await Promise.resolve();
}

interface TestDependencies {
  gameLoop: GameLoopMock;
  renderer: CanvasRendererMock;
  controlScheme: ControlSchemeMock;
  rafLoop: RafLoopMock;
  settingsPanel: SettingsPanelMock;
  createSettingsPanel: ReturnType<typeof vi.fn>;
  settingsStore: SettingsStoreMock;
  createSettingsStore: ReturnType<typeof vi.fn>;
  highScoresStore: HighScoresStoreMock;
  createHighScoresStore: ReturnType<typeof vi.fn>;
  sfxManager: SfxManagerMock;
  createSfxManager: ReturnType<typeof vi.fn>;
}

class GameLoopMock implements GameLoop {
  public start = vi.fn();
  public stop = vi.fn();
  public tick = vi.fn();
  public applyInput = vi.fn();
  public getState = vi.fn(() => this.state);
  public listeners = new Set<(snapshot: GameSessionState) => void>();
  public subscribe = vi.fn((listener: (snapshot: GameSessionState) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  });

  constructor(public state: GameSessionState) {}

  emit(snapshot: GameSessionState) {
    this.state = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

class CanvasRendererMock implements CanvasRenderer {
  public init = vi.fn();
  public resize = vi.fn();
  public render = vi.fn();
  public destroy = vi.fn();
}

class ControlSchemeMock implements ControlScheme {
  public subscribe = vi.fn((listener: ControlSchemeListener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  });
  public setTuning = vi.fn((partial: Partial<typeof defaultTuning>) => {
    this.tuning = { ...this.tuning, ...partial };
  });
  public resetTuning = vi.fn(() => {
    this.tuning = { ...defaultTuning };
  });
  public getSnapshot = vi.fn(() => ({
    tuning: { ...this.tuning },
  }));
  public destroy = vi.fn();

  public emit(input: Parameters<ControlSchemeListener>[0]) {
    for (const listener of this.listeners) {
      listener(input);
    }
  }

  private listeners = new Set<ControlSchemeListener>();
  private tuning = { ...defaultTuning };
}

class RafLoopMock implements RafLoop {
  public start = vi.fn();
  public stop = vi.fn();
  public pause = vi.fn();
  public resume = vi.fn();
  public getSnapshot = vi.fn(() => ({ running: true, paused: false, frame: this.frame }));
  private frame = 0;
  private listeners = new Set<(event: FrameEvent) => void>();

  subscribe(listener: (event: FrameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(deltaMs: number) {
    this.frame += 1;
    const event: FrameEvent = { time: this.frame * deltaMs, deltaMs, frame: this.frame };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

class SettingsPanelMock implements SettingsPanel {
  public update = vi.fn();
  public destroy = vi.fn();
}

class SettingsStoreMock implements SettingsStore {
  public loadMock = vi.fn<() => Promise<StoredSettingsPayload | null>>(async () => null);
  public saveMock = vi.fn<(payload: StoredSettingsPayload) => Promise<void>>(async () => {});
  public clearMock = vi.fn<() => Promise<void>>(async () => {});

  public load: SettingsStore['load'] = async () => this.loadMock();
  public save: SettingsStore['save'] = async (value: StoredSettingsPayload) => this.saveMock(value);
  public clear: SettingsStore['clear'] = async () => this.clearMock();
}

class HighScoresStoreMock implements HighScoresStore {
  public loadMock = vi.fn<() => Promise<HighScoreEntry[]>>(async () => []);
  public saveMock = vi.fn<(entries: HighScoreEntry[]) => Promise<void>>(async () => {});
  public appendMock = vi.fn<(entry: HighScoreEntry) => Promise<HighScoreEntry[]>>(async (entry) => [entry]);
  public clearMock = vi.fn<() => Promise<void>>(async () => {});

  public load: HighScoresStore['load'] = async () => this.loadMock();
  public save: HighScoresStore['save'] = async (entries: HighScoreEntry[]) => this.saveMock(entries);
  public append: HighScoresStore['append'] = async (entry: HighScoreEntry) => this.appendMock(entry);
  public clear: HighScoresStore['clear'] = async () => this.clearMock();
}

class SfxManagerMock implements SfxManager {
  public unlock = vi.fn(async () => {});
  public loadSample = vi.fn(async () => ({} as AudioBuffer));
  public play = vi.fn(async () => true);
  public setVolume = vi.fn();
  public setMuted = vi.fn();
  public dispose = vi.fn(async () => {});
  public getState = vi.fn(() => ({ unlocked: false, muted: false, volume: 1 }));
}

function createDependencies(): TestDependencies {
  const board = createEmptyBoard();
  const state: GameSessionState = {
    board,
    active: null,
    hold: null,
    holdUsedThisTurn: false,
    nextQueue: ['I', 'O', 'T'] as TetrominoType[],
    rng: { seed: 'seed', bag: [], history: [] },
    stats: {
      score: 0,
      level: 0,
      lines: 0,
      dropDistanceSoft: 0,
      dropDistanceHard: 0,
    },
    speed: {
      gravityMs: 1000,
      lockDelayMs: 500,
    },
    lock: {
      isLocking: false,
      elapsedMs: 0,
      frames: 0,
    },
    phase: 'ready',
    ghost: null,
    seed: 'seed',
  };

  const settingsPanel = new SettingsPanelMock();
  const settingsStore = new SettingsStoreMock();
  const highScoresStore = new HighScoresStoreMock();
  const sfxManager = new SfxManagerMock();

  return {
    gameLoop: new GameLoopMock(state),
    renderer: new CanvasRendererMock(),
    controlScheme: new ControlSchemeMock(),
    rafLoop: new RafLoopMock(),
    settingsPanel,
    createSettingsPanel: vi.fn((options: SettingsPanelOptions) => {
      return settingsPanel;
    }),
    settingsStore,
    createSettingsStore: vi.fn(() => settingsStore),
    highScoresStore,
    createHighScoresStore: vi.fn(() => highScoresStore),
    sfxManager,
    createSfxManager: vi.fn(() => sfxManager),
  };
}

describe('ui/app', () => {
  let mount: HTMLElement;
  let deps: TestDependencies;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
    deps = createDependencies();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function buildAppOptions(): AppOptions {
    return {
      mount,
      dependencies: {
        createGameLoop: () => deps.gameLoop,
        createRenderer: () => deps.renderer,
        createControlScheme: (options: ControlSchemeOptions) => {
          expect(options.target).toBeInstanceOf(HTMLElement);
          return deps.controlScheme;
        },
        createRafLoop: () => deps.rafLoop,
        createSettingsPanel: (panelOptions: SettingsPanelOptions) => {
          return deps.createSettingsPanel(panelOptions);
        },
        createSettingsStore: () => deps.createSettingsStore(),
        createHighScoresStore: () => deps.createHighScoresStore(),
        createSfxManager: () => deps.createSfxManager(),
      },
    } satisfies AppOptions;
  }

  it('initializes renderer and starts game loop', () => {
    const options = buildAppOptions();
    const app = createApp(options);

    expect(deps.renderer.init).toHaveBeenCalledOnce();
    expect(deps.renderer.resize).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(deps.gameLoop.start).toHaveBeenCalledOnce();
    expect(deps.rafLoop.start).toHaveBeenCalledOnce();

    const loadCalls = deps.sfxManager.loadSample.mock.calls as unknown as Array<
      [string, ...unknown[]]
    >;
    expect(loadCalls.length).toBeGreaterThan(0);
    const loadedIds = loadCalls.map(([id]) => id);
    expect(new Set(loadedIds)).toEqual(new Set(['hard-drop', 'line-clear', 'game-over']));

    const canvas = mount.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const debugOverlay = mount.querySelector<HTMLElement>('[data-testid="debug-overlay"]');
    expect(debugOverlay).toBeNull();

    app.destroy();
  });

  it('preloads audio samples only once', () => {
    const options = buildAppOptions();
    const app = createApp(options);

  expect(deps.sfxManager.loadSample).toHaveBeenCalledTimes(3);
    const loadCalls = deps.sfxManager.loadSample.mock.calls as unknown as Array<
      [string, ...unknown[]]
    >;
    const ids = loadCalls.map(([id]) => id);
    expect(ids).toContain('hard-drop');
    expect(ids).toContain('line-clear');
    expect(ids).toContain('game-over');

    app.destroy();
  });

  it('renders state updates and routes inputs to the game loop', () => {
    const options = buildAppOptions();
    const app = createApp(options);

    const scoreValue = mount.querySelector('[data-testid="score-value"]');
    expect(scoreValue?.textContent).toBe('0');

    deps.rafLoop.emit(16);
    expect(deps.gameLoop.tick).toHaveBeenCalledWith(16);

    const nextState = { ...deps.gameLoop.getState(), stats: { ...deps.gameLoop.getState().stats, score: 1234 } };
    deps.gameLoop.emit(nextState);
    expect(scoreValue?.textContent).toBe('1234');
    expect(deps.renderer.render).toHaveBeenCalledWith(expect.objectContaining({ board: nextState.board }));

    const hardDropButton = mount.querySelector<HTMLButtonElement>('[data-action="hardDrop"]');
    hardDropButton?.click();
    expect(deps.gameLoop.applyInput).toHaveBeenCalledWith({ type: 'hardDrop' });
    expect(deps.sfxManager.unlock).toHaveBeenCalled();
  expect(deps.sfxManager.play).toHaveBeenCalledWith('hard-drop', undefined);
    expect(deps.sfxManager.play).toHaveBeenCalledTimes(1);

    deps.controlScheme.emit({ type: 'softDrop', repeat: false });
    expect(deps.sfxManager.unlock).toHaveBeenCalledTimes(2);
    expect(deps.sfxManager.play).toHaveBeenCalledTimes(1);

    app.destroy();
  });

  it('plays line clear and game over sounds on state updates', () => {
    const options = buildAppOptions();
    const app = createApp(options);

    deps.sfxManager.play.mockClear();

    const baseState = deps.gameLoop.getState();
    const clearedState: GameSessionState = {
      ...baseState,
      stats: {
        ...baseState.stats,
        lines: baseState.stats.lines + 2,
      },
    };

    deps.gameLoop.emit(clearedState);

    expect(deps.sfxManager.play).toHaveBeenCalledTimes(1);
    const playCalls = deps.sfxManager.play.mock.calls as unknown as Array<
      [string, { playbackRate?: number }?]
    >;
    expect(playCalls.length).toBeGreaterThan(0);
    const [firstId, firstOptions] = playCalls[0];
    expect(firstId).toBe('line-clear');
    expect(firstOptions?.playbackRate).toBeCloseTo(1.25, 2);

    const gameOverState: GameSessionState = {
      ...clearedState,
      phase: 'gameOver',
    };

    deps.gameLoop.emit(gameOverState);

    expect(deps.sfxManager.play).toHaveBeenCalledTimes(2);
  expect(playCalls.length).toBeGreaterThanOrEqual(2);
  const [secondId] = playCalls[1];
    expect(secondId).toBe('game-over');

    app.destroy();
  });

  it('keeps canvas render snapshots and HUD queue in sync', () => {
    const options = buildAppOptions();
    const app = createApp(options);

    const initialQueueSlots = mount.querySelectorAll('[data-testid="next-slot"]');
    const initialPieces = Array.from(initialQueueSlots, (slot) => slot.getAttribute('data-piece'));
    expect(initialPieces).toEqual(['I', 'O', 'T']);

    const baseState = deps.gameLoop.getState();
    const nextQueue = ['Z', 'L', 'S'] as TetrominoType[];
    const nextState: GameSessionState = {
      ...baseState,
      phase: 'playing',
      active: {
        type: 'T',
        rotation: 0,
        position: { row: 0, col: 4 },
      },
      ghost: { row: 18, col: 4 },
      nextQueue,
    };

    deps.gameLoop.emit(nextState);

    const renderCalls = deps.renderer.render.mock.calls;
    const lastRenderCall = renderCalls[renderCalls.length - 1];
    const snapshot = lastRenderCall?.[0] as RenderSnapshot | undefined;
    expect(snapshot?.nextQueue).toEqual(nextQueue);

    const updatedQueueSlots = mount.querySelectorAll('[data-testid="next-slot"]');
    const updatedPieces = Array.from(updatedQueueSlots, (slot) => slot.getAttribute('data-piece'));
    expect(updatedPieces).toEqual(nextQueue);

    app.destroy();
  });

  it('wires settings panel with control scheme, storage, and responds to changes', async () => {
    const savedPayload: StoredSettingsPayload = {
      settings: {
        soundEnabled: false,
        highContrast: true,
        showGhost: false,
        showDebugOverlay: true,
      },
      tuning: {
        dasMs: 180,
        arrMs: 35,
        swipeThresholdPx: 20,
        softDropDurationMs: 160,
        hardDropDurationMs: 170,
      },
    };

    deps.settingsStore.loadMock.mockResolvedValue(savedPayload);

    const options = buildAppOptions();
    const app = createApp(options);

  expect(deps.createSfxManager).toHaveBeenCalledOnce();
  expect(deps.sfxManager.setMuted).toHaveBeenCalledWith(false);

    expect(deps.createSettingsStore).toHaveBeenCalledOnce();
    expect(deps.createHighScoresStore).toHaveBeenCalledOnce();
    expect(deps.createSettingsPanel).toHaveBeenCalledOnce();
    const [panelOptions] = deps.createSettingsPanel.mock.calls[0] as [SettingsPanelOptions];

    expect(panelOptions.settings).toEqual({
      soundEnabled: true,
      highContrast: false,
      showGhost: true,
      showDebugOverlay: false,
    });

    expect(panelOptions.tuning).toEqual(defaultTuning);

    expect(panelOptions.tuningLimits).toMatchObject({
      dasMs: { min: 150, max: 220 },
      arrMs: { min: 30, max: 60 },
      swipeThresholdPx: { min: 10, max: 25 },
      softDropDurationMs: { min: 120, max: 200 },
      hardDropDurationMs: { min: 120, max: 200 },
    });

    expect(panelOptions.highScores).toEqual([]);
    expect(typeof panelOptions.onClearHighScores).toBe('function');

    await flushAsyncTasks();

    expect(deps.settingsStore.loadMock).toHaveBeenCalledOnce();
    expect(deps.controlScheme.setTuning).toHaveBeenCalledWith(savedPayload.tuning);
    expect(deps.settingsPanel.update).toHaveBeenCalledWith(expect.objectContaining(savedPayload));
  expect(deps.sfxManager.setMuted).toHaveBeenLastCalledWith(true);

    const debugOverlay = mount.querySelector<HTMLElement>('[data-testid="debug-overlay"]');
    expect(debugOverlay?.hidden).toBe(false);
    expect(debugOverlay?.getAttribute('data-visible')).toBe('true');

    const root = mount.querySelector<HTMLElement>('.tetris-app');
    expect(root?.dataset.soundEnabled).toBe('false');
    expect(root?.dataset.highContrast).toBe('true');
    expect(root?.dataset.showGhost).toBe('false');
    expect(root?.dataset.showDebugOverlay).toBe('true');

    deps.settingsStore.saveMock.mockClear();

    const updatedSettings: Settings = {
      soundEnabled: true,
      highContrast: false,
      showGhost: true,
      showDebugOverlay: false,
    };
    panelOptions.onSettingsChange(updatedSettings);
    await flushAsyncTasks();

    expect(deps.settingsStore.saveMock).toHaveBeenLastCalledWith({
      settings: updatedSettings,
      tuning: expect.objectContaining(savedPayload.tuning),
    });
    expect(deps.sfxManager.setMuted).toHaveBeenLastCalledWith(false);

    panelOptions.onTuningChange({ arrMs: 42 });
    await flushAsyncTasks();

    expect(deps.controlScheme.setTuning).toHaveBeenLastCalledWith({ arrMs: 42 });
    expect(deps.settingsStore.saveMock).toHaveBeenLastCalledWith({
      settings: updatedSettings,
      tuning: expect.objectContaining({ ...savedPayload.tuning, arrMs: 42 }),
    });
    expect(deps.settingsPanel.update).toHaveBeenCalledWith({ tuning: expect.objectContaining({ arrMs: 42 }) });

    panelOptions.onResetTuning();
    await flushAsyncTasks();

    expect(deps.controlScheme.resetTuning).toHaveBeenCalledOnce();
    expect(deps.settingsPanel.update).toHaveBeenCalledWith({ tuning: defaultTuning });
    expect(deps.settingsStore.saveMock).toHaveBeenLastCalledWith({
      settings: updatedSettings,
      tuning: defaultTuning,
    });

    app.destroy();
    expect(deps.settingsPanel.destroy).toHaveBeenCalledOnce();
    expect(deps.sfxManager.dispose).toHaveBeenCalledOnce();
  });

  it('loads, records, and clears high scores via the store and UI hooks', async () => {
    const savedScores: HighScoreEntry[] = [
      { score: 9000, lines: 60, level: 7, recordedAt: '2024-03-24T10:00:00.000Z' },
      { score: 7000, lines: 50, level: 6, recordedAt: '2024-03-23T10:00:00.000Z' },
    ];
    deps.highScoresStore.loadMock.mockResolvedValue(savedScores);

    const options = buildAppOptions();
    const app = createApp(options);

    const bestValue = () => mount.querySelector('[data-testid="best-value"]');
    expect(bestValue()?.textContent).toBe('0');

    await flushAsyncTasks();

    expect(deps.highScoresStore.loadMock).toHaveBeenCalledOnce();
    expect(deps.settingsPanel.update).toHaveBeenCalledWith({ highScores: savedScores });
    expect(bestValue()?.textContent).toBe('9000');

    const [panelOptions] = deps.createSettingsPanel.mock.calls[0] as [SettingsPanelOptions];

    const gameOverState: GameSessionState = {
      ...deps.gameLoop.getState(),
      phase: 'gameOver',
      stats: {
        ...deps.gameLoop.getState().stats,
        score: 12000,
        lines: 80,
        level: 9,
      },
    };

    const appendedScores: HighScoreEntry[] = [
      { score: 12000, lines: 80, level: 9, recordedAt: '2024-03-24T12:00:00.000Z' },
      ...savedScores,
    ];

    deps.highScoresStore.appendMock.mockResolvedValue(appendedScores);

    deps.gameLoop.emit(gameOverState);

    expect(deps.highScoresStore.appendMock).toHaveBeenCalledTimes(1);
    const [recordedEntry] = deps.highScoresStore.appendMock.mock.calls[0] as [HighScoreEntry];
    expect(recordedEntry.score).toBe(12000);
    expect(recordedEntry.lines).toBe(80);
    expect(recordedEntry.level).toBe(9);

    await flushAsyncTasks();

    expect(deps.settingsPanel.update).toHaveBeenCalledWith({ highScores: appendedScores });
    expect(bestValue()?.textContent).toBe('12000');

    panelOptions.onClearHighScores();
    await flushAsyncTasks();

    expect(deps.highScoresStore.clearMock).toHaveBeenCalledOnce();
    expect(deps.settingsPanel.update).toHaveBeenCalledWith({ highScores: [] });
    expect(bestValue()?.textContent).toBe('0');

    app.destroy();
  });

  it('updates debug overlay metrics when enabled', async () => {
    const options = buildAppOptions();
    const app = createApp(options);

    const [panelOptions] = deps.createSettingsPanel.mock.calls[0] as [SettingsPanelOptions];

    panelOptions.onSettingsChange({
      soundEnabled: true,
      highContrast: false,
      showGhost: true,
      showDebugOverlay: true,
    });

    await flushAsyncTasks();

    const overlay = mount.querySelector<HTMLElement>('[data-testid="debug-overlay"]');
    expect(overlay?.hidden).toBe(false);

    deps.rafLoop.emit(16);

    const fpsValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-fps"]');
    const frameValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-frame"]');
    expect(fpsValue?.textContent).toBe('62.5');
    expect(frameValue?.textContent).toBe('16.00');

    const baseState = deps.gameLoop.getState();
    const lockingState: GameSessionState = {
      ...baseState,
      phase: 'playing',
      speed: { ...baseState.speed, gravityMs: 830 },
      lock: { ...baseState.lock, isLocking: true, elapsedMs: 120, frames: 5 },
    };

    deps.gameLoop.emit(lockingState);

    const gravityValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-gravity"]');
    const lockValue = mount.querySelector<HTMLElement>('[data-testid="debug-overlay-lock"]');
    expect(gravityValue?.textContent).toBe('830 ms');
    expect(lockValue?.textContent).toBe('Locking 120 / 500 ms (5 frames)');

    panelOptions.onSettingsChange({
      soundEnabled: true,
      highContrast: false,
      showGhost: true,
      showDebugOverlay: false,
    });

    await flushAsyncTasks();

    expect(overlay?.hidden).toBe(true);

    app.destroy();
  });

  it('cleans up resources on destroy', () => {
    const options = buildAppOptions();
    const unsubscribeSpy = vi.fn();
    deps.gameLoop.subscribe.mockReturnValueOnce(unsubscribeSpy);
    const app = createApp(options);

    app.destroy();

    expect(deps.controlScheme.destroy).toHaveBeenCalledOnce();
    expect(deps.renderer.destroy).toHaveBeenCalledOnce();
    expect(deps.rafLoop.stop).toHaveBeenCalledOnce();
    expect(unsubscribeSpy).toHaveBeenCalledOnce();
  });
});
