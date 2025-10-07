import type { Locator, Page } from '@playwright/test';

export async function performSwipe(
  page: Page,
  element: Locator,
  options: { dx: number; dy: number; durationMs: number; pointerId: number },
): Promise<void> {
  const box = await element.boundingBox();
  if (!box) {
    throw new Error('Element bounding box unavailable');
  }
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const endX = startX + options.dx;
  const endY = startY + options.dy;

  await page.dispatchEvent('[data-testid="playfield-canvas"]', 'pointerdown', {
    pointerId: options.pointerId,
    pointerType: 'touch',
    clientX: startX,
    clientY: startY,
  });
  await page.dispatchEvent('[data-testid="playfield-canvas"]', 'pointermove', {
    pointerId: options.pointerId,
    pointerType: 'touch',
    clientX: endX,
    clientY: endY,
  });
  await page.waitForTimeout(Math.max(0, options.durationMs));
  await page.dispatchEvent('[data-testid="playfield-canvas"]', 'pointerup', {
    pointerId: options.pointerId,
    pointerType: 'touch',
    clientX: endX,
    clientY: endY,
  });
  await page.waitForTimeout(50);
}

export async function readScore(score: Locator): Promise<number> {
  const text = (await score.textContent()) ?? '0';
  const value = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(value) ? 0 : value;
}

export async function captureCanvas(canvas: Locator): Promise<string> {
  return canvas.evaluate((element) => {
    const node = element as HTMLCanvasElement;
    const context = node.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    return node.toDataURL();
  });
}

export async function waitForFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}
