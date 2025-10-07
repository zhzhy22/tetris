import type { ControlTuning } from '../input/control-scheme';
import type { HighScoreEntry } from '../storage/schema';

export interface Settings {
  soundEnabled: boolean;
  highContrast: boolean;
  showGhost: boolean;
  showDebugOverlay: boolean;
}

export type ControlTuningLimits = Record<
  keyof ControlTuning,
  { min: number; max: number }
>;

export interface SettingsPanelUpdate {
  settings?: Settings;
  tuning?: ControlTuning;
  highScores?: HighScoreEntry[];
}

export interface SettingsPanel {
  update(update: SettingsPanelUpdate): void;
  destroy(): void;
}

export interface SettingsPanelOptions {
  mount: HTMLElement;
  settings: Settings;
  tuning: ControlTuning;
  tuningLimits: ControlTuningLimits;
  highScores: HighScoreEntry[];
  onSettingsChange(settings: Settings): void;
  onTuningChange(delta: Partial<ControlTuning>): void;
  onResetTuning(): void;
  onClearHighScores(): void;
}

type SettingsKey = keyof Settings;
type TuningKey = keyof ControlTuning;

export function createSettingsPanel(options: SettingsPanelOptions): SettingsPanel {
  const { mount } = options;

  const root = document.createElement('div');
  root.className = 'settings-panel';
  mount.appendChild(root);

  const cleanup: Array<() => void> = [];
  let destroyed = false;

  let currentSettings: Settings = { ...options.settings };
  let currentTuning: ControlTuning = { ...options.tuning };
  let currentHighScores: HighScoreEntry[] = [...options.highScores];

  const toggleInputs: Partial<Record<SettingsKey, HTMLInputElement>> = {};
  const tuningInputs: Partial<Record<TuningKey, HTMLInputElement>> = {};

  const toggleDefinitions: Array<{ key: SettingsKey; label: string }> = [
    { key: 'highContrast', label: 'High contrast mode' },
    { key: 'showGhost', label: 'Show ghost piece' },
    { key: 'soundEnabled', label: 'Enable sound' },
    { key: 'showDebugOverlay', label: 'Show debug overlay' },
  ];

  const tuningDefinitions: Array<{ key: TuningKey; label: string; step?: number }> = [
    { key: 'dasMs', label: 'DAS (ms)' },
    { key: 'arrMs', label: 'ARR (ms)' },
    { key: 'swipeThresholdPx', label: 'Swipe threshold (px)' },
    { key: 'softDropDurationMs', label: 'Soft drop duration (ms)' },
    { key: 'hardDropDurationMs', label: 'Hard drop duration (ms)' },
  ];

  function addListener(target: Element, type: string, listener: EventListenerOrEventListenerObject) {
    target.addEventListener(type, listener);
    cleanup.push(() => target.removeEventListener(type, listener));
  }

  function emitSettingsChange(key: SettingsKey, value: boolean) {
    if (currentSettings[key] === value) {
      return;
    }
    currentSettings = { ...currentSettings, [key]: value };
    options.onSettingsChange({ ...currentSettings });
  }

  function emitTuningChange(key: TuningKey, rawValue: number) {
    if (Number.isNaN(rawValue)) {
      return;
    }
    const limits = options.tuningLimits[key];
    const clamped = Math.min(limits.max, Math.max(limits.min, rawValue));
    if (currentTuning[key] === clamped) {
      return;
    }
    currentTuning = { ...currentTuning, [key]: clamped };
    options.onTuningChange({ [key]: clamped } as Partial<ControlTuning>);
  }

  const togglesSection = document.createElement('section');
  togglesSection.className = 'settings-panel__section settings-panel__section--toggles';
  root.appendChild(togglesSection);

  for (const { key, label } of toggleDefinitions) {
    const wrapper = document.createElement('label');
    wrapper.className = 'settings-panel__toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.testid = `settings-toggle-${key}`;
    input.checked = Boolean(currentSettings[key]);

    addListener(input, 'change', () => {
      emitSettingsChange(key, input.checked);
    });

    const text = document.createElement('span');
    text.textContent = label;

    wrapper.append(input, text);
    togglesSection.appendChild(wrapper);
    toggleInputs[key] = input;
  }

  const tuningSection = document.createElement('section');
  tuningSection.className = 'settings-panel__section settings-panel__section--tuning';
  root.appendChild(tuningSection);

  for (const { key, label, step } of tuningDefinitions) {
    const wrapper = document.createElement('label');
    wrapper.className = 'settings-panel__tuning';

    const title = document.createElement('span');
    title.textContent = label;

    const input = document.createElement('input');
    input.type = 'number';
    input.dataset.testid = `settings-tuning-${key}`;
    input.value = String(currentTuning[key]);

    const limits = options.tuningLimits[key];
    input.min = String(limits.min);
    input.max = String(limits.max);
    if (step) {
      input.step = String(step);
    }

    addListener(input, 'change', () => {
      const parsed = Number(input.value);
      const limitsForKey = options.tuningLimits[key];
      const clamped = Math.min(limitsForKey.max, Math.max(limitsForKey.min, parsed));
      if (Number.isNaN(parsed)) {
        input.value = String(currentTuning[key]);
        return;
      }
      if (clamped !== parsed) {
        input.value = String(clamped);
      }
      emitTuningChange(key, clamped);
    });

    wrapper.append(title, input);
    tuningSection.appendChild(wrapper);
    tuningInputs[key] = input;
  }

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.dataset.testid = 'settings-reset-tuning';
  resetButton.textContent = 'Reset tuning';
  addListener(resetButton, 'click', () => {
    options.onResetTuning();
  });
  tuningSection.appendChild(resetButton);

  const highScoresSection = document.createElement('section');
  highScoresSection.className = 'settings-panel__section settings-panel__section--scores';

  const highScoresTitle = document.createElement('h3');
  highScoresTitle.className = 'settings-panel__section-title';
  highScoresTitle.textContent = '高分榜';
  highScoresSection.appendChild(highScoresTitle);

  const highScoresList = document.createElement('ol');
  highScoresList.className = 'settings-panel__scores-list';
  highScoresList.dataset.testid = 'high-score-list';
  highScoresSection.appendChild(highScoresList);

  const highScoresEmpty = document.createElement('p');
  highScoresEmpty.className = 'settings-panel__scores-empty';
  highScoresEmpty.dataset.testid = 'high-score-empty';
  highScoresEmpty.textContent = '暂无高分记录';
  highScoresSection.appendChild(highScoresEmpty);

  const clearScoresButton = document.createElement('button');
  clearScoresButton.type = 'button';
  clearScoresButton.dataset.testid = 'settings-clear-high-scores';
  clearScoresButton.textContent = '清除高分';
  clearScoresButton.className = 'settings-panel__button';
  addListener(clearScoresButton, 'click', () => {
    options.onClearHighScores();
  });
  highScoresSection.appendChild(clearScoresButton);

  root.appendChild(highScoresSection);

  const gesturesSection = document.createElement('section');
  gesturesSection.className = 'settings-panel__section settings-panel__section--gestures';
  gesturesSection.dataset.testid = 'settings-gestures';

  const gesturesTitle = document.createElement('h3');
  gesturesTitle.className = 'settings-panel__section-title';
  gesturesTitle.textContent = '手势说明';
  gesturesSection.appendChild(gesturesTitle);

  const gestureList = document.createElement('ul');
  gestureList.className = 'settings-panel__gesture-list';

  const gestureItems = [
    '左右滑 ≥15px → 左/右移动',
    '轻点或上滑 → 顺时针旋转',
    '短下滑 <150ms → 软降',
    '长下滑 ≥150ms → 硬降',
  ];

  for (const description of gestureItems) {
    const item = document.createElement('li');
    item.textContent = description;
    gestureList.appendChild(item);
  }

  gesturesSection.appendChild(gestureList);
  root.appendChild(gesturesSection);

  function applySettings(update?: Settings) {
    if (!update) {
      return;
    }
    currentSettings = { ...update };
    for (const { key } of toggleDefinitions) {
      const input = toggleInputs[key];
      if (input) {
        input.checked = Boolean(currentSettings[key]);
      }
    }
  }

  function applyTuning(update?: ControlTuning) {
    if (!update) {
      return;
    }
    currentTuning = { ...update };
    for (const { key } of tuningDefinitions) {
      const input = tuningInputs[key];
      if (input) {
        input.value = String(currentTuning[key]);
      }
    }
  }

  function renderHighScores(entries: HighScoreEntry[]) {
    currentHighScores = [...entries];
    highScoresList.replaceChildren();

    if (currentHighScores.length === 0) {
      highScoresList.hidden = true;
      highScoresEmpty.hidden = false;
      return;
    }

    highScoresList.hidden = false;
    highScoresEmpty.hidden = true;

    currentHighScores.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'settings-panel__scores-item';
      item.dataset.testid = 'high-score-entry';
      const timestamp = formatTimestamp(entry.recordedAt);
      item.textContent = `#${index + 1} ${entry.score} 分 · ${entry.lines} 行 · Lv.${entry.level} · ${timestamp}`;
      highScoresList.appendChild(item);
    });
  }

  function formatTimestamp(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    const iso = parsed.toISOString();
    return iso.slice(0, 16).replace('T', ' ');
  }

  renderHighScores(currentHighScores);

  const panel: SettingsPanel = {
    update(update) {
      if (update.settings) {
        applySettings(update.settings);
      }
      if (update.tuning) {
        applyTuning(update.tuning);
      }
      if (update.highScores) {
        renderHighScores(update.highScores);
      }
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const dispose of cleanup.splice(0, cleanup.length)) {
        try {
          dispose();
        } catch (error) {
          // Swallow cleanup errors to avoid cascading failures during teardown.
        }
      }
      if (root.parentElement === mount) {
        mount.removeChild(root);
      }
    },
  };

  return panel;
}
