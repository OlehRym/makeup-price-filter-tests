import { test, expect } from '../src/fixtures';
import { PRICE_PRESETS } from '../src/data/price-presets';
import { expectPricesInRange } from '../src/assertions/price';

test.describe('Фільтр «Ціна»: пресети', () => {
  for (const preset of PRICE_PRESETS) {
    test(`пресет «${preset.name}» показує лише товари в діапазоні`, async ({ categoryPage }) => {
      await categoryPage.open();
      await categoryPage.applyPricePreset(preset.name);

      // URL: є лише ті межі, які має пресет
      if (preset.from !== undefined) {
        await expect(categoryPage.page).toHaveURL(new RegExp(`price_from=${preset.from}(&|$)`));
      }
      if (preset.to !== undefined) {
        await expect(categoryPage.page).toHaveURL(new RegExp(`price_to=${preset.to}(&|$)`));
      }

      expectPricesInRange(await categoryPage.getPrices(), preset);
    });
  }
});
