import { expect, type Locator, type Page } from '@playwright/test';
import type { PriceFilter } from './price-filter';
import { sel } from './selectors';

export interface BrandOption {
  id: number;
  name: string;
}

/** Фільтр «Бренд» — потрібен лише для перевірки комбінації з фільтром ціни. */
export class BrandFilter {
  readonly options: Locator;

  constructor(
    page: Page,
    private readonly panel: PriceFilter,
  ) {
    this.options = page.locator(sel.filters.brandOption);
  }

  /** Бренди, видимі у блоці зараз (список віртуалізований — лише відрендерені рядки). */
  async visibleBrands(): Promise<BrandOption[]> {
    await this.panel.openPanel();
    await expect(this.options.first()).toBeVisible();
    const raw = await this.options.evaluateAll((nodes) =>
      nodes.map((n) => ({
        href: n.getAttribute('href') ?? '',
        // Перший текстовий вузол — назва; далі лічильник «(198)» та іконка-лігатура.
        name: n.querySelector('label')?.textContent?.split('(')[0]?.trim() ?? '',
      })),
    );
    return raw
      .map((r) => ({ id: Number(r.href.match(/\/brand\/(\d+)/)?.[1]), name: r.name }))
      .filter((b) => Number.isFinite(b.id) && b.name);
  }

  async check(brand: BrandOption): Promise<void> {
    await this.panel.openPanel();
    await this.options.filter({ hasText: brand.name }).first().locator('label').click();
  }
}
