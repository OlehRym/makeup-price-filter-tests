import { expectTotalsClose } from '../../src/assertions/counts';
import { expect, test } from '../../src/fixtures';
import { percentile } from '../../src/utils/price';

/**
 * Відомі дефекти, знайдені під час написання тестів (деталі — у README).
 * Позначені test.fixme: не валять прогін, але видимі у звіті й легко вмикаються
 * після виправлення (просто прибрати .fixme). Кожен перевірено: без .fixme — червоний.
 */
test.describe('Фільтр «Ціна» — відомі дефекти', () => {
  test.beforeEach(async ({ categoryPage }) => {
    await categoryPage.open();
  });

  // TC-06. Фактично: запит priceFrom=high&priceTo=low повертає лише товари з ціною рівно «Від»
  // (десятки замість тисяч) — без жодного повідомлення користувачу.
  test.fixme('«Від» більше за «До»: межі міняються місцями (або показується валідація)', async ({ categoryPage, catalogApi }) => {
    const prices = (await categoryPage.grid.readCards()).map((c) => c.price).filter((p): p is number => !!p);
    const low = percentile(prices, 25);
    const high = percentile(prices, 75);

    const body = await categoryPage.setPriceRange({ from: high, to: low });

    const expected = await catalogApi.availableCount(categoryPage.categoryId, { from: low, to: high });
    expectTotalsClose(body.availableCount, expected, 'Видача «Від > До» має дорівнювати видачі переставленого діапазону');
  });

  // TC-08. Фактично: «150.50» → 15050, «150,50» → 50 — фільтр застосовується до зовсім іншої суми.
  test.fixme('дробове значення округлюється, а не склеюється в інше число', async ({ categoryPage }) => {
    await categoryPage.priceFilter.open();

    for (const input of ['150.50', '150,50']) {
      const value = await categoryPage.priceFilter.typeInto('from', input);
      expect(['150', '151'], `«${input}» → «${value}»`).toContain(value);
    }
  });

  // TC-15. Фактично: Enter у полі нічого не робить, фільтр застосовується лише на blur.
  test.fixme('Enter у полі ціни застосовує фільтр', async ({ categoryPage }) => {
    await categoryPage.priceFilter.open();
    const prices = (await categoryPage.grid.readCards()).map((c) => c.price).filter((p): p is number => !!p);
    const from = Math.min(...prices);

    const responsePromise = categoryPage.page.waitForResponse(categoryPage.productsResponse({ from }), { timeout: 5_000 });
    await categoryPage.priceFilter.fromInput.fill(String(from));
    await categoryPage.priceFilter.fromInput.press('Enter');
    await responsePromise;
  });
});
