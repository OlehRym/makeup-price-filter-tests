/**
 * Усі CSS-селектори в одному місці.
 *
 * Сайт використовує CSS-модулі виду `PriceSelector__input shop_15api6j_1k6kxjv`:
 * перша (BEM) частина стабільна, друга — хеш збірки. Тому селектимо ТІЛЬКИ за BEM-класом
 * (`.PriceSelector__input` збігається з токеном класу точно) і ніколи — за хешем.
 * Там, де є доступна роль/текст, у компонентах використовуються getByRole/getByText.
 */
export const sel = {
  priceFilter: {
    /** Заголовок секції «Вартість» (кнопка згортання/розгортання). */
    header: '.PriceSelector__button',
    presets: '.PriceSelector__priceButton',
    inputs: '.PriceSelector__input',
  },
  filters: {
    panel: '.Filters__filters',
    /** Блок «Бренд» (заголовок-кнопка + контент з алфавітом і чекбоксами). */
    brandHeader: '.FilterItemAlphabet__button',
    /** Опція бренду — посилання /ua/brand/{id}/ з чекбоксом усередині (віртуалізований список). */
    brandOption: '.FilterBrandOptionRow__option',
  },
  sorting: {
    desktopButton: '.SortingMenu__button',
  },
  pagination: {
    pages: '.Pagination__pages',
  },
  products: {
    total: '.Products__total',
    /** Лише «звичайні» картки сітки, без промо-блоків і каруселей відгуків. */
    card: '.Products__cards > .ProductCard__cardContainer',
    cardTitle: '.ProductCard__title',
    cardPrice: '.Price__priceCurrent',
    loadMore: '.Products__pagination',
  },
  tags: {
    tag: '.Tag__tag',
    clearAll: '.Tags__clear',
  },
} as const;
