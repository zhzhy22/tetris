import { test, expect } from '@playwright/test';
import { installDeterministicRng } from './utils/deterministic';

test.describe('responsive layout', () => {
  test('renders consistent layout snapshots across desktop, tablet, and mobile breakpoints', async ({ page }) => {
    await installDeterministicRng(page);

    await page.goto('/');

    const canvas = page.locator('[data-testid="playfield-canvas"]');
    await expect(canvas).toBeVisible();

    await page.addStyleTag({
      content: '* { transition-duration: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }',
    });

    const pauseButton = page.locator('[data-action="pause"]');
    await pauseButton.scrollIntoViewIfNeeded();
    await pauseButton.click();

    const viewports = [
      { name: 'desktop', size: { width: 1280, height: 720 } },
      { name: 'tablet', size: { width: 1024, height: 768 } },
      { name: 'mobile', size: { width: 414, height: 896 } },
    ] as const;

    for (const viewport of viewports) {
      await test.step(`viewport: ${viewport.name}`, async () => {
        await page.setViewportSize(viewport.size);
        await page.waitForTimeout(150);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page).toHaveScreenshot(`responsive-${viewport.name}.png`, {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          scale: 'css',
        });
      });
    }
  });
});
