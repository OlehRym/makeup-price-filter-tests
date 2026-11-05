import { expect, test } from '@playwright/test';
import {
  describeRange,
  extractNumbers,
  isInRange,
  parsePresetLabel,
  parsePrice,
  percentile,
} from '../../src/utils/price';

test.describe('utils/price', () => {
  test('parsePrice: різні формати відображення ціни', () => {
    expect(parsePrice('1059 ₴')).toBe(1059);
    expect(parsePrice('1 059 ₴')).toBe(1059);
    expect(parsePrice('12 345 грн')).toBe(12345);
    expect(parsePrice('28488 товарів')).toBe(28488);
    expect(parsePrice('Немає в наявності')).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });

  test('extractNumbers: діапазон із підпису', () => {
    expect(extractNumbers('50 ₴ - 100 ₴')).toEqual([50, 100]);
    expect(extractNumbers('1 000 ₴ - 5 000 ₴')).toEqual([1000, 5000]);
  });

  test('parsePresetLabel: усі типи пресетів (UA/RU)', () => {
    expect(parsePresetLabel('Менше 50 ₴')).toEqual({ to: 50 });
    expect(parsePresetLabel('Меньше 50 ₴')).toEqual({ to: 50 });
    expect(parsePresetLabel('500 ₴ - 750 ₴')).toEqual({ from: 500, to: 750 });
    expect(parsePresetLabel('Більше 5000 ₴')).toEqual({ from: 5000 });
    expect(parsePresetLabel('Больше 5000 ₴')).toEqual({ from: 5000 });
    expect(() => parsePresetLabel('Акції')).toThrow();
  });

  test('isInRange: межі включні, відкриті діапазони', () => {
    expect(isInRange(500, { from: 500, to: 750 })).toBe(true);
    expect(isInRange(750, { from: 500, to: 750 })).toBe(true);
    expect(isInRange(499, { from: 500, to: 750 })).toBe(false);
    expect(isInRange(751, { from: 500, to: 750 })).toBe(false);
    expect(isInRange(1, { to: 50 })).toBe(true);
    expect(isInRange(1e6, { from: 5000 })).toBe(true);
    expect(isInRange(10, {})).toBe(true);
  });

  test('describeRange', () => {
    expect(describeRange({ from: 1, to: 2 })).toBe('1–2 ₴');
    expect(describeRange({ from: 1 })).toBe('від 1 ₴');
    expect(describeRange({ to: 2 })).toBe('до 2 ₴');
  });

  test('percentile', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([10, 20, 30, 40], 25)).toBe(10);
    expect(percentile([10, 20, 30, 40], 100)).toBe(40);
    expect(() => percentile([], 50)).toThrow();
  });
});
