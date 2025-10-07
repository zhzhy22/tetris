import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, type Locator, type Page, type Route } from '@playwright/test';

import { SETTINGS_STORAGE_KEY, HIGH_SCORES_STORAGE_KEY } from '../../src/storage/local';

import { installDeterministicRng } from './utils/deterministic';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

test.describe('offline seed reproduction', () => {
  async function ensureBuildOutput(): Promise<void> {
    try {
      await fs.access(path.join(DIST_DIR, 'index.html'));
      await fs.access(path.join(DIST_DIR, '.vite', 'manifest.json'));
    } catch {
      await new Promise<void>((resolve, reject) => {
        const task = spawn('npm', ['run', 'build'], {
          cwd: ROOT_DIR,
          stdio: 'inherit',
        });
        task.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`npm run build exited with code ${code}`));
          }
        });
        task.on('error', (error) => reject(error));
      });
    }
  }

  interface OfflineAsset {
    fsPath: string;
    contentType: string;
  }

  function detectContentType(filePath: string): string {
    if (filePath.endsWith('.html')) {
      return 'text/html; charset=utf-8';
    }
    if (filePath.endsWith('.js')) {
      return 'application/javascript; charset=utf-8';
    }
    if (filePath.endsWith('.css')) {
      return 'text/css; charset=utf-8';
    }
    if (filePath.endsWith('.json')) {
      return 'application/json; charset=utf-8';
    }
    if (filePath.endsWith('.webmanifest')) {
      return 'application/manifest+json; charset=utf-8';
    }
    if (filePath.endsWith('.svg')) {
      return 'image/svg+xml';
    }
    return 'application/octet-stream';
  }

  async function collectOfflineAssets(): Promise<Map<string, OfflineAsset>> {
    await ensureBuildOutput();

    const assets = new Map<string, OfflineAsset>();

    const register = (routePath: string, relativePath: string) => {
      const resolvedPath = path.join(DIST_DIR, relativePath);
      assets.set(routePath, {
        fsPath: resolvedPath,
        contentType: detectContentType(resolvedPath),
      });
    };

    register('/', 'index.html');
    register('/index.html', 'index.html');
    register('/sw.js', 'sw.js');
    register('/manifest.webmanifest', 'manifest.webmanifest');
    register('/vite.svg', 'vite.svg');

    const manifestBuffer = await fs.readFile(path.join(DIST_DIR, '.vite', 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestBuffer) as Record<string, { file: string; css?: string[] }>;

    for (const entry of Object.values(manifest)) {
      register(`/${entry.file}`, entry.file);
      for (const cssFile of entry.css ?? []) {
        register(`/${cssFile}`, cssFile);
      }
    }

    const assetsDir = path.join(DIST_DIR, 'assets');
    try {
      const assetFiles = await fs.readdir(assetsDir);
      for (const file of assetFiles) {
        const relative = path.join('assets', file);
        assets.set(`/${relative}`, {
          fsPath: path.join(DIST_DIR, relative),
          contentType: detectContentType(relative),
        });
      }
    } catch {
      // ignore if assets directory is missing (should not happen after build)
    }

    return assets;
  }

  async function readNumber(locator: Locator): Promise<number> {
    const text = (await locator.textContent()) ?? '0';
    const value = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(value) ? 0 : value;
  }

  async function setNumberInput(locator: Locator, value: number): Promise<void> {
    const stringValue = String(value);
    await locator.focus();
    await locator.fill(stringValue);
    await locator.evaluate((element, newValue) => {
      const input = element as HTMLInputElement;
      input.value = newValue;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, stringValue);
  }

  async function expectHarnessReady(page: Page): Promise<void> {
    await page.waitForFunction(() => Boolean(window.__TETRIS_TEST_UTILS__), undefined, {
      timeout: 2000,
    });
  }

  test('replays recorded seed offline and preserves persisted data', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Offline reproduction validated on Chromium');
    test.skip(test.info().project.name !== 'chromium-desktop', 'Offline scenario runs once on chromium-desktop project');

    await installDeterministicRng(page);
    await page.addInitScript(() => {
      window.__TETRIS_E2E__ = true;
    });

    await page.goto('/');

    await expectHarnessReady(page);

    const statusLocator = page.locator('[data-testid="status-value"]');
    await expect.poll(async () => (await statusLocator.textContent())?.trim()).toBe('Playing');

    const seedLocator = page.locator('[data-testid="seed-value"]');
    const scoreLocator = page.locator('[data-testid="score-value"]');
    const bestLocator = page.locator('[data-testid="best-value"]');
    const highScoreEntry = page.locator('[data-testid="high-score-entry"]').first();
    const highScoreEmpty = page.locator('[data-testid="high-score-empty"]');
    const root = page.locator('.tetris-app');

    const initialSeed = (await seedLocator.textContent())?.trim() ?? '';
    expect(initialSeed.length).toBeGreaterThan(0);

    const highContrastToggle = page.locator('[data-testid="settings-toggle-highContrast"]');
    await highContrastToggle.check();
    await expect(highContrastToggle).toBeChecked();
    await expect(root).toHaveAttribute('data-high-contrast', 'true');

    const dasInput = page.locator('[data-testid="settings-tuning-dasMs"]');
    await setNumberInput(dasInput, 200);
    await expect(dasInput).toHaveValue('200');
    await page.waitForTimeout(50);

    await page.keyboard.press('Space');
    await expect.poll(async () => readNumber(scoreLocator)).toBeGreaterThan(0);

    await page.evaluate(() => {
      window.__TETRIS_TEST_UTILS__?.forceGameOver();
    });

    await expect.poll(async () => (await statusLocator.textContent())?.trim()).toBe('Game Over');

    const finalScore = await readNumber(scoreLocator);
    expect(finalScore).toBeGreaterThan(0);
    const bestScore = await readNumber(bestLocator);
    expect(bestScore).toBeGreaterThanOrEqual(finalScore);

  await expect(highScoreEntry).toBeVisible();
  await expect(highScoreEntry).toContainText(`${finalScore} 分`);
    await expect(highScoreEmpty).toBeHidden();

    const storedSettings = await page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_STORAGE_KEY);
    expect(storedSettings).not.toBeNull();

    await expect.poll(async () => {
      const snapshot = await page.evaluate((key) => window.localStorage.getItem(key), HIGH_SCORES_STORAGE_KEY);
      return snapshot !== null;
    }).toBe(true);

    const storedHighScores = await page.evaluate((key) => window.localStorage.getItem(key), HIGH_SCORES_STORAGE_KEY);

    const offlineAssets = await collectOfflineAssets();
    let offlineMode = false;

  const offlineHandler = async (route: Route) => {
      if (!offlineMode) {
        await route.continue();
        return;
      }

      if (route.request().method() !== 'GET') {
  await route.fulfill({ status: 204, body: '' });
        return;
      }

  const url = new URL(route.request().url());
      const pathname = url.pathname === '' ? '/' : url.pathname;
      const asset = offlineAssets.get(pathname);

      if (!asset) {
  await route.fulfill({ status: 404, body: 'offline asset missing' });
        return;
      }

      const body = await fs.readFile(asset.fsPath);
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': asset.contentType,
          'cache-control': 'no-cache',
        },
        body,
      });
    };

    await page.route('**/*', offlineHandler);

    offlineMode = true;
    await context.setOffline(true);

    await page.reload({ waitUntil: 'domcontentloaded' });

  await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(false);

    await expect.poll(async () => (await statusLocator.textContent())?.trim()).toBe('Playing');

    const seedAfterReload = (await seedLocator.textContent())?.trim() ?? '';
    expect(seedAfterReload).toBe(initialSeed);

  await expect(root).toHaveAttribute('data-high-contrast', 'true');

  const bestAfterReload = await readNumber(bestLocator);
  expect(bestAfterReload).toBe(bestScore);

  const reloadedHighScoreEntry = page.locator('[data-testid="high-score-entry"]').first();
  await expect(reloadedHighScoreEntry).toBeVisible();
  await expect(reloadedHighScoreEntry).toContainText(`${finalScore} 分`);
  await expect(page.locator('[data-testid="high-score-empty"]')).toBeHidden();

  const settingsAfterReload = await page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_STORAGE_KEY);
  const highscoresAfterReload = await page.evaluate((key) => window.localStorage.getItem(key), HIGH_SCORES_STORAGE_KEY);
    expect(settingsAfterReload).toBe(storedSettings);
    expect(highscoresAfterReload).toBe(storedHighScores);

    offlineMode = false;
    await context.setOffline(false);
    await page.unroute('**/*', offlineHandler);
  });
});
