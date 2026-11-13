import { test, expect } from '../src/fixtures';

test('пресет «50 ₴ - 100 ₴» показує лише товари в цьому діапазоні', async ({ categoryPage }) => {
  await categoryPage.open();
  await categoryPage.applyPricePreset('50 ₴ - 100 ₴');

  await expect(categoryPage.page).toHaveURL(/price_from=50&price_to=100/);

  const prices = await categoryPage.getPrices();
  expect(prices.length, 'на сторінці мають бути товари').toBeGreaterThan(0);

  for (const price of prices) {
    expect(price).toBeGreaterThanOrEqual(50);
    expect(price).toBeLessThanOrEqual(100);
  }
});
