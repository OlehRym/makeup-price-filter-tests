import { expectTotalsClose } from '../../src/assertions/counts';
import { expectCardsMatchPriceRange, expectPriceFilterApplied } from '../../src/assertions/price-filter.assertions';
import { expect, test } from '../../src/fixtures';
import type { PriceRange } from '../../src/utils/price';

/**
 * Життєвий цикл фільтра: deep link, перезавантаження, пагінація, скидання.
 * Діапазон беремо з першого пресету з обома межами — значення не хардкодяться.
 */
test.describe('Фільтр «Ціна» — стан і скидання', () => {
  let range: PriceRange;
  let unfilteredTotal: number;

  test.beforeEach(async ({ categoryPage }) => {
    await categoryPage.open();
    unfilteredTotal = await categoryPage.grid.totalCount();
    await categoryPage.priceFilter.open();
    const preset = (await categoryPage.priceFilter.presetRanges()).find(
      (p) => p.range.from !== undefined && p.range.to !== undefined,
    );
    expect(preset, 'Потрібен пресет з обома межами').toBeDefined();
    range = preset!.range;
    await categoryPage.priceFilter.close();
  });

  test('посилання з фільтром у URL відкриває вже відфільтровану видачу', async ({ categoryPage, catalogApi }, testInfo) => {
    const body = await categoryPage.openWithPriceHash(range);

    await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo, { unfilteredTotal });
  });

  test('фільтр зберігається після перезавантаження сторінки', async ({ categoryPage, catalogApi }, testInfo) => {
    await categoryPage.setPriceRange(range);

    const body = await categoryPage.reload();

    await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo, { unfilteredTotal });
  });

  test('«Показати ще» довантажує товари з тим самим фільтром', async ({ categoryPage, catalogApi }, testInfo) => {
    const firstPage = await categoryPage.setPriceRange(range);
    test.skip(firstPage.availableCount <= firstPage.perPage, 'Діапазон вміщується в одну сторінку');

    const secondPage = await categoryPage.loadMore(range, firstPage.perPage);

    expectTotalsClose(secondPage.availableCount, firstPage.availableCount, 'Загальна кількість не змінюється при довантаженні');
    const cards = await categoryPage.grid.readCards();
    const newCards = cards.slice(-secondPage.products.filter((p) => p.type === 'product').length);
    await expectCardsMatchPriceRange(newCards, range, catalogApi, testInfo);
  });

  test('видалення тегу фільтра повертає повну видачу', async ({ categoryPage }) => {
    await categoryPage.setPriceRange(range);
    await expect(categoryPage.priceTag).toBeVisible();

    const body = await categoryPage.applyPriceFilter({}, () => categoryPage.priceTag.click());

    expectTotalsClose(body.availableCount, unfilteredTotal, 'Після скидання — повний каталог');
    await expect(categoryPage.grid.total).toContainText(String(body.availableCount));
    await expect(categoryPage.priceTag).toHaveCount(0);
    expect(categoryPage.priceStateFromUrl()).toEqual({ from: undefined, to: undefined });
    expect(await categoryPage.priceFilter.values()).toEqual({ from: '', to: '' });
  });

  test.describe('desktop', () => {
    test.skip(({ isMobile }) => isMobile, 'На mobile кнопка «Зняти фільтри» прихована — там є «Очистити» у шторці');

    test('«Зняти фільтри» скидає фільтр ціни', async ({ categoryPage }) => {
      await categoryPage.setPriceRange(range);

      const body = await categoryPage.applyPriceFilter({}, () => categoryPage.clearAllTagsButton.click());

      expectTotalsClose(body.availableCount, unfilteredTotal, 'Після скидання — повний каталог');
      await expect(categoryPage.priceTag).toHaveCount(0);
      expect(categoryPage.priceStateFromUrl()).toEqual({ from: undefined, to: undefined });
    });
  });

  test.describe('mobile', () => {
    test.skip(({ isMobile }) => !isMobile, 'Кнопка «Очистити» є лише в мобільній шторці фільтрів');

    test('«Очистити» у шторці скидає фільтр і закриває шторку', async ({ categoryPage }) => {
      await categoryPage.setPriceRange(range);
      await categoryPage.priceFilter.open();

      const body = await categoryPage.applyPriceFilter({}, () => categoryPage.priceFilter.clearInDrawer());

      expectTotalsClose(body.availableCount, unfilteredTotal, 'Після скидання — повний каталог');
      await expect(categoryPage.priceFilter.fromInput).toBeHidden();
      await expect(categoryPage.priceTag).toHaveCount(0);
      expect(await categoryPage.priceFilter.values()).toEqual({ from: '', to: '' });
    });
  });
});
