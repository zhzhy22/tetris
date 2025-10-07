import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSettingsPanel,
  type Settings,
  type SettingsPanel,
  type SettingsPanelOptions,
} from '../../../src/ui/settings-panel';
import type { HighScoreEntry } from '../../../src/storage/local';
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

const tuningLimits = {
  dasMs: { min: 150, max: 220 },
  arrMs: { min: 30, max: 60 },
  swipeThresholdPx: { min: 10, max: 25 },
  softDropDurationMs: { min: 120, max: 200 },
  hardDropDurationMs: { min: 120, max: 200 },
} as const;

const defaultHighScores: HighScoreEntry[] = [
  { score: 32100, lines: 120, level: 14, recordedAt: '2024-03-24T12:00:00.000Z' },
  { score: 22000, lines: 90, level: 10, recordedAt: '2024-03-23T09:30:00.000Z' },
];

afterEach(() => {
  document.body.innerHTML = '';
});

function setup(overrides: Partial<SettingsPanelOptions> = {}) {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const onSettingsChange = vi.fn();
  const onTuningChange = vi.fn();
  const onResetTuning = vi.fn();
  const onClearHighScores = vi.fn();

  const options: SettingsPanelOptions = {
    mount,
    settings: defaultSettings,
    tuning: defaultTuning,
    tuningLimits,
    highScores: defaultHighScores,
    onSettingsChange,
    onTuningChange,
    onResetTuning,
    onClearHighScores,
    ...overrides,
  };

  const panel = createSettingsPanel(options);

  return {
    panel,
    mount,
    options,
    onSettingsChange,
    onTuningChange,
    onResetTuning,
    onClearHighScores,
    highScores: options.highScores,
  };
}

describe('ui/settings-panel', () => {
  it('reflects toggle state and emits settings changes on interaction', () => {
    const { mount, onSettingsChange } = setup();

    const highContrastToggle = mount.querySelector<HTMLInputElement>(
      '[data-testid="settings-toggle-highContrast"]',
    );
    const ghostToggle = mount.querySelector<HTMLInputElement>(
      '[data-testid="settings-toggle-showGhost"]',
    );
    const soundToggle = mount.querySelector<HTMLInputElement>(
      '[data-testid="settings-toggle-soundEnabled"]',
    );

    expect(highContrastToggle?.checked).toBe(false);
    expect(ghostToggle?.checked).toBe(true);
    expect(soundToggle?.checked).toBe(true);

    if (!highContrastToggle || !ghostToggle || !soundToggle) {
      throw new Error('Expected toggle inputs to be rendered');
    }

    highContrastToggle.checked = true;
    highContrastToggle.dispatchEvent(new Event('change', { bubbles: true }));
    ghostToggle.checked = false;
    ghostToggle.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onSettingsChange).toHaveBeenNthCalledWith(1, {
      ...defaultSettings,
      highContrast: true,
    });
    expect(onSettingsChange).toHaveBeenNthCalledWith(2, {
      ...defaultSettings,
      highContrast: true,
      showGhost: false,
    });
  });

  it('updates toggle state when settings change externally', () => {
    const { mount, panel } = setup();

    panel.update({
      settings: {
        ...defaultSettings,
        highContrast: true,
        soundEnabled: false,
      },
    });

    const highContrastToggle = mount.querySelector<HTMLInputElement>(
      '[data-testid="settings-toggle-highContrast"]',
    );
    const soundToggle = mount.querySelector<HTMLInputElement>(
      '[data-testid="settings-toggle-soundEnabled"]',
    );

    expect(highContrastToggle?.checked).toBe(true);
    expect(soundToggle?.checked).toBe(false);
  });

  it('clamps tuning values to provided limits before emitting changes', () => {
    const { mount, onTuningChange } = setup();

    const arrInput = mount.querySelector<HTMLInputElement>('[data-testid="settings-tuning-arrMs"]');
    const dasInput = mount.querySelector<HTMLInputElement>('[data-testid="settings-tuning-dasMs"]');

    if (!arrInput || !dasInput) {
      throw new Error('Expected tuning inputs to be rendered');
    }

    arrInput.value = '5';
    arrInput.dispatchEvent(new Event('change', { bubbles: true }));
    dasInput.value = '400';
    dasInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onTuningChange).toHaveBeenNthCalledWith(1, { arrMs: tuningLimits.arrMs.min });
    expect(onTuningChange).toHaveBeenNthCalledWith(2, { dasMs: tuningLimits.dasMs.max });
  });

  it('reflects tuning updates pushed from external sources', () => {
    const { mount, panel } = setup();

    panel.update({
      tuning: {
        ...defaultTuning,
        arrMs: 55,
        swipeThresholdPx: 20,
      },
    });

    const arrInput = mount.querySelector<HTMLInputElement>('[data-testid="settings-tuning-arrMs"]');
    const swipeInput = mount.querySelector<HTMLInputElement>(
      '[data-testid="settings-tuning-swipeThresholdPx"]',
    );

    expect(arrInput?.value).toBe('55');
    expect(swipeInput?.value).toBe('20');
  });

  it('renders gesture instructions for reference', () => {
    const { mount } = setup();

    const gestureSection = mount.querySelector('[data-testid="settings-gestures"]');
    expect(gestureSection).toBeTruthy();

    const items = gestureSection?.querySelectorAll('li') ?? [];
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items[0]?.textContent).toMatch(/左右滑/);
  });

  it('invokes reset callback and clears DOM on destroy', () => {
    const { mount, panel, onResetTuning } = setup();

    const resetButton = mount.querySelector<HTMLButtonElement>(
      '[data-testid="settings-reset-tuning"]',
    );

    expect(resetButton).toBeTruthy();
    resetButton?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onResetTuning).toHaveBeenCalledTimes(1);

    const initialChildren = mount.childElementCount;
    expect(initialChildren).toBeGreaterThan(0);

    panel.destroy();

    expect(mount.childElementCount).toBe(0);
  });

  it('renders high score entries and updates list when data changes', () => {
    const { mount, panel } = setup();

    const listItems = Array.from(
      mount.querySelectorAll('[data-testid="high-score-entry"]'),
    );
    expect(listItems.length).toBe(2);
    expect(listItems[0]?.textContent).toContain('32100');

    panel.update({
      highScores: [
        { score: 99999, lines: 150, level: 18, recordedAt: '2024-03-25T15:00:00.000Z' },
      ],
    });

    const updatedItems = Array.from(
      mount.querySelectorAll('[data-testid="high-score-entry"]'),
    );
    expect(updatedItems.length).toBe(1);
    expect(updatedItems[0]?.textContent).toContain('99999');
  });

  it('calls clear callback when clear button is pressed', () => {
    const { mount, onClearHighScores } = setup();

    const clearButton = mount.querySelector<HTMLButtonElement>(
      '[data-testid="settings-clear-high-scores"]',
    );

    expect(clearButton).toBeTruthy();
    clearButton?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(onClearHighScores).toHaveBeenCalledTimes(1);
  });
});
