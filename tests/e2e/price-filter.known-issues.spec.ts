import { expect, test } from '../../src/fixtures';
import { isInRange } from '../../src/utils/price';

/**
 * Відомі дефекти, знайдені під час написання тестів (деталі — у README).
 * Позначені test.fixme: не валять прогін, але видимі у звіті й легко вмикаються
 * після виправлення (просто прибрати .fixme).
 */
test.describe('Фільтр «Ціна» — відомі дефекти', () => {
  test.fixme('«Від» більше за «До»: фільтр має міняти межі місцями або показувати валідацію', async ({ categoryPage }) => {
    await categoryPage.open();
    const prices = (await categoryPage.grid.readCards()).map((c) => c.price).filter((p): p is number => !!p);
    const low = Math.min(...prices);
    const high = Math.max(...prices);

    // Фактично: запит priceFrom=high&priceTo=low повертає товари з ціною рівно high —
    // і жодної помилки для користувача.
    const body = await categoryPage.setPriceRange({ to: low, from: high });

    const swapped = { from: low, to: high };
    const cards = await categoryPage.grid.readCards();
    expect(body.availableCount).toBeGreaterThan(0);
    for (const card of cards) if (card.price !== null) expect(isInRange(card.price, swapped)).toBe(true);
  });
});
