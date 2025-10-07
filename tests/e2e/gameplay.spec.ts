import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameSessionState } from '../../src/core/game-loop';
import { installDeterministicRng } from './utils/deterministic';

declare global {
  interface Window {
    __TETRIS_E2E__?: boolean;
    __TETRIS_TEST_UTILS__?: {
      pause(): void;
      resume(): void;
      forceGameOver(): void;
      getState(): GameSessionState;
    };
  }
}

const STATUS_LOCATOR = '[data-testid="status-value"]';
const SCORE_LOCATOR = '[data-testid="score-value"]';
const BEST_LOCATOR = '[data-testid="best-value"]';
const HOLD_PREVIEW_LOCATOR = '[data-testid="hold-preview"]';
const HIGH_SCORE_ENTRY_LOCATOR = '[data-testid="high-score-entry"]';
const HIGH_SCORE_EMPTY_LOCATOR = '[data-testid="high-score-empty"]';

async function expectHarnessReady(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__TETRIS_TEST_UTILS__), undefined, {
    timeout: 2000,
  });
}

async function waitForStatus(page: Page, expected: string): Promise<void> {
  const status = page.locator(STATUS_LOCATOR);
  await expect.poll(async () => (await status.textContent())?.trim()).toBe(expected);
}

async function getState(page: Page): Promise<GameSessionState> {
  return page.evaluate(() => {
    const harness = window.__TETRIS_TEST_UTILS__;
    if (!harness) {
      throw new Error('Test harness is not available');
    }
    return harness.getState();
  });
}

async function readNumber(locator: Locator): Promise<number> {
  const text = (await locator.textContent())?.trim() ?? '0';
  const value = Number.parseInt(text, 10);
  return Number.isNaN(value) ? 0 : value;
}

function expectActivePiece(state: GameSessionState) {
  if (!state.active) {
    throw new Error('Expected active piece to be present');
  }
  return state.active;
}

test.describe('gameplay journey', () => {
  test.beforeEach(async ({ page }) => {
    await installDeterministicRng(page);
    await page.addInitScript(() => {
      window.__TETRIS_E2E__ = true;
      try {
        window.localStorage?.clear();
      } catch (error) {
        console.warn('Failed to clear localStorage before test run', error);
      }
    });
  });

  test('plays through key user actions and records a high score', async ({ page }) => {
    await page.goto('/');

    await expectHarnessReady(page);

    const canvas = page.locator('[data-testid="playfield-canvas"]');
    await expect(canvas).toBeVisible();

    await waitForStatus(page, 'Playing');

    const statusLocator = page.locator(STATUS_LOCATOR);
    const scoreLocator = page.locator(SCORE_LOCATOR);
    const bestLocator = page.locator(BEST_LOCATOR);
    const holdPreview = page.locator(HOLD_PREVIEW_LOCATOR);

    const initialState = await getState(page);
    const initialActive = expectActivePiece(initialState);
    const initialColumn = initialActive.position.col;
    const initialRotation = initialActive.rotation;

    await page.keyboard.press('ArrowRight');

    await expect.poll(async () => {
      const state = await getState(page);
      const active = expectActivePiece(state);
      return active.position.col;
    }).toBe(initialColumn + 1);

    await page.keyboard.press('ArrowUp');

    await expect.poll(async () => {
      const state = await getState(page);
      const active = expectActivePiece(state);
      return active.rotation;
    }).toBe((initialRotation + 1) % 4);

    const softDropBaseline = initialState.stats.dropDistanceSoft;
    await page.keyboard.press('ArrowDown');

    await expect.poll(async () => {
      const state = await getState(page);
      return state.stats.dropDistanceSoft;
    }).toBeGreaterThan(softDropBaseline);

    const scoreBeforeHardDrop = await readNumber(scoreLocator);

    await page.keyboard.press('Space');

    await expect.poll(async () => {
      const state = await getState(page);
      return state.stats.score;
    }).toBeGreaterThan(scoreBeforeHardDrop);

    await expect.poll(async () => {
      const state = await getState(page);
      return state.phase;
    }).toBe('playing');

    await page.waitForTimeout(50);
    await page.keyboard.press('KeyC');

    await expect.poll(async () => {
      const state = await getState(page);
      return state.hold ?? null;
    }).not.toBeNull();

    await expect.poll(async () => holdPreview.getAttribute('data-piece')).not.toBe('none');
    await expect(holdPreview).toHaveAttribute('data-used', 'true');

    await page.keyboard.press('KeyP');
    await waitForStatus(page, 'Paused');

    await page.evaluate(() => {
      window.__TETRIS_TEST_UTILS__?.resume();
    });
    await waitForStatus(page, 'Playing');

    const scoreBeforeGameOver = await readNumber(scoreLocator);
    expect(scoreBeforeGameOver).toBeGreaterThan(0);

    await page.evaluate(() => {
      window.__TETRIS_TEST_UTILS__?.forceGameOver();
    });
    await waitForStatus(page, 'Game Over');

    await expect.poll(async () => readNumber(bestLocator)).toBeGreaterThanOrEqual(scoreBeforeGameOver);

    const highScoreEntry = page.locator(HIGH_SCORE_ENTRY_LOCATOR).first();
    await expect(highScoreEntry).toBeVisible();
    await expect(highScoreEntry).toContainText(`${scoreBeforeGameOver} 分`);

    const highScoreEmpty = page.locator(HIGH_SCORE_EMPTY_LOCATOR);
    await expect(highScoreEmpty).toBeHidden();

    await expect.poll(async () => (await statusLocator.textContent())?.trim()).toBe('Game Over');
  });
});
