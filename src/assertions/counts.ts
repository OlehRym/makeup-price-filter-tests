import { expect } from '@playwright/test';

/**
 * Каталог «живий»: між двома запитами з різницею в секунди кількість товарів може
 * зміститися на одиниці (наявність, ціни, промо). Строго порівнюємо лише значення,
 * отримані в один момент (UI ↔ відповідь API), а між різними моментами — з допуском.
 */
export function expectTotalsClose(actual: number, expected: number, message: string, relTolerance = 0.01): void {
  const allowed = Math.max(5, Math.ceil(expected * relTolerance));
  expect(Math.abs(actual - expected), `${message}: ${actual} vs ${expected} (допуск ±${allowed})`).toBeLessThanOrEqual(allowed);
}
