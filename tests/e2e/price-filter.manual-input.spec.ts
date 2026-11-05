import { expectPriceFilterApplied } from '../../src/assertions/price-filter.assertions';
import { expect, test } from '../../src/fixtures';
import { percentile, type PriceRange } from '../../src/utils/price';

/**
 * Діапазони будуються з реальних цін на сторінці без фільтра (перцентилі),
 * тому тести не залежать від конкретних товарів і завжди мають непорожню видачу.
 */
test.describe('Фільтр «Ціна» — ручне введення «Від» / «До»', () => {
  let unfilteredTotal: number;
  let livePrices: number[];

  test.beforeEach(async ({ categoryPage }) => {
    await categoryPage.open();
    unfilteredTotal = await categoryPage.grid.totalCount();
    livePrices = (await categoryPage.grid.readCards())
      .map((c) => c.price)
      .filter((p): p is number => p !== null && p > 0);
    expect(livePrices.length, 'На сторінці без фільтра мають бути товари з ціною').toBeGreaterThan(5);
  });

  test('діапазон «Від – До» показує лише товари в межах діапазону', async ({ categoryPage, catalogApi }, testInfo) => {
    const range: PriceRange = { from: percentile(livePrices, 25), to: percentile(livePrices, 75) };
    testInfo.annotations.push({ type: 'range', description: JSON.stringify(range) });

    const body = await categoryPage.setPriceRange(range);

    expect(body.availableCount).toBeGreaterThan(0);
    await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo, { unfilteredTotal });
  });

  test('лише нижня межа «Від»', async ({ categoryPage, catalogApi }, testInfo) => {
    const range: PriceRange = { from: percentile(livePrices, 50) };

    const body = await categoryPage.setPriceRange(range);

    expect(body.availableCount).toBeGreaterThan(0);
    await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo, { unfilteredTotal });
  });

  test('лише верхня межа «До»', async ({ categoryPage, catalogApi }, testInfo) => {
    const range: PriceRange = { to: percentile(livePrices, 50) };

    const body = await categoryPage.setPriceRange(range);

    expect(body.availableCount).toBeGreaterThan(0);
    await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo, { unfilteredTotal });
  });

  test('межі діапазону включні: «Від» = «До» = ціна наявного товару', async ({ categoryPage, catalogApi }, testInfo) => {
    // Ціна, яка точно є в каталозі прямо зараз, — товар з нею мусить знайтися.
    const exactPrice = percentile(livePrices, 50);
    const range: PriceRange = { from: exactPrice, to: exactPrice };

    const body = await categoryPage.setPriceRange(range);

    expect(body.availableCount, `Товар із ціною рівно ${exactPrice} ₴ має потрапити у видачу`).toBeGreaterThan(0);
    await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo, { unfilteredTotal });
  });

  test('діапазон без товарів показує порожню видачу', async ({ categoryPage }) => {
    // Свідомо недосяжна межа — не залежить від асортименту.
    const range: PriceRange = { from: 99_999_999 };

    const body = await categoryPage.setPriceRange(range);

    expect(body.availableCount).toBe(0);
    await expect(categoryPage.grid.total).toContainText('0');
    await expect(categoryPage.grid.cards).toHaveCount(0);
    await expect(categoryPage.priceTag).toContainText(String(range.from));
  });

  test('поля приймають лише цифри', async ({ categoryPage }) => {
    const { priceFilter } = categoryPage;
    await priceFilter.open();

    for (const field of ['from', 'to'] as const) {
      for (const input of ['abc', '12a3', '-100', '1.5', '1 000', '₴500']) {
        const value = await priceFilter.typeInto(field, input);
        expect(value, `«${field}» після вводу "${input}"`).toMatch(/^\d*$/);
      }
      expect(await priceFilter.typeInto(field, '1250'), 'Коректне число вводиться повністю').toBe('1250');
    }
  });
});
