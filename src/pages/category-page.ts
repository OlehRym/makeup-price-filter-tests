import { Page, Locator, expect } from '@playwright/test';
import { PriceFilter } from '../components/price-filter';
import { parsePrice } from '../utils/price';

/**
 * Сторінка категорії товарів, наприклад «Парфумерія» (/ua/categorys/3/).
 */
export class CategoryPage {
  readonly priceFilter: PriceFilter;

  /** Лічильник «28801 товар» / «324 товари». На mobile він прихований, але текст є в DOM. */
  readonly productCount: Locator;

  /** Поточні ціни товарів (зі знижкою, якщо є) тільки в каталозі, без рекомендацій. */
  readonly prices: Locator;

  constructor(readonly page: Page, isMobile: boolean) {
    this.priceFilter = new PriceFilter(page, isMobile);
    this.productCount = page.getByText(/^\d+ товар/).first();
    this.prices = page.locator('.Products__cards .Price__priceCurrent');
  }

  async open(path = '/ua/categorys/3/'): Promise<void> {
    await this.closePopupsAutomatically();
    await this.page.goto(path);
    // Чекаємо гідратацію React: інакше перші кліки по фільтру ігноруються.
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Застосувати пресет ціни і дочекатися, поки список товарів оновиться.
   * URL змінюється одразу, а товари підвантажуються ~1 с пізніше,
   * тому орієнтуємось на зміну лічильника.
   */
  async applyPricePreset(name: string): Promise<void> {
    const before = await this.productCount.textContent();
    await this.priceFilter.applyPreset(name);
    await expect(this.productCount).not.toHaveText(before!);
  }

  async getPrices(): Promise<number[]> {
    const texts = await this.prices.allTextContents();
    return texts.map(parsePrice);
  }

  /**
   * Попапи з'являються не завжди і в різний момент, тому не закриваємо їх через if,
   * а реєструємо обробники: Playwright сам закриє попап, якщо той заважатиме дії.
   */
  private async closePopupsAutomatically(): Promise<void> {
    // Підказка «Отримуйте більше з MAKEUP Rewards» перекриває кнопку «Фільтр» на mobile.
    await this.page.addLocatorHandler(
      this.page.locator('.RewardsTooltipContent__close'),
      async (closeButton) => {
        await closeButton.click();
      },
    );
    // Банер cookie перекриває кнопку «Застосувати» внизу екрана на mobile.
    await this.page.addLocatorHandler(
      this.page.getByRole('button', { name: 'Погоджуюсь', exact: true }),
      async (acceptButton) => {
        await acceptButton.click();
      },
    );
  }
}
