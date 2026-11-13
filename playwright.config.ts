import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Живий сайт: не навантажуємо його і не тригеримо антибот.
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'https://makeup.com.ua',
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-max',
      use: {
        ...devices['Desktop Chrome'],
        viewport: null,
        deviceScaleFactor: undefined,
        launchOptions: { args: ['--start-maximized'] },
      },
   },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
