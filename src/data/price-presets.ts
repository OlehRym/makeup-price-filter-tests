/**
 * Пресети фільтра «Ціна» на makeup.com.ua.
 * У крайніх пресетів лише одна межа: «Менше 50 ₴» має тільки `to`, «Більше 5000 ₴» тільки `from`.
 */
export type PricePreset = {
  name: string;
  from?: number;
  to?: number;
};

export const PRICE_PRESETS: PricePreset[] = [
  { name: 'Менше 50 ₴', to: 50 },
  { name: '50 ₴ - 100 ₴', from: 50, to: 100 },
  { name: '100 ₴ - 250 ₴', from: 100, to: 250 },
  { name: '250 ₴ - 500 ₴', from: 250, to: 500 },
  { name: '500 ₴ - 750 ₴', from: 500, to: 750 },
  { name: '750 ₴ - 1000 ₴', from: 750, to: 1000 },
  { name: '1000 ₴ - 5000 ₴', from: 1000, to: 5000 },
  { name: 'Більше 5000 ₴', from: 5000 },
];
