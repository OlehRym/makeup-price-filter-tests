import { expectPriceFilterApplied } from '../../src/assertions/price-filter.assertions';
import { expect, test } from '../../src/fixtures';
import { percentile, type PriceRange } from '../../src/utils/price';

/** Платформна специфіка: де живе фільтр і як він відкривається/застосовується. */
test.describe('Фільтр «Ціна» — desktop vs mobile', () => {
  let range: PriceRange;

  test.beforeEach(async ({ categoryPage }) => {
    await categoryPage.open();
    const prices = (await categoryPage.grid.readCards()).map((c) => c.price).filter((p): p is number => !!p);
    range = { from: percentile(prices, 25), to: percentile(prices, 75) };
  });

  test.describe('desktop', () => {
    test.skip(({ isMobile }) => isMobile, 'Сценарій сайдбару — лише desktop');

    // TC-15
    test('блок ціни доступний у сайдбарі без додаткових кліків і застосовується по blur', async ({ categoryPage, catalogApi }, testInfo) => {
      const { priceFilter } = categoryPage;
      await expect(priceFilter.mobileOpenButton, 'Кнопки «Фільтр» на desktop немає').toBeHidden();
      await expect(priceFilter.header).toBeVisible();
      await expect(priceFilter.presets.first()).toBeVisible();
      await expect(priceFilter.fromInput).toBeEditable();
      await expect(priceFilter.toInput).toBeEditable();

      // Без жодних підготовчих кліків: ввід + blur одразу застосовують фільтр.
      await categoryPage.applyPriceFilter({ from: range.from }, () => priceFilter.fillFrom(range.from!));
      const body = await categoryPage.applyPriceFilter(range, () => priceFilter.fillTo(range.to!));

      await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo);
    });
  });

  test.describe('mobile', () => {
    test.skip(({ isMobile }) => !isMobile, 'Сценарій шторки — лише mobile');

    // TC-14
    test('фільтр у шторці: відкрити → акордеон «Вартість» → ввести → «Застосувати»', async ({ categoryPage, catalogApi }, testInfo) => {
      const { priceFilter } = categoryPage;
      await expect(priceFilter.fromInput, 'До відкриття шторки поля приховані').toBeHidden();

      await priceFilter.mobileOpenButton.click();
      await expect(priceFilter.header).toBeVisible();

      await test.step('Акордеон «Вартість» згортається і розгортається', async () => {
        const wasExpanded = await priceFilter.presets.first().isVisible();
        await priceFilter.toggleSection();
        await expect(priceFilter.presets.first()).toBeVisible({ visible: !wasExpanded });
        if (wasExpanded) await priceFilter.toggleSection();
        await expect(priceFilter.presets.first()).toBeVisible();
      });

      await categoryPage.applyPriceFilter({ from: range.from }, () => priceFilter.fillFrom(range.from!));
      const body = await categoryPage.applyPriceFilter(range, () => priceFilter.fillTo(range.to!));
      await priceFilter.confirm(); // перевіряє, що шторка закрилась

      await expectPriceFilterApplied(categoryPage, range, body, catalogApi, testInfo);
    });
  });
});
