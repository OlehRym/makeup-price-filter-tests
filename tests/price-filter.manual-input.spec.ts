import { test, expect } from '../src/fixtures';
import { expectPricesInRange, PriceRange } from '../src/assertions/price';

const RANGES: { title: string; range: PriceRange }[] = [
  { title: 'від 200 до 400', range: { from: 200, to: 400 } },
  { title: 'тільки «Від» 5000', range: { from: 5000 } },
  { title: 'тільки «До» 50', range: { to: 50 } },
];

test.describe('Фільтр «Ціна»: ручне введення', () => {
  for (const { title, range } of RANGES) {
    test(`${title}: показує лише товари в діапазоні`, async ({ categoryPage }) => {
      await categoryPage.open();
      await categoryPage.applyPriceRange(range);

      const { page, priceFilter } = categoryPage;

      // URL і поля: є рівно ті межі, які ввели
      if (range.from !== undefined) {
        await expect(page).toHaveURL(new RegExp(`price_from=${range.from}(&|$)`));
        await expect(priceFilter.fromInput).toHaveValue(String(range.from));
      } else {
        await expect(page).not.toHaveURL(/price_from=/);
      }
      if (range.to !== undefined) {
        await expect(page).toHaveURL(new RegExp(`price_to=${range.to}(&|$)`));
        await expect(priceFilter.toInput).toHaveValue(String(range.to));
      } else {
        await expect(page).not.toHaveURL(/price_to=/);
      }

      expectPricesInRange(await categoryPage.getPrices(), range);
    });
  }
});
