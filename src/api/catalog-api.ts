import type { APIRequestContext, Response } from '@playwright/test';
import type { PriceRange } from '../utils/price';

/**
 * Мінімальні типи публічного API каталогу, яким користується фронтенд.
 * Ми не тестуємо API напряму — використовуємо його як «джерело правди»,
 * щоб звірити UI з даними, які він отримав, і не хардкодити товари/ціни.
 */
export interface ApiPrice {
  current: number;
  old?: number;
  currency: string;
}

export interface ApiProduct {
  id: number;
  type: 'product';
  title: string;
  brand: { id: number; title: string };
  inStock: boolean;
  price: ApiPrice;
  hasVariants?: boolean;
}

type ApiListItem = ApiProduct | { type: 'action' | 'quote-slider' | string; id: number | string };

export interface ProductsListResponse {
  products: ApiListItem[];
  /** Усі товари, включно з відсутніми (без фільтра ціни ≠ лічильнику в UI). */
  total: number;
  /** Товари в наявності — саме це число показує лічильник «N товарів» у UI. */
  availableCount: number;
  offset: number;
  perPage: number;
}

export interface ProductDetailsResponse {
  id: number;
  title: string;
  variants?: Array<{ id: string | number; title: string; inStock: boolean; price?: ApiPrice }>;
}

const productsListPath = (categoryId: number) => `/shop/v1/categories/${categoryId}/products/`;

/** ID категорії з шляху сторінки: /ua/categorys/3/ → 3. */
export function categoryIdFromPath(path: string): number {
  const id = Number(path.match(/\/categorys\/(\d+)/)?.[1]);
  if (!Number.isFinite(id)) throw new Error(`Не вдалося визначити ID категорії з "${path}"`);
  return id;
}

export const isProductItem = (item: ApiListItem): item is ApiProduct => item.type === 'product';

/** Параметри ціни з URL запиту до списку товарів. */
export function priceParamsOf(url: string): PriceRange & { offset: number } {
  const params = new URL(url).searchParams;
  const toNum = (v: string | null) => (v === null || v === '' ? undefined : Number(v));
  return {
    from: toNum(params.get('priceFrom')),
    to: toNum(params.get('priceTo')),
    offset: Number(params.get('offset') ?? 0),
  };
}

/**
 * Предикат для page.waitForResponse: відповідь списку товарів саме цієї категорії
 * і саме з цим діапазоном. Точне порівняння важливе: на сторінці є блоки інших
 * категорій, а також запити від попереднього стану фільтра.
 */
export function isProductsListFor(
  categoryId: number,
  range: PriceRange,
  offset = 0,
  extra: Record<string, string> = {},
) {
  return (response: Response): boolean => {
    const url = response.url();
    if (new URL(url).pathname !== productsListPath(categoryId) || response.request().method() !== 'GET') return false;
    const params = priceParamsOf(url);
    const search = new URL(url).searchParams;
    return (
      params.from === range.from &&
      params.to === range.to &&
      params.offset === offset &&
      Object.entries(extra).every(([key, value]) => search.get(key) === value)
    );
  };
}

/** Кеш на воркер: той самий товар часто трапляється в кількох діапазонах — не смикаємо прод зайвий раз. */
const productDetailsCache = new Map<number, Promise<ProductDetailsResponse | null>>();

export class CatalogApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
  ) {}

  /**
   * Деталі товару з варіантами (об'ємами/складами).
   * Потрібні, бо фільтр підбирає товар, якщо в діапазон потрапляє будь-який його варіант,
   * а картка показує ціну варіанта за замовчуванням.
   */
  productDetails(id: number): Promise<ProductDetailsResponse | null> {
    let cached = productDetailsCache.get(id);
    if (!cached) {
      cached = this.fetchProductDetails(id);
      productDetailsCache.set(id, cached);
      cached.catch(() => productDetailsCache.delete(id));
    }
    return cached;
  }

  /** Кількість товарів у наявності для діапазону — щоб порівняти з тим, що показав UI. */
  async availableCount(categoryId: number, range: PriceRange): Promise<number> {
    const params = new URLSearchParams({ offset: '0' });
    if (range.from !== undefined) params.set('priceFrom', String(range.from));
    if (range.to !== undefined) params.set('priceTo', String(range.to));
    const response = await this.request.get(`${this.baseUrl}${productsListPath(categoryId)}?${params}`, { timeout: 30_000 });
    return ((await response.json()) as ProductsListResponse).availableCount;
  }

  private async fetchProductDetails(id: number, attempts = 3): Promise<ProductDetailsResponse | null> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await this.request.get(`${this.baseUrl}/shop/v1/products/${id}/`, {
          failOnStatusCode: false,
          timeout: 30_000,
        });
        if (response.ok()) return (await response.json()) as ProductDetailsResponse;
        if (response.status() === 404) return null;
        if (attempt >= attempts) throw new Error(`GET /products/${id}/ → ${response.status()}`);
      } catch (error) {
        if (attempt >= attempts) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }
}
