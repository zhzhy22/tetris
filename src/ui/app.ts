import {
  createGameLoop as createDefaultGameLoop,
  type ControlInput,
  type GameLoop,
  type GameSessionState,
} from '../core/game-loop';
import { DEFAULT_BOARD_COLS, DEFAULT_BOARD_ROWS } from '../core/board';
import {
  createCanvasRenderer as createDefaultRenderer,
  type CanvasRenderer,
  type RenderSnapshot,
} from '../render/canvas-renderer';
import {
  createControlScheme as createDefaultControlScheme,
  CONTROL_TUNING_LIMITS,
  type ControlScheme,
  type ControlSchemeOptions,
} from '../input/control-scheme';
import { createRafLoop as createDefaultRafLoop, type RafLoop } from '../utils/raf-loop';
import { createHud } from './hud';
import { createDebugOverlay, type DebugOverlayInstance } from './debug-overlay';
import {
  createSettingsPanel as createDefaultSettingsPanel,
  type ControlTuningLimits,
  type Settings,
  type SettingsPanel,
  type SettingsPanelOptions,
} from './settings-panel';
import { createTouchFeedback } from './touch-feedback';
import {
  createSettingsStore as createDefaultSettingsStore,
  createHighScoresStore as createDefaultHighScoresStore,
  type SettingsStore,
  type HighScoresStore,
  type HighScoreEntry,
  type StoredSettingsPayload,
} from '../storage/local';
import {
  createSfxManager as createDefaultSfxManager,
  type SfxManager,
} from '../audio/sfx';
import { createAudioController } from './audio-controller';

type ButtonAction =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateCw'
  | 'rotateCcw'
  | 'hold'
  | 'pause'
  | 'resume';

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  highContrast: false,
  showGhost: true,
  showDebugOverlay: false,
};

const SETTINGS_TUNING_LIMITS: ControlTuningLimits = CONTROL_TUNING_LIMITS;

type DebuggableGameLoop = GameLoop & {
  debugForceGameOver?: () => void;
};

export interface AppDependencies {
  createGameLoop(): GameLoop;
  createRenderer(): CanvasRenderer;
  createControlScheme(options: ControlSchemeOptions): ControlScheme;
  createRafLoop(): RafLoop;
  createSettingsPanel(options: SettingsPanelOptions): SettingsPanel;
  createSettingsStore(): SettingsStore;
  createHighScoresStore(): HighScoresStore;
  createSfxManager(): SfxManager;
}

export interface AppInstance {
  destroy(): void;
}

export interface AppOptions {
  mount: HTMLElement;
  dependencies?: Partial<AppDependencies> & Pick<
    AppDependencies,
    'createGameLoop' | 'createRenderer' | 'createControlScheme' | 'createRafLoop' | 'createSettingsPanel' | 'createSettingsStore' | 'createHighScoresStore' | 'createSfxManager'
  >;
}

