import { test, expect, type Page } from '@playwright/test';
import type { GameSessionState } from '../../src/core/game-loop';
import AxeBuilder from '@axe-core/playwright';
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

const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'] as const;
const STATUS_LOCATOR = '[data-testid="status-value"]';

async function expectHarnessReady(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__TETRIS_TEST_UTILS__), undefined, {
    timeout: 2000,
  });
}

async function waitForStatus(page: Page, expected: string): Promise<void> {
  const status = page.locator(STATUS_LOCATOR);
  await expect.poll(async () => (await status.textContent())?.trim()).toBe(expected);
}

async function expectNoAxeViolations(page: Page, options: { description: string; includeSelector?: string }) {
  let builder = new AxeBuilder({ page }).withTags([...A11Y_TAGS]);
  if (options.includeSelector) {
    builder = builder.include(options.includeSelector);
  }
  const results = await builder.analyze();
  const violationMessage = formatViolations(results.violations, options.description);
  expect(results.violations, violationMessage).toEqual([]);
}

function formatViolations(
  violations: Array<{
    id: string;
    impact?: string | null;
    description?: string;
    helpUrl?: string;
    nodes: Array<{
      target: string[];
      failureSummary?: string;
    }>;
  }>,
  description: string,
): string {
  if (violations.length === 0) {
    return `${description}: no accessibility violations.`;
  }
  return [
    `${description}: found ${violations.length} accessibility violation(s).`,
    ...violations.map((violation) => {
      const targets = violation.nodes
        .map((node) => node.target.join(' '))
        .join(', ');
      const impact = violation.impact ?? 'unknown impact';
      const summaries = violation.nodes
        .map((node) => node.failureSummary)
        .filter((summary): summary is string => Boolean(summary))
        .join(' | ');
      const details = summaries || violation.description || '';
      const help = violation.helpUrl ? `See: ${violation.helpUrl}` : '';
      return `${violation.id} (${impact}) → ${targets} ${details} ${help}`.trim();
    }),
  ].join('\n');
}

async function pauseGame(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__TETRIS_TEST_UTILS__?.pause();
  });
  await waitForStatus(page, 'Paused');
}

test.beforeEach(async ({ page }) => {
  await installDeterministicRng(page);
  await page.addInitScript(() => {
    window.__TETRIS_E2E__ = true;
  });
});

test.describe('accessibility compliance', () => {
  test('opening state meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await expectHarnessReady(page);
    await waitForStatus(page, 'Playing');
    await expectNoAxeViolations(page, { description: 'opening state' });
  });

  test('settings panel meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await expectHarnessReady(page);
    await waitForStatus(page, 'Playing');
    await pauseGame(page);
    await expectNoAxeViolations(page, {
      description: 'settings panel',
      includeSelector: '.settings-panel',
    });
  });

  test('game over state meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await expectHarnessReady(page);
    await waitForStatus(page, 'Playing');
    await page.evaluate(() => {
      window.__TETRIS_TEST_UTILS__?.forceGameOver();
    });
    await waitForStatus(page, 'Game Over');
    await expectNoAxeViolations(page, { description: 'game over state' });
  });
});
