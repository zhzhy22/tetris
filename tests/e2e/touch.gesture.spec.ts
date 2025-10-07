import { test, expect } from '@playwright/test';
import { performSwipe, captureCanvas, readScore, waitForFrame } from './utils/touch';

test.describe('touch gesture controls', () => {
  test('support horizontal movement and drop gestures across viewports', async ({ page }) => {
    await page.goto('/');

  const canvas = page.locator('[data-testid="playfield-canvas"]');
  const score = page.locator('[data-testid="score-value"]');
  const status = page.locator('[data-testid="status-value"]');

    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await status.textContent())?.trim()).toBe('Playing');

    await waitForFrame(page);

    const beforeMovementSnapshot = await captureCanvas(canvas);
    await performSwipe(page, canvas, { dx: 64, dy: 0, durationMs: 80, pointerId: 1 });
    await waitForFrame(page);
    const afterMovementSnapshot = await captureCanvas(canvas);
    expect(afterMovementSnapshot).not.toBe(beforeMovementSnapshot);

    const baselineScore = await readScore(score);
    await performSwipe(page, canvas, { dx: 0, dy: 48, durationMs: 80, pointerId: 2 });
    await expect.poll(async () => await readScore(score)).toBeGreaterThan(baselineScore);

    const postSoftDropScore = await readScore(score);
    await performSwipe(page, canvas, { dx: 0, dy: 120, durationMs: 240, pointerId: 3 });
    await expect.poll(async () => await readScore(score)).toBeGreaterThan(postSoftDropScore);
  });
});