export function createApp(options: AppOptions): AppInstance {
  const mount = options.mount;
  if (!mount) {
    throw new Error('Mount element is required');
  }

  const dependencies: AppDependencies = {
    createGameLoop: options.dependencies?.createGameLoop ?? createDefaultGameLoop,
    createRenderer: options.dependencies?.createRenderer ?? createDefaultRenderer,
    createControlScheme:
      options.dependencies?.createControlScheme ?? createDefaultControlScheme,
    createRafLoop: options.dependencies?.createRafLoop ?? createDefaultRafLoop,
    createSettingsPanel:
      options.dependencies?.createSettingsPanel ?? createDefaultSettingsPanel,
    createSettingsStore:
      options.dependencies?.createSettingsStore ?? createDefaultSettingsStore,
    createHighScoresStore:
      options.dependencies?.createHighScoresStore ?? createDefaultHighScoresStore,
    createSfxManager:
      options.dependencies?.createSfxManager ?? createDefaultSfxManager,
  };

  mount.replaceChildren();

  const { root, canvas, hudMount, settingsMount, touchFeedbackMount, debugMount } = buildLayout(mount);

  const renderer = dependencies.createRenderer();
  const rafLoop = dependencies.createRafLoop();
  const gameLoop = dependencies.createGameLoop();
  const controlScheme = dependencies.createControlScheme({
    target: mount,
    rafLoop,
  });
  const hud = createHud({ mount: hudMount });
  const touchFeedback = createTouchFeedback({ mount: touchFeedbackMount });
  const settingsStore = dependencies.createSettingsStore();
  const highScoresStore = dependencies.createHighScoresStore();
  const sfxManager = dependencies.createSfxManager();
  const audioController = createAudioController({ sfxManager });
  void audioController.preload();

  const destroyHandlers: Array<() => void> = [];
  let debugOverlay: DebugOverlayInstance | null = null;

  debugOverlay = createDebugOverlay({ mount: debugMount });
  destroyHandlers.push(() => {
    debugOverlay?.destroy();
    debugOverlay = null;
  });

  let destroyed = false;
  let currentSettings: Settings = { ...DEFAULT_SETTINGS };
  let settingsPanel: SettingsPanel | null = null;
  let currentHighScores: HighScoreEntry[] = [];
  let bestScore = 0;

  function applySettings(settings: Settings) {
    currentSettings = { ...settings };
    root.dataset.soundEnabled = currentSettings.soundEnabled ? 'true' : 'false';
    root.dataset.highContrast = currentSettings.highContrast ? 'true' : 'false';
    root.dataset.showGhost = currentSettings.showGhost ? 'true' : 'false';
    root.dataset.showDebugOverlay = currentSettings.showDebugOverlay ? 'true' : 'false';
    sfxManager.setMuted(!currentSettings.soundEnabled);
    debugOverlay?.setVisible(currentSettings.showDebugOverlay);
  }

  function warn(message: string, error?: unknown) {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') {
      return;
    }
    if (typeof error !== 'undefined') {
      console.warn(message, error);
    } else {
      console.warn(message);
    }
  }

  function refreshSettingsPanelTuning() {
    if (!settingsPanel) {
      return;
    }
    const snapshot = controlScheme.getSnapshot();
    settingsPanel.update({ tuning: { ...snapshot.tuning } });
  }

  function refreshHighScores(entries: HighScoreEntry[]) {
    if (destroyed) {
      return;
    }
    currentHighScores = [...entries];
    bestScore = currentHighScores[0]?.score ?? 0;
    settingsPanel?.update({ highScores: currentHighScores });
    hud.update(latestState, { bestScore });
  }

  function registerTestHarness() {
    const testWindow = getTestWindow();
    if (!testWindow || !testWindow.__TETRIS_E2E__) {
      return;
    }

    const harness: NonNullable<Window['__TETRIS_TEST_UTILS__']> = {
      pause() {
        gameLoop.applyInput({ type: 'pause' });
      },
      resume() {
        gameLoop.applyInput({ type: 'resume' });
      },
      forceGameOver() {
        const debuggable = gameLoop as DebuggableGameLoop;
        if (typeof debuggable.debugForceGameOver === 'function') {
          debuggable.debugForceGameOver();
          return;
        }
        throw new Error('debugForceGameOver is not available in this build');
      },
      getState() {
        return gameLoop.getState();
      },
    };

    testWindow.__TETRIS_TEST_UTILS__ = harness;

    destroyHandlers.push(() => {
      const current = getTestWindow();
      if (current && current.__TETRIS_TEST_UTILS__ === harness) {
        delete current.__TETRIS_TEST_UTILS__;
      }
    });
  }

  async function persistSettingsState() {
    if (destroyed) {
      return;
    }
    try {
      const snapshot = controlScheme.getSnapshot();
      const payload: StoredSettingsPayload = {
        settings: { ...currentSettings },
        tuning: { ...snapshot.tuning },
      };
      await settingsStore.save(payload);
    } catch (error) {
      warn('Failed to persist settings state', error);
    }
  }

  applySettings(currentSettings);

  const initialControlSnapshot = controlScheme.getSnapshot();
  const initialTuning = { ...initialControlSnapshot.tuning };
  let latestState = gameLoop.getState();
  let lastPhase: GameSessionState['phase'] = latestState.phase;

  registerTestHarness();

  settingsPanel = dependencies.createSettingsPanel({
    mount: settingsMount,
    settings: { ...currentSettings },
    tuning: initialTuning,
    tuningLimits: SETTINGS_TUNING_LIMITS,
    highScores: [...currentHighScores],
    onSettingsChange: (settings) => {
      applySettings(settings);
      void persistSettingsState();
    },
    onTuningChange: (delta) => {
      controlScheme.setTuning(delta);
      refreshSettingsPanelTuning();
      void persistSettingsState();
    },
    onResetTuning: () => {
      controlScheme.resetTuning();
      refreshSettingsPanelTuning();
      void persistSettingsState();
    },
    onClearHighScores: () => {
      void (async () => {
        try {
          await highScoresStore.clear();
          if (destroyed) {
            return;
          }
          refreshHighScores([]);
        } catch (error) {
          warn('Failed to clear high scores', error);
        }
      })();
    },
  });

  void (async () => {
    try {
      const saved = await settingsStore.load();
      if (destroyed) {
        return;
      }
      if (saved) {
        applySettings(saved.settings);
        controlScheme.setTuning(saved.tuning);
        settingsPanel?.update(saved);
      }
      refreshSettingsPanelTuning();
      await persistSettingsState();
    } catch (error) {
      warn('Failed to load persisted settings', error);
    }
  })();

  void (async () => {
    try {
      const scores = await highScoresStore.load();
      if (destroyed) {
        return;
      }
      refreshHighScores(scores);
    } catch (error) {
      warn('Failed to load high scores', error);
    }
  })();
  destroyHandlers.push(() => {
    hud.destroy();
  });
  destroyHandlers.push(() => {
    touchFeedback.destroy();
  });
  destroyHandlers.push(() => {
    if (settingsPanel) {
      settingsPanel.destroy();
      settingsPanel = null;
    }
  });
  destroyHandlers.push(() => {
    void sfxManager.dispose();
  });
  destroyHandlers.push(() => {
    audioController.destroy();
  });

  const dispatchInput = (input: ControlInput) => {
    touchFeedback.signal(input);
    audioController.handleInput(input);
    gameLoop.applyInput(input);
  };

  const unsubscribeButtons = wireButtonInputs(root, dispatchInput, () => {
    void sfxManager.unlock();
  });
  destroyHandlers.push(unsubscribeButtons);

  const controlSchemeUnsubscribe = controlScheme.subscribe((input) => {
    void sfxManager.unlock();
    touchFeedback.signal(input);
    audioController.handleInput(input);
    gameLoop.applyInput(input);
  });
  destroyHandlers.push(controlSchemeUnsubscribe);

  const rafUnsubscribe = rafLoop.subscribe((event) => {
    debugOverlay?.recordFrame(event.deltaMs);
    gameLoop.tick(event.deltaMs);
  });
  destroyHandlers.push(rafUnsubscribe);

  renderer.init({
    canvas,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1,
    theme: 'default',
  });

  const BASE_CANVAS_HEIGHT = 480;
  const cellSize = Math.max(8, Math.floor(BASE_CANVAS_HEIGHT / DEFAULT_BOARD_ROWS));
  const canvasWidth = cellSize * DEFAULT_BOARD_COLS;
  const canvasHeight = cellSize * DEFAULT_BOARD_ROWS;
  renderer.resize(canvasWidth, canvasHeight);

  function updateUi(state: GameSessionState) {
    latestState = state;
    hud.update(state, { bestScore });
    renderer.render(toRenderSnapshot(state));
    debugOverlay?.update(state);
  }

  updateUi(gameLoop.getState());

  async function recordHighScoreIfNeeded(state: GameSessionState): Promise<void> {
    if (destroyed) {
      return;
    }
    if (state.phase !== 'gameOver' || lastPhase === 'gameOver') {
      return;
    }
    const { score, lines, level } = state.stats;
    if (score <= 0) {
      return;
    }
    try {
      const updated = await highScoresStore.append({
        score,
        lines,
        level,
        recordedAt: new Date().toISOString(),
      });
      if (destroyed) {
        return;
      }
      refreshHighScores(updated);
    } catch (error) {
      warn('Failed to record high score', error);
    }
  }

  const unsubscribeGameLoop = gameLoop.subscribe((state) => {
    const previousState = latestState;
    updateUi(state);
    audioController.handleStateChange(previousState, state);
    void recordHighScoreIfNeeded(state);
    lastPhase = state.phase;
  });
  destroyHandlers.push(unsubscribeGameLoop);

  rafLoop.start();
  gameLoop.start();

  return {
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const dispose of destroyHandlers) {
        try {
          dispose();
        } catch (error) {
          console.error('Error during app teardown', error);
        }
      }
      controlScheme.destroy();
      renderer.destroy();
      rafLoop.stop();
      gameLoop.stop();
      mount.replaceChildren();
    },
  };
}

