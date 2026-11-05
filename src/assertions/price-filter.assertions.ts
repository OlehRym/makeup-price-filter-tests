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
