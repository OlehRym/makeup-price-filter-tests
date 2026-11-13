import { Page, Locator, expect } from '@playwright/test';
import { PriceFilter } from '../components/price-filter';
import { parsePrice } from '../utils/price';

/**
 * API списку товарів категорії. Зараз це GET /shop/v1/categories/{id}/products/?priceFrom=..&offset=0
 * Якщо адреса API зміниться — правити тільки тут.
 */
const PRODUCTS_API_PATH = /\/products\/$/;

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

  /**
   * Ввести діапазон вручну в поля «Від» / «До».
   *
   * Кожне поле застосовується окремо (при blur) і перезавантажує список товарів.
   * Якщо ввести «До», поки список ще оновлюється після «Від», сайт затирає «До» (баг),
   * тому після кожного поля чекаємо відповідь API.
   */
  async applyPriceRange(range: { from?: number; to?: number }): Promise<void> {
    await this.priceFilter.open();
    if (range.from !== undefined) {
      const from = String(range.from);
      await this.waitForProductsReload(() => this.priceFilter.setFrom(from), { priceFrom: from });
    }
    if (range.to !== undefined) {
      const to = String(range.to);
      await this.waitForProductsReload(() => this.priceFilter.setTo(to), { priceTo: to });
    }
    await this.priceFilter.apply();
  }

  /**
   * Виконати дію і дочекатися відповіді API зі списком товарів саме для потрібного фільтра.
   *
   * Чекаємо не «будь-яку» відповідь, а ту, де в параметрах є очікувані значення
   * (наприклад priceFrom=200) — так не зловимо стару відповідь від попереднього кроку.
   * Шлях перевіряємо лише за кінцем «/products/», щоб тест не ламався від зміни
   * версії чи префікса API (/shop/v1/... → /api/v2/...).
   *
   * Очікування реєструємо ДО дії, інакше можна пропустити швидку відповідь.
   */
  private async waitForProductsReload(
    action: () => Promise<void>,
    expectedParams: Record<string, string>,
  ): Promise<void> {
    const productsResponse = this.page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return (
          response.request().method() === 'GET' &&
          PRODUCTS_API_PATH.test(url.pathname) &&
          Object.entries(expectedParams).every(([key, value]) => url.searchParams.get(key) === value)
        );
      },
      { timeout: 15_000 },
    );
    await action();
    try {
      await productsResponse;
    } catch {
      throw new Error(
        `Не дочекались відповіді API товарів з параметрами ${JSON.stringify(expectedParams)}. ` +
          `Можливо, змінилась адреса API (очікуємо шлях ${PRODUCTS_API_PATH}) — перевір вкладку Network.`,
      );
    }
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
