import { test as base, expect } from '@playwright/test';
import { CatalogApi } from '../api/catalog-api';
import { env } from '../config/env';
import { CategoryPage } from '../pages/category-page';

interface Fixtures {
  categoryPage: CategoryPage;
  catalogApi: CatalogApi;
}

export const test = base.extend<Fixtures>({
  /**
   * Готуємо «чистого, але вже знайомого з сайтом» користувача:
   *  - cookie-банер прийнято (cookie `accepted`),
   *  - промо-підказку MAKEUP Rewards уже показано (localStorage `global-store`).
   * Обидва оверлеї інакше перекривають кнопки фільтра (особливо на мобільному).
   * Сторонні скрипти НЕ блокуємо: без них фронтенд сайту не ініціалізується коректно.
   */
  context: async ({ context }, use) => {
    const { hostname } = new URL(env.baseUrl);
    await context.addCookies([{ name: 'accepted', value: 'true', domain: hostname, path: '/' }]);
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'global-store',
          JSON.stringify({ state: { rewardModalWasShown: true }, version: 0 }),
        );
      } catch {
        /* localStorage може бути недоступним на проміжній сторінці WAF */
      }
    });
    // Картинки не впливають на фільтр, а суттєво сповільнюють і «шумлять» на мобільному.
    await context.route(/\.(png|jpe?g|webp|avif|gif|mp4)(\?.*)?$/i, (route) => route.abort());
    await use(context);
  },

  categoryPage: async ({ page, isMobile }, use) => {
    await use(new CategoryPage(page, isMobile));
  },

  // page.request ділить cookie з браузером (зокрема WAF-токен), тож API-запити не блокуються.
  catalogApi: async ({ page }, use) => {
    await use(new CatalogApi(page.request, env.baseUrl));
  },
});

export { expect };
