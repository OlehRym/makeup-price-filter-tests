/**
 * Єдине місце для конфігурації, що приходить із оточення.
 * Усі значення мають безпечні дефолти — проєкт запускається без .env.
 */
const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
};

const strict = process.env.STRICT_PRICE_CHECK === '1' || process.env.STRICT_PRICE_CHECK === 'true';

export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://makeup.com.ua',
  categoryPath: process.env.CATEGORY_PATH ?? '/ua/categorys/3/',
  /** Допустима частка «битих» товарів у видачі (див. README → «Знайдені дефекти»). */
  priceMismatchTolerance: strict ? 0 : num(process.env.PRICE_MISMATCH_TOLERANCE, 0.05),
  workers: num(process.env.WORKERS, 2),
  isCI: !!process.env.CI,
} as const;
