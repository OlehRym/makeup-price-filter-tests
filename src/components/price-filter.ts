import { expect, type Locator, type Page } from '@playwright/test';
import { parsePresetLabel, type PriceRange } from '../utils/price';
import { sel } from './selectors';

/**
 * Фільтр «Вартість» (у ТЗ — «Ціна»).
 *
 * Desktop: блок завжди в лівій колонці.
 * Mobile:  блок у шторці «Фільтр», яку треба відкрити і підтвердити «Застосувати».
 * Різниця інкапсульована тут — тести однакові для обох платформ.
 *
 * Поведінка UI (з'ясовано під час дослідження):
 *  - пресет застосовується одразу по кліку;
 *  - поля «Від»/«До» застосовуються на blur (не на кожен символ і не на Enter);
 *  - стан пишеться в hash: #price_from=500&price_to=750.
 */
export class PriceFilter {
  readonly header: Locator;
  readonly presets: Locator;
  readonly fromInput: Locator;
  readonly toInput: Locator;
  readonly mobileOpenButton: Locator;
  readonly mobileApplyButton: Locator;
  readonly mobileClearButton: Locator;

  constructor(
    page: Page,
    private readonly isMobile: boolean,
  ) {
    this.header = page.locator(sel.priceFilter.header);
    this.presets = page.locator(sel.priceFilter.presets);
    const inputs = page.locator(sel.priceFilter.inputs);
    this.fromInput = inputs.nth(0);
    this.toInput = inputs.nth(1);
    this.mobileOpenButton = page.getByRole('button', { name: /Фільтр|Фильтр/ });
    const panel = page.locator(sel.filters.panel);
    this.mobileApplyButton = panel.getByRole('button', { name: /Застосувати|Применить/ });
    this.mobileClearButton = panel.getByRole('button', { name: /Очистити|Очистить/ });
  }

  /** Mobile: відкрити шторку «Фільтр» (якщо ще закрита). Desktop: сайдбар і так видимий. */
  async openPanel(): Promise<void> {
    if (this.isMobile && !(await this.header.isVisible())) {
      await this.mobileOpenButton.click();
    }
  }

  /** Робить блок ціни видимим і готовим до взаємодії на будь-якій платформі. */
  async open(): Promise<void> {
    await this.openPanel();
    await expect(this.header, 'Секція «Вартість» має бути видимою').toBeVisible();
    // Секція може бути згорнута — розгортаємо лише за потреби (клік по заголовку — toggle).
    if (!(await this.presets.first().isVisible())) {
      await this.header.click();
    }
    await expect(this.presets.first()).toBeVisible();
    await expect(this.fromInput).toBeVisible();
  }

  /** Mobile: «Застосувати» закриває шторку. Desktop: фільтр уже застосований — нічого робити. */
  async confirm(): Promise<void> {
    if (!this.isMobile) return;
    await this.mobileApplyButton.click();
    await expect(this.fromInput, 'Шторка фільтрів має закритися після «Застосувати»').toBeHidden();
  }

  /** Закрити шторку без змін (mobile); на desktop — нічого. */
  async close(): Promise<void> {
    if (this.isMobile && (await this.fromInput.isVisible())) await this.confirm();
  }

  /** Згорнути/розгорнути акордеон «Вартість». */
  async toggleSection(): Promise<void> {
    await this.header.click();
  }

  async presetLabels(): Promise<string[]> {
    const labels = await this.presets.allInnerTexts();
    return labels.map((l) => l.replace(/\s+/g, ' ').trim());
  }

  async presetRanges(): Promise<Array<{ label: string; range: PriceRange }>> {
    return (await this.presetLabels()).map((label) => ({ label, range: parsePresetLabel(label) }));
  }

  async clickPreset(label: string): Promise<void> {
    await this.presets.filter({ hasText: label }).first().click();
  }

  async fillFrom(value: number | string): Promise<void> {
    await this.fillAndCommit(this.fromInput, String(value));
  }

  async fillTo(value: number | string): Promise<void> {
    await this.fillAndCommit(this.toInput, String(value));
  }

  /** Посимвольний ввід (як користувач) — для перевірки санітизації поля. */
  async typeInto(field: 'from' | 'to', text: string): Promise<string> {
    const input = field === 'from' ? this.fromInput : this.toInput;
    await input.click();
    await input.clear();
    await input.pressSequentially(text);
    return input.inputValue();
  }

  async values(): Promise<{ from: string; to: string }> {
    return { from: await this.fromInput.inputValue(), to: await this.toInput.inputValue() };
  }

  /** Mobile: кнопка «Очистити» у шторці. */
  async clearInDrawer(): Promise<void> {
    await this.mobileClearButton.click();
  }

  private async fillAndCommit(input: Locator, value: string): Promise<void> {
    await input.fill(value);
    // Фільтр комітиться по blur — саме так його застосовує реальний користувач.
    await input.blur();
  }
}
