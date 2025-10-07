import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 5173);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: /.*a11y\.spec\.ts$/,
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
      testIgnore: /.*a11y\.spec\.ts$/,
    },
    {
      name: 'chromium-a11y',
      testMatch: /.*a11y\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: /.*(?:a11y|responsive)\.spec\.ts$/,
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: /.*(?:a11y|responsive)\.spec\.ts$/,
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port ' + PORT,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
