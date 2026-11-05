import { expectCardsMatchPriceRange, expectPriceFilterApplied, expectSortedByPrice } from '../../src/assertions/price-filter.assertions';
import { isProductItem } from '../../src/api/catalog-api';
import { expect, test } from '../../src/fixtures';
import { CategoryPage, type SortOrder } from '../../src/pages/category-page';
import { percentile, type PriceRange } from '../../src/utils/price';

/** Діапазон p25–p75 з живих цін поточної видачі — непорожній і з різними цінами всередині. */
async function liveRange(categoryPage: CategoryPage): Promise<PriceRange> {
  const prices = (await categoryPage.grid.readCards()).map((c) => c.price).filter((p): p is number => !!p);
  expect(prices.length, 'Потрібні товари з ціною для побудови діапазону').toBeGreaterThan(3);
  return { from: percentile(prices, 25), to: percentile(prices, 75) };
}

test.describe('Фільтр «Ціна» — взаємодія з іншими елементами', () => {
  test.beforeEach(async ({ categoryPage }) => {
    await categoryPage.open();
  });

  // TC-10
  test('комбінація з фільтром «Бренд»: товари відповідають обом критеріям', async ({ categoryPage, catalogApi }, testInfo) => {
    const [brand] = await categoryPage.brandFilter.visibleBrands();
    expect(brand, 'У блоці «Бренд» має бути хоча б один бренд').toBeTruthy();
    testInfo.annotations.push({ type: 'brand', description: `${brand.name} (#${brand.id})` });

    const brandBody = await categoryPage.chooseBrand(brand);
    const brandTotal = brandBody.availableCount;
    const range = await liveRange(categoryPage);

    const body = await categoryPage.setPriceRange(range);

    await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo, { unfilteredTotal: brandTotal });
    await test.step(`Усі товари — бренду «${brand.name}»`, async () => {
      const brandIds = body.products.filter(isProductItem).map((p) => p.brand.id);
      expect(brandIds.length).toBeGreaterThan(0);
      expect(new Set(brandIds)).toEqual(new Set([brand.id]));
    });
    expect(categoryPage.hashParams().toString(), 'Обидва фільтри збережено в URL').toMatch(/o%5B\d+%5D|o\[\d+\]/);
  });

  // TC-11
  for (const order of ['priceAsc', 'priceDesc'] as SortOrder[]) {
    test(`сортування ${order === 'priceAsc' ? '«Від найдешевших»' : '«Від найдорожчих»'} у межах діапазону`, async ({ categoryPage, catalogApi }, testInfo) => {
      const range = await liveRange(categoryPage);
      await categoryPage.setPriceRange(range);

      const body = await categoryPage.sortBy(order);

      expect(categoryPage.hashParams().get('sort'), 'Сортування збережено в URL').toBe(order);
      await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo);
      await expectSortedByPrice(await categoryPage.grid.readCards(), range, order, catalogApi, testInfo);
    });
  }

  // TC-12 (перехід за номером сторінки; довантаження «Показати ще» — у state.spec)
  test('перехід на 2-гу сторінку пагінації зберігає фільтр', async ({ categoryPage, catalogApi }, testInfo) => {
    const range = await liveRange(categoryPage);
    const firstPage = await categoryPage.setPriceRange(range);
    test.skip(firstPage.availableCount <= firstPage.perPage, 'Діапазон вміщується в одну сторінку');
    const firstIds = await categoryPage.grid.readCardIds();

    const secondPage = await categoryPage.goToPage(2, firstPage.perPage);

    expect(categoryPage.priceStateFromUrl(), 'Фільтр збережено в URL 2-ї сторінки').toEqual(range);
    const secondIds = await categoryPage.grid.readCardIds();
    expect(secondIds.filter((id) => firstIds.includes(id)), 'Друга сторінка — інші товари').toHaveLength(0);
    expect(secondIds).toEqual(secondPage.products.filter(isProductItem).map((p) => p.id));
    await expectCardsMatchPriceRange(await categoryPage.grid.readCards(), range, catalogApi, testInfo);
  });

  // TC-13
  test('посилання з фільтром відкривається в новій вкладці', async ({ categoryPage, catalogApi, context, isMobile }, testInfo) => {
    const range = await liveRange(categoryPage);
    await categoryPage.setPriceRange(range);
    const copiedUrl = categoryPage.page.url();
    expect(new URL(copiedUrl).hash).toBe(CategoryPage.hashFor(range));

    const tab = new CategoryPage(await context.newPage(), isMobile);
    const body = await tab.openWithPriceHash(range);

    expect(tab.page.url()).toBe(copiedUrl);
    await expectPriceFilterApplied(tab, range, body, catalogApi, testInfo);
  });

  // TC-13
  test('кнопки браузера «Назад» / «Вперед» відновлюють попередній стан фільтра', async ({ categoryPage, catalogApi }, testInfo) => {
    await categoryPage.priceFilter.open();
    const presets = (await categoryPage.priceFilter.presetRanges()).filter(
      (p) => p.range.from !== undefined && p.range.to !== undefined,
    );
    expect(presets.length, 'Потрібно два пресети з обома межами').toBeGreaterThanOrEqual(2);
    const [first, second] = [presets[0], presets.at(-1)!];

    await categoryPage.choosePreset(first.label, first.range);
    await categoryPage.choosePreset(second.label, second.range);

    const back = await categoryPage.applyPriceFilter(first.range, async () => {
      await categoryPage.page.goBack();
    });
    await expectPriceFilterApplied(categoryPage, first.range, back, catalogApi, testInfo);

    const forward = await categoryPage.applyPriceFilter(second.range, async () => {
      await categoryPage.page.goForward();
    });
    await expectPriceFilterApplied(categoryPage, second.range, forward, catalogApi, testInfo);
  });
});
