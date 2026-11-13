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

  /** Поля ручного введення. Не мають label/placeholder, тому шукаємо за класом. */
  readonly fromInput: Locator;
  readonly toInput: Locator;

  constructor(private readonly page: Page, private readonly isMobile: boolean) {
    // Ім'я кнопки містить текст іконки: "makeup-filter-bold-outlineФільтр", тому regex.
    this.openButton = page.getByRole('button', { name: /Фільтр/ }).first();
    this.applyButton = page.getByRole('button', { name: 'Застосувати', exact: true });
    this.fromInput = page.locator('.PriceSelector__input').first();
    this.toInput = page.locator('.PriceSelector__input').last();
  }

  /**
   * Ввести значення в «Від» і застосувати.
   * Фільтр застосовується ТІЛЬКИ при втраті фокусу (Enter не працює),
   * а fill() фокус не знімає — тому blur().
   */
  async setFrom(value: string): Promise<void> {
    await this.fromInput.fill(value);
    await this.fromInput.blur();
  }

  /** Те саме для «До». */
  async setTo(value: string): Promise<void> {
    await this.toInput.fill(value);
    await this.toInput.blur();
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
