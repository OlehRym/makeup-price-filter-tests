import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

/**
 * Два UI-проєкти (desktop / mobile) запускають ОДНІ Й ТІ САМІ e2e-специ —
 * платформна різниця інкапсульована в PriceFilter.
 * Окремий проєкт `unit` — швидкі тести чистих утиліт без браузера.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.isCI,
  // Тестуємо прод: мережа й WAF дають рідкі збої інфраструктури — один ретрай з трейсом.
  retries: env.isCI ? 2 : 1,
  // Тестуємо продакшен за WAF: більше паралельності → троттлінг (ERR_TIMED_OUT, «завислі» API).
  // 2 воркери — перевірений баланс швидкості й стабільності; змінюється через WORKERS.
  workers: env.workers,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: env.isCI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
    },
    {
      name: 'desktop-chrome',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chrome',
      testDir: './tests/e2e',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