type TestWindow = Window & {
  __TETRIS_E2E__?: boolean;
  __TETRIS_TEST_UTILS__?: Window['__TETRIS_TEST_UTILS__'];
};

function getTestWindow(): TestWindow | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window as TestWindow;
}

function toRenderSnapshot(state: GameSessionState): RenderSnapshot {
  return {
    board: state.board,
    active: state.active,
    ghost: state.ghost,
    nextQueue: state.nextQueue,
    hold: state.hold,
  };
}

function buildLayout(mount: HTMLElement) {
  const root = document.createElement('div');
  root.className = 'tetris-app';

  const hudMount = document.createElement('div');
  hudMount.className = 'tetris-app__hud';

  const playfield = document.createElement('div');
  playfield.className = 'tetris-app__playfield';

  const canvas = document.createElement('canvas');
  canvas.dataset.testid = 'playfield-canvas';
  playfield.appendChild(canvas);

  const controls = document.createElement('div');
  controls.className = 'tetris-app__controls';

  const controlsGrid = document.createElement('div');
  controlsGrid.className = 'tetris-app__controls-grid';
  controls.appendChild(controlsGrid);

  const buttonDefinitions: Array<{ action: ButtonAction; label: string }> = [
    { action: 'moveLeft', label: 'Left' },
    { action: 'moveRight', label: 'Right' },
    { action: 'softDrop', label: 'Soft Drop' },
    { action: 'hardDrop', label: 'Hard Drop' },
    { action: 'rotateCw', label: 'Rotate CW' },
    { action: 'rotateCcw', label: 'Rotate CCW' },
    { action: 'hold', label: 'Hold' },
    { action: 'pause', label: 'Pause' },
    { action: 'resume', label: 'Resume' },
  ];

  for (const { action, label } of buttonDefinitions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.action = action;
    button.className = 'tetris-app__button';
    controlsGrid.appendChild(button);
  }

  const touchFeedbackMount = document.createElement('div');
  touchFeedbackMount.className = 'tetris-app__touch-feedback';
  controls.appendChild(touchFeedbackMount);

  const settingsMount = document.createElement('div');
  settingsMount.className = 'tetris-app__settings';

  const debugMount = document.createElement('div');
  debugMount.className = 'tetris-app__debug';

  root.append(hudMount, playfield, controls, settingsMount, debugMount);
  mount.appendChild(root);

  return { root, canvas, hudMount, settingsMount, touchFeedbackMount, debugMount };
}

