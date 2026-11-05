import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { categoryIdFromPath, isProductsListFor, type ProductsListResponse } from '../api/catalog-api';
import { PriceFilter } from '../components/price-filter';
import { ProductGrid } from '../components/product-grid';
import { sel } from '../components/selectors';
import { env } from '../config/env';
import type { PriceRange } from '../utils/price';

/** Сторінка категорії каталогу (за замовчуванням — «Парфумерія»). */
export class CategoryPage {
  readonly priceFilter: PriceFilter;
  readonly grid: ProductGrid;
  readonly priceTag: Locator;
  readonly clearAllTagsButton: Locator;
  readonly categoryId: number;

  constructor(
    readonly page: Page,
    readonly isMobile: boolean,
    readonly path: string = env.categoryPath,
  ) {
    this.categoryId = categoryIdFromPath(path);
    this.priceFilter = new PriceFilter(page, isMobile);
    this.grid = new ProductGrid(page);
    // Тег обраного фільтра над сіткою: «від 500 до 750», «від 300», «до 400».
    this.priceTag = page.locator(sel.tags.tag).filter({ hasText: /^\s*(від|до|от)\s+\d/ });
    this.clearAllTagsButton = page.locator(sel.tags.clearAll);
  }

  static hashFor(range: PriceRange): string {
    const params = new URLSearchParams();
    if (range.from !== undefined) params.set('price_from', String(range.from));
    if (range.to !== undefined) params.set('price_to', String(range.to));
    const hash = params.toString();
    return hash ? `#${hash}` : '';
  }

  /** Відкрити категорію без фільтра і дочекатися, поки сторінка стане інтерактивною. */
  async open(): Promise<void> {
    await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
    await this.waitUntilInteractive();
  }

  /**
   * Відкрити категорію одразу з фільтром у hash (deep link / шерінг посилання).
   * Повертає відповідь API, яку отримав фронтенд.
   */
  async openWithPriceHash(range: PriceRange): Promise<ProductsListResponse> {
    // Якщо ми вже на цій сторінці, goto з новим hash — це same-document навігація,
    // а не реальне відкриття посилання. Скидаємо документ, щоб перевірити саме deep link.
    if (new URL(this.page.url(), env.baseUrl).pathname === this.path) await this.page.goto('about:blank');
    const responsePromise = this.page.waitForResponse(this.productsResponse(range), { timeout: 30_000 });
    await this.page.goto(`${this.path}${CategoryPage.hashFor(range)}`, { waitUntil: 'domcontentloaded' });
    const body = await this.readBody(await responsePromise);
    await this.waitUntilInteractive();
    await this.grid.waitForRendered(body);
    return body;
  }

  /**
   * Сторінка рендериться на сервері, а потім гідратується React.
   * До гідратації кліки/ввід ігноруються або перетираються, тому чекаємо ознаку
   * гідратації на самому полі фільтра. Додатково на першому вході відпрацьовує
   * WAF-challenge (перезавантаження сторінки) — evaluate у цей момент може впасти,
   * тому використовуємо poll, а не одноразовий waitForFunction.
   */
  async waitUntilInteractive(): Promise<void> {
    // На mobile з активним фільтром лічильник прихований версткою — достатньо, що він у DOM.
    await expect(this.grid.total).toBeAttached({ timeout: 30_000 });
    await expect
      .poll(
        () =>
          this.page
            .evaluate((selector) => {
              const el = document.querySelector(selector);
              return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'));
            }, sel.priceFilter.inputs)
            .catch(() => false),
        { message: 'React має гідратувати фільтр', timeout: 30_000 },
      )
      .toBe(true);
  }

  /**
   * Виконати дію з фільтром і повернути відповідь API для очікуваного діапазону.
   *
   * Дія повторюється (toPass), якщо запит не пішов: одразу після гідратації клієнт
   * ще може перерендерити фільтр і «з'їсти» ввід. Повтор безпечний — дія ідемпотентна.
   */
  async applyPriceFilter(range: PriceRange, action: () => Promise<void>): Promise<ProductsListResponse> {
    let body: ProductsListResponse | undefined;
    await expect(async () => {
      const responsePromise = this.page.waitForResponse(this.productsResponse(range), { timeout: 8_000 });
      responsePromise.catch(() => undefined); // уникаємо unhandled rejection, якщо action впаде
      await action();
      body = await this.readBody(await responsePromise);
    }).toPass({ timeout: 45_000, intervals: [500, 1_000, 2_000] });
    await this.grid.waitForRendered(body!);
    return body!;
  }

  /** Обрати пресет за підписом. */
  async choosePreset(label: string, range: PriceRange): Promise<ProductsListResponse> {
    await this.priceFilter.open();
    const body = await this.applyPriceFilter(range, () => this.priceFilter.clickPreset(label));
    await this.priceFilter.confirm();
    return body;
  }

  /**
   * Ввести діапазон вручну. Кожне поле комітиться на blur і породжує свій запит,
   * тому чекаємо відповідь після кожного кроку — інакше другий ввід може загубитися
   * під час перерендеру після першого.
   */
  async setPriceRange(range: PriceRange): Promise<ProductsListResponse> {
    await this.priceFilter.open();
    let body: ProductsListResponse | undefined;
    if (range.from !== undefined) {
      const from = range.from;
      // Перший запит піде з уже застосованою верхньою межею (якщо вона була).
      const intermediate = { from, to: this.priceStateFromUrl().to };
      body = await this.applyPriceFilter(intermediate, () => this.priceFilter.fillFrom(from));
    }
    if (range.to !== undefined) {
      const to = range.to;
      body = await this.applyPriceFilter(range, () => this.priceFilter.fillTo(to));
    }
    if (!body) throw new Error('setPriceRange: потрібна хоча б одна межа');
    await this.priceFilter.confirm();
    return body;
  }

  /** «Показати ще» — довантаження наступної сторінки з тим самим фільтром. */
  async loadMore(range: PriceRange, offset: number): Promise<ProductsListResponse> {
    const before = await this.grid.cards.count();
    const responsePromise = this.page.waitForResponse(this.productsResponse(range, offset));
    await this.grid.loadMoreButton.click();
    const body = await this.readBody(await responsePromise);
    await this.grid.waitForRendered(body, before);
    return body;
  }

  /** Предикат відповіді API списку товарів ЦІЄЇ категорії з заданим діапазоном. */
  productsResponse(range: PriceRange, offset = 0): (response: Response) => boolean {
    return isProductsListFor(this.categoryId, range, offset);
  }

  /** Перезавантажити сторінку й повернути відповідь API для поточного фільтра з URL. */
  async reload(): Promise<ProductsListResponse> {
    const range = this.priceStateFromUrl();
    const responsePromise = this.page.waitForResponse(this.productsResponse(range), { timeout: 30_000 });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    const body = await this.readBody(await responsePromise);
    await this.waitUntilInteractive();
    await this.grid.waitForRendered(body);
    return body;
  }

  /** Поточний стан фільтра з hash URL. */
  priceStateFromUrl(): PriceRange {
    const hash = new URL(this.page.url()).hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const toNum = (v: string | null) => (v === null ? undefined : Number(v));
    return { from: toNum(params.get('price_from')), to: toNum(params.get('price_to')) };
  }

  private async readBody(response: Response): Promise<ProductsListResponse> {
    expect(response.status(), `API ${response.url()} має відповісти 200`).toBe(200);
    return (await response.json()) as ProductsListResponse;
  }
}
