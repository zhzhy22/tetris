import { expect, test } from '@playwright/test';

import { installDeterministicRng } from './utils/deterministic';

test.describe('smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installDeterministicRng(page);
  });

  test('loads the landing page', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="playfield-canvas"]');
    await expect(canvas).toBeVisible();

    const status = page.locator('[data-testid="status-value"]');
    await expect.poll(async () => (await status.textContent())?.trim()).toBe('Playing');
  });
});
