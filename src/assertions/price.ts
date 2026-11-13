import { expect } from '@playwright/test';

export type PriceRange = { from?: number; to?: number };

/**
 * Перевірити, що список не порожній і кожна ціна в межах діапазону.
 * soft-перевірки: у звіті видно ВСІ ціни поза діапазоном, а не лише першу.
 */
export function expectPricesInRange(prices: number[], range: PriceRange): void {
  expect(prices.length, 'на сторінці мають бути товари').toBeGreaterThan(0);

  prices.forEach((price, index) => {
    if (range.from !== undefined) {
      expect.soft(price, `товар #${index + 1}`).toBeGreaterThanOrEqual(range.from);
    }
    if (range.to !== undefined) {
      expect.soft(price, `товар #${index + 1}`).toBeLessThanOrEqual(range.to);
    }
  });
}
