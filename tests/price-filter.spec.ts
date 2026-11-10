import { test, expect } from '@playwright/test';

test('Check presets for filter Price', async ({ page }) => {
  await page.goto('/ua/categorys/3');
  await page.waitForLoadState('networkidle');
  const counter = page.getByText(/^\d+ товар/).first();
  const before = await counter.textContent();

  await page.getByRole('button', { name: '50 ₴ - 100 ₴', exact: true }).click();

  await expect(page).toHaveURL(/price_from=50&price_to=100/);
  await expect(counter).not.toHaveText(before!);

  const texts = await page.locator('.Products__cards .Price__priceCurrent').allTextContents();
  expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
    const price = parseInt(text.replace(/\D/g, ''), 10);

    expect(price).toBeGreaterThanOrEqual(50);
    expect(price).toBeLessThanOrEqual(100);
    }
});