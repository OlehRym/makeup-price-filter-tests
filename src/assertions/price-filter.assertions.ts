import { expect, test, type TestInfo } from '@playwright/test';
import { CatalogApi, isProductItem, type ProductsListResponse } from '../api/catalog-api';
import type { ProductCard } from '../components/product-grid';
import { env } from '../config/env';
import type { CategoryPage } from '../pages/category-page';
import { describeRange, isInRange, type PriceRange } from '../utils/price';

export interface PriceCheckReport {
  range: string;
  checked: number;
  outOfStockSkipped: number;
  /** Ціна на картці поза діапазоном, але інший варіант товару в діапазоні — це очікувана поведінка. */
  matchedByVariant: Array<{ id: number; title: string; cardPrice: number; variantPrices: number[] }>;
  /** Жоден варіант не потрапляє в діапазон — дефект видачі. */
  violations: Array<{ id: number; title: string; cardPrice: number; variantPrices: number[] }>;
}

/**
 * Перевіряє, що кожен товар у видачі відповідає діапазону.
 *
 * Бізнес-правило фільтра: товар потрапляє у видачу, якщо БУДЬ-ЯКИЙ його варіант
 * (об'єм/склад) має ціну в діапазоні. Картка ж показує ціну варіанта за замовчуванням.
 * Тому для карток «поза діапазоном» добираємо варіанти через API товару.
 *
 * Товари, у яких жоден варіант не в діапазоні, — реальні дефекти даних на проді
 * (див. README). Вони завжди потрапляють у звіт (annotation + attachment),
 * а тест падає, якщо їх частка перевищує PRICE_MISMATCH_TOLERANCE (STRICT_PRICE_CHECK=1 → 0).
 */
export async function expectCardsMatchPriceRange(
  cards: ProductCard[],
  range: PriceRange,
  api: CatalogApi,
  testInfo: TestInfo,
): Promise<PriceCheckReport> {
  return test.step(`Ціни всіх товарів у діапазоні ${describeRange(range)}`, async () => {
    const withPrice = cards.filter((c): c is ProductCard & { price: number } => c.price !== null);
    const report: PriceCheckReport = {
      range: describeRange(range),
      checked: withPrice.length,
      outOfStockSkipped: cards.length - withPrice.length,
      matchedByVariant: [],
      violations: [],
    };

    expect(withPrice.length, 'У видачі мають бути товари з ціною').toBeGreaterThan(0);

    for (const card of withPrice.filter((c) => !isInRange(c.price, range))) {
      const details = await api.productDetails(card.id);
      const variantPrices = (details?.variants ?? [])
        .map((v) => v.price?.current)
        .filter((p): p is number => typeof p === 'number' && p > 0);
      const entry = { id: card.id, title: card.title, cardPrice: card.price, variantPrices };
      if (variantPrices.some((p) => isInRange(p, range))) report.matchedByVariant.push(entry);
      else report.violations.push(entry);
    }

    await testInfo.attach(`price-check ${report.range}.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    for (const v of report.violations) {
      testInfo.annotations.push({
        type: 'data-defect',
        description: `[${report.range}] #${v.id} «${v.title}»: картка ${v.cardPrice} ₴, варіанти [${v.variantPrices.join(', ')}] ₴`,
      });
    }

    const ratio = report.violations.length / report.checked;
    expect(
      ratio,
      `Товари поза діапазоном ${report.range} (${report.violations.length}/${report.checked}): ` +
        report.violations.map((v) => `#${v.id} ${v.cardPrice}₴`).join(', '),
    ).toBeLessThanOrEqual(env.priceMismatchTolerance);
    return report;
  });
}

/** Комплексна перевірка «фільтр застосовано коректно» — однакова для desktop і mobile. */
export async function expectPriceFilterApplied(
  categoryPage: CategoryPage,
  range: PriceRange,
  body: ProductsListResponse,
  api: CatalogApi,
  testInfo: TestInfo,
  options: { unfilteredTotal?: number } = {},
): Promise<void> {
  const { priceFilter, grid } = categoryPage;

  await test.step('Стан фільтра відображено в URL, полях і тегу', async () => {
    expect(categoryPage.priceStateFromUrl(), 'hash URL відповідає діапазону').toEqual(range);
    expect(await priceFilter.values()).toEqual({
      from: range.from === undefined ? '' : String(range.from),
      to: range.to === undefined ? '' : String(range.to),
    });
    await expect(categoryPage.priceTag, 'Тег обраного фільтра').toHaveCount(1);
    for (const bound of [range.from, range.to]) {
      if (bound !== undefined) await expect(categoryPage.priceTag).toContainText(String(bound));
    }
  });

  await test.step('Лічильник і сітка відповідають відповіді API', async () => {
    await expect(grid.total).toContainText(String(body.availableCount));
    const expectedIds = body.products.filter(isProductItem).map((p) => p.id);
    expect(await grid.readCardIds()).toEqual(expectedIds);
    if (options.unfilteredTotal !== undefined) {
      expect(body.availableCount, 'Фільтр не може збільшити кількість товарів').toBeLessThanOrEqual(
        options.unfilteredTotal,
      );
    }
  });

  await test.step('Ціни на картках збігаються з API', async () => {
    const apiPrices = new Map(body.products.filter(isProductItem).map((p) => [p.id, p]));
    for (const card of await grid.readCards()) {
      const apiProduct = apiPrices.get(card.id)!;
      if (card.price !== null) expect(card.price, `Ціна картки #${card.id}`).toBe(apiProduct.price.current);
      else expect(apiProduct.inStock, `Картка #${card.id} без ціни має бути «Немає в наявності»`).toBe(false);
    }
  });

  if (body.availableCount > 0) {
    await expectCardsMatchPriceRange(await grid.readCards(), range, api, testInfo);
  }
}

/**
 * Перевіряє сортування за ціною в межах відфільтрованої видачі.
 *
 * Ключ сортування на сайті — ціна варіанта, що потрапив у діапазон (для «від дешевих» — мінімальна,
 * для «від дорогих» — максимальна), а картка показує ціну варіанта за замовчуванням.
 * Тому там, де порядок цін на картках «ламається», ключ уточнюємо через варіанти товару.
 * Залишкові порушення порядку — дефекти; допуск той самий, що й для перевірки діапазону.
 */
export async function expectSortedByPrice(
  cards: ProductCard[],
  range: PriceRange,
  order: 'priceAsc' | 'priceDesc',
  api: CatalogApi,
  testInfo: TestInfo,
): Promise<void> {
  await test.step(`Товари відсортовані ${order === 'priceAsc' ? 'від дешевих' : 'від дорогих'}`, async () => {
    const asc = order === 'priceAsc';
    const items = cards
      .filter((c): c is ProductCard & { price: number } => c.price !== null)
      .map((c) => ({ ...c, key: c.price, refined: false }));
    expect(items.length, 'Мають бути товари з ціною').toBeGreaterThan(1);

    const outOfOrder = (prev: number, curr: number) => (asc ? curr < prev : curr > prev);
    const refine = async (item: (typeof items)[number]) => {
      if (item.refined) return;
      item.refined = true;
      const variants = ((await api.productDetails(item.id))?.variants ?? [])
        .map((v) => v.price?.current)
        .filter((p): p is number => typeof p === 'number' && p > 0 && isInRange(p, range));
      if (variants.length) item.key = asc ? Math.min(...variants) : Math.max(...variants);
    };

    // Ціни поза діапазоном одразу уточнюємо — це точно не ключ сортування.
    for (const item of items) if (!isInRange(item.price, range)) await refine(item);
    for (let i = 1; i < items.length; i++) {
      if (outOfOrder(items[i - 1].key, items[i].key)) {
        await refine(items[i - 1]);
        await refine(items[i]);
      }
    }

    const inversions = items
      .slice(1)
      .map((item, i) => ({ prev: items[i], item }))
      .filter(({ prev, item }) => outOfOrder(prev.key, item.key));
    for (const { prev, item } of inversions) {
      testInfo.annotations.push({
        type: 'sort-defect',
        description: `[${order} ${describeRange(range)}] #${prev.id} (${prev.key} ₴) → #${item.id} (${item.key} ₴)`,
      });
    }
    expect(
      inversions.length / (items.length - 1),
      `Порушення порядку: ${inversions.map(({ prev, item }) => `${prev.key}→${item.key}`).join(', ')}`,
    ).toBeLessThanOrEqual(env.priceMismatchTolerance);

    // Перша ціна — не нижче нижньої межі, остання — не вище верхньої (TC-11).
    const first = items[0].key;
    const last = items.at(-1)!.key;
    if (asc && range.from !== undefined) expect(first).toBeGreaterThanOrEqual(range.from);
    if (!asc && range.to !== undefined) expect(first).toBeLessThanOrEqual(range.to);
    if (asc && range.to !== undefined) expect(last).toBeLessThanOrEqual(range.to);
    if (!asc && range.from !== undefined) expect(last).toBeGreaterThanOrEqual(range.from);
  });
}
