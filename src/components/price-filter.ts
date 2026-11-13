import { Page, Locator } from '@playwright/test';

/**
 * Фільтр «Ціна» на сторінці категорії.
 *
 * Desktop: фільтр завжди відкритий у боковій панелі, пресет застосовується одразу.
 * Mobile:  фільтр схований у модалці за кнопкою «Фільтр»,
 *          після вибору пресета треба натиснути «Застосувати».
 */
export class PriceFilter {
  private readonly openButton: Locator;
  private readonly applyButton: Locator;

  constructor(private readonly page: Page, private readonly isMobile: boolean) {
    // Ім'я кнопки містить текст іконки: "makeup-filter-bold-outlineФільтр", тому regex.
    this.openButton = page.getByRole('button', { name: /Фільтр/ }).first();
    this.applyButton = page.getByRole('button', { name: 'Застосувати', exact: true });
  }

  /** Кнопка пресета, наприклад "50 ₴ - 100 ₴". */
  preset(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  async open(): Promise<void> {
    if (this.isMobile) {
      await this.openButton.click();
    }
  }

  async apply(): Promise<void> {
    if (this.isMobile) {
      await this.applyButton.click();
    }
  }

  async applyPreset(name: string): Promise<void> {
    await this.open();
    await this.preset(name).click();
    await this.apply();
  }
}
