import { test, expect, type Locator } from '@playwright/test';

import { installDeterministicRng } from './utils/deterministic';
import { performSwipe, waitForFrame, readScore } from './utils/touch';

test.describe('touch tuning', () => {
  test('applies updated thresholds immediately', async ({ page }) => {
    await installDeterministicRng(page);

    await page.goto('/');

    const canvas = page.locator('[data-testid="playfield-canvas"]');
    const score = page.locator('[data-testid="score-value"]');
    const status = page.locator('[data-testid="status-value"]');

    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await status.textContent())?.trim()).toBe('Playing');

    const swipeInput = page.locator('[data-testid="settings-tuning-swipeThresholdPx"]');
    const softDropInput = page.locator('[data-testid="settings-tuning-softDropDurationMs"]');
    const hardDropInput = page.locator('[data-testid="settings-tuning-hardDropDurationMs"]');

    const moveFeedback = page.locator('[data-gesture="move"]');
    const softDropFeedback = page.locator('[data-gesture="soft-drop"]');
    const hardDropFeedback = page.locator('[data-gesture="hard-drop"]');

    const setNumberInput = async (locator: Locator, value: number) => {
      const stringValue = String(value);
      await locator.focus();
      await locator.fill(stringValue);
      await locator.evaluate((element, newValue) => {
        const input = element as HTMLInputElement;
        input.value = newValue;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, stringValue);
      await waitForFrame(page);
    };

    const isActive = async (locator: Locator) =>
      locator.evaluate((element) => element.classList.contains('touch-feedback__item--active'));

    await waitForFrame(page);

    // High swipe threshold should ignore subtle movement.
    await setNumberInput(swipeInput, 25);
    await performSwipe(page, canvas, { dx: 12, dy: 0, durationMs: 80, pointerId: 11 });
    await page.waitForTimeout(120);
    expect(await isActive(moveFeedback)).toBe(false);

    await page.waitForTimeout(520);

    // Lowering threshold enables the same gesture to register.
    await setNumberInput(swipeInput, 10);
    await performSwipe(page, canvas, { dx: 12, dy: 0, durationMs: 80, pointerId: 12 });
    await page.waitForTimeout(80);
    expect(await isActive(moveFeedback)).toBe(true);

    await page.waitForTimeout(520);

    // Configure drop durations for soft drop scenario.
    await setNumberInput(softDropInput, 200);
    await setNumberInput(hardDropInput, 200);

    const softBaseline = await readScore(score);
    await performSwipe(page, canvas, { dx: 0, dy: 160, durationMs: 150, pointerId: 21 });
    await page.waitForTimeout(120);
    expect(await isActive(softDropFeedback)).toBe(true);
    expect(await isActive(hardDropFeedback)).toBe(false);
    await expect.poll(() => readScore(score)).toBeGreaterThan(softBaseline);
    const softScoreAfter = await readScore(score);
    const softDelta = softScoreAfter - softBaseline;

    await page.waitForTimeout(520);

    // Reduce hard drop requirement to trigger an immediate hard drop with the same gesture.
    await setNumberInput(hardDropInput, 120);

    const hardBaseline = await readScore(score);
    await performSwipe(page, canvas, { dx: 0, dy: 160, durationMs: 150, pointerId: 22 });
    await page.waitForTimeout(120);
    expect(await isActive(hardDropFeedback)).toBe(true);
    expect(await isActive(softDropFeedback)).toBe(false);
    await expect.poll(() => readScore(score)).toBeGreaterThan(hardBaseline + softDelta + 10);
  });
});
