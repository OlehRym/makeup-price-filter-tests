/**
 * Чисті функції для роботи з цінами та діапазонами.
 * Не залежать від Playwright — покриті unit-тестами (tests/unit).
 */

export interface PriceRange {
  /** Нижня межа (включно). undefined — без обмеження. */
  from?: number;
  /** Верхня межа (включно). undefined — без обмеження. */
  to?: number;
}

/** "1 059 ₴", "1059&nbsp;₴", "від 500" → 1059 / 500. Повертає null, якщо цифр немає. */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[\s  ]/g, '').match(/\d+(?:[.,]\d+)?/);
  if (!digits) return null;
  return Number(digits[0].replace(',', '.'));
}

/** Усі числа з рядка: "50 ₴ - 100 ₴" → [50, 100]. Пробіли-розділювачі тисяч підтримуються. */
export function extractNumbers(text: string): number[] {
  const normalized = text.replace(/(\d)[\s  ]+(?=\d{3}\b)/g, '$1');
  return (normalized.match(/\d+/g) ?? []).map(Number);
}

/**
 * Перетворює підпис кнопки-пресету на діапазон.
 *  "Менше 50 ₴"     → { to: 50 }
 *  "50 ₴ - 100 ₴"   → { from: 50, to: 100 }
 *  "Більше 5000 ₴"  → { from: 5000 }
 * Підтримує UA та RU локалі сайту.
 */
export function parsePresetLabel(label: string): PriceRange {
  const numbers = extractNumbers(label);
  if (numbers.length >= 2) return { from: numbers[0], to: numbers[1] };
  if (numbers.length === 1) {
    if (/менше|меньше|до\b|less|under/i.test(label)) return { to: numbers[0] };
    if (/більше|больше|від|от\b|more|over/i.test(label)) return { from: numbers[0] };
  }
  throw new Error(`Не вдалося розпізнати діапазон у підписі пресету: "${label}"`);
}

export function isInRange(price: number, range: PriceRange): boolean {
  if (range.from !== undefined && price < range.from) return false;
  if (range.to !== undefined && price > range.to) return false;
  return true;
}

export function describeRange(range: PriceRange): string {
  if (range.from !== undefined && range.to !== undefined) return `${range.from}–${range.to} ₴`;
  if (range.from !== undefined) return `від ${range.from} ₴`;
  if (range.to !== undefined) return `до ${range.to} ₴`;
  return 'без обмежень';
}

/** Перцентиль (nearest-rank) для побудови «живих» діапазонів із реальних даних. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error('percentile: порожній масив');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}
