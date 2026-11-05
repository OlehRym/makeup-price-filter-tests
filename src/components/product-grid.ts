import { expect, type Locator, type Page } from '@playwright/test';
import { isProductItem, type ProductsListResponse } from '../api/catalog-api';
import { parsePrice } from '../utils/price';
import { sel } from './selectors';

export interface ProductCard {
  id: number;
  title: string;
  /** Поточна ціна з картки; null — ціна не показується (немає в наявності). */
  price: number | null;
}

/** Сітка товарів категорії (без промо-карток і каруселей). */
export class ProductGrid {
  readonly cards: Locator;
  readonly total: Locator;
  readonly loadMoreButton: Locator;

  constructor(page: Page) {
    this.cards = page.locator(sel.products.card);
    this.total = page.locator(sel.products.total);
    this.loadMoreButton = page.locator(sel.products.loadMore).getByRole('button', { name: /Показати ще|Показать еще/ });
  }

  /** Лічильник «N товарів» над сіткою. */
  async totalCount(): Promise<number> {
    const text = await this.total.innerText();
    const value = parsePrice(text);
    if (value === null) throw new Error(`Не вдалося прочитати кількість товарів з "${text}"`);
    return value;
  }

  /** Знімок усіх карток одним evaluate — швидко і без гонок між окремими локаторами. */
  async readCards(): Promise<ProductCard[]> {
    const raw = await this.cards.evaluateAll(
      (nodes, s) =>
        nodes.map((node) => {
          const title = node.querySelector(s.cardTitle);
          return {
            href: title?.getAttribute('href') ?? '',
            title: title?.textContent?.trim() ?? '',
            priceText: node.querySelector(s.cardPrice)?.textContent ?? null,
          };
        }),
      { cardTitle: sel.products.cardTitle, cardPrice: sel.products.cardPrice },
    );
    return raw.map((card) => ({
      id: Number(card.href.match(/\/product\/(\d+)/)?.[1] ?? NaN),
      title: card.title,
      price: parsePrice(card.priceText),
    }));
  }

  async readCardIds(): Promise<number[]> {
    return (await this.readCards()).map((c) => c.id);
  }

  /**
   * Чекає, доки DOM відобразить саме цю відповідь API (ті самі товари в тому ж порядку).
   * Це надійна синхронізація замість sleep: перевіряємо результат, а не час.
   * @param alreadyRendered скільки карток було до цієї відповіді («Показати ще» додає в кінець).
   */
  async waitForRendered(body: ProductsListResponse, alreadyRendered = 0): Promise<void> {
    const expectedIds = body.products.filter(isProductItem).map((p) => p.id);
    await expect
      .poll(async () => (await this.readCardIds()).slice(alreadyRendered), {
        message: 'Сітка товарів має відобразити відповідь API фільтра',
        timeout: 15_000,
      })
      .toEqual(expectedIds);
  }
}
