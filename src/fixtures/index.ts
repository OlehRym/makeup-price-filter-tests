import { test as base } from '@playwright/test';
import { CategoryPage } from '../pages/category-page';

type Fixtures = {
  categoryPage: CategoryPage;
};

/**
 * Свій `test` з додатковими фікстурами.
 * Тести імпортують `test` і `expect` звідси, а не з '@playwright/test'.
 */
export const test = base.extend<Fixtures>({
  categoryPage: async ({ page, isMobile }, use) => {
    const categoryPage = new CategoryPage(page, isMobile);
    await use(categoryPage);
  },
});

export { expect } from '@playwright/test';