function wireButtonInputs(
  root: HTMLElement,
  dispatch: (input: ControlInput) => void,
  onInteraction?: () => void,
) {
  const handlers: Array<{ element: HTMLElement; listener: (event: Event) => void }> = [];

  const factories: Record<ButtonAction, () => ControlInput | null> = {
    moveLeft: () => ({ type: 'move', direction: 'left', repeat: false }),
    moveRight: () => ({ type: 'move', direction: 'right', repeat: false }),
    softDrop: () => ({ type: 'softDrop', repeat: false }),
    hardDrop: () => ({ type: 'hardDrop' }),
    rotateCw: () => ({ type: 'rotate', direction: 'cw' }),
    rotateCcw: () => ({ type: 'rotate', direction: 'ccw' }),
    hold: () => ({ type: 'hold' }),
    pause: () => ({ type: 'pause' }),
    resume: () => ({ type: 'resume' }),
  };

  root.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => {
    const action = element.dataset.action as ButtonAction | undefined;
    if (!action) {
      return;
    }
    const factory = factories[action];
    if (!factory) {
      return;
    }
    const listener = (event: Event) => {
      event.preventDefault();
      if (onInteraction) {
        onInteraction();
      }
      const input = factory();
      if (!input) {
        return;
      }
      dispatch({ ...input });
    };
    element.addEventListener('click', listener);
    handlers.push({ element, listener });
  });

  return () => {
    for (const { element, listener } of handlers) {
      element.removeEventListener('click', listener);
    }
  };
}
