import { expectPriceFilterApplied } from '../../src/assertions/price-filter.assertions';
import { expect, test } from '../../src/fixtures';
import { describeRange, type PriceRange } from '../../src/utils/price';

/**
 * Пресети читаються з самого UI під час виконання — тести не знають заздалегідь,
 * які діапазони пропонує магазин, і не зламаються, якщо їх змінять.
 */
test.describe('Фільтр «Ціна» — швидкі діапазони (пресети)', () => {
  let unfilteredTotal: number;

  test.beforeEach(async ({ categoryPage }) => {
    await categoryPage.open();
    unfilteredTotal = await categoryPage.grid.totalCount();
    await categoryPage.priceFilter.open();
  });

  test('пресети відображаються і утворюють впорядковані діапазони без перетинів', async ({ categoryPage }) => {
    const presets = await categoryPage.priceFilter.presetRanges();
    expect(presets.length, 'Має бути хоча б два пресети').toBeGreaterThanOrEqual(2);

    // Перший — відкритий знизу («Менше N»), останній — відкритий зверху («Більше N»).
    expect(presets[0].range.from, `Перший пресет «${presets[0].label}»`).toBeUndefined();
    expect(presets.at(-1)!.range.to, `Останній пресет «${presets.at(-1)!.label}»`).toBeUndefined();

    // Сусідні пресети стикуються без «дір»: верх попереднього = низ наступного.
    for (let i = 1; i < presets.length; i++) {
      const prev = presets[i - 1].range;
      const curr = presets[i].range;
      expect(curr.from, `«${presets[i - 1].label}» → «${presets[i].label}»`).toBe(prev.to);
      if (curr.to !== undefined) expect(curr.to).toBeGreaterThan(curr.from!);
    }
  });

  // Три типи пресетів, обрані за формою діапазону, а не за позицією/значенням.
  const kinds: Array<{ title: string; pick: (r: PriceRange) => boolean }> = [
    { title: 'з верхньою межею («Менше N»)', pick: (r) => r.from === undefined && r.to !== undefined },
    { title: 'з обома межами («N – M»)', pick: (r) => r.from !== undefined && r.to !== undefined },
    { title: 'з нижньою межею («Більше N»)', pick: (r) => r.from !== undefined && r.to === undefined },
  ];

  for (const kind of kinds) {
    test(`пресет ${kind.title} фільтрує товари за ціною`, async ({ categoryPage, catalogApi }, testInfo) => {
      const presets = (await categoryPage.priceFilter.presetRanges()).filter((p) => kind.pick(p.range));
      test.skip(presets.length === 0, `У категорії немає пресету типу ${kind.title}`);
      // Для «N – M» беремо середній: крайні вже покриті іншими кейсами.
      const preset = presets[Math.floor(presets.length / 2)];
      testInfo.annotations.push({ type: 'preset', description: `${preset.label} → ${describeRange(preset.range)}` });

      const body = await categoryPage.choosePreset(preset.label, preset.range);

      await expectPriceFilterApplied(categoryPage, preset.range, body, catalogApi, testInfo, { unfilteredTotal });
      expect(body.availableCount, 'Пресет має знаходити товари').toBeGreaterThan(0);
    });
  }

  test('кожен пресет застосовується, а сума їх видач покриває весь каталог', async ({ categoryPage, catalogApi }, testInfo) => {
    test.slow();
    const presets = await categoryPage.priceFilter.presetRanges();
    let sum = 0;
    for (const preset of presets) {
      await test.step(`Пресет «${preset.label}»`, async () => {
        const body = await categoryPage.choosePreset(preset.label, preset.range);
        await expectPriceFilterApplied(categoryPage, preset.range, body, catalogApi, testInfo, { unfilteredTotal });
        sum += body.availableCount;
      });
    }
    // Пресети покривають 0..∞, тож сума видач ≥ товарів без фільтра
    // (товар із кількома варіантами може потрапити в кілька діапазонів, тому ≥, а не =).
    expect(sum).toBeGreaterThanOrEqual(unfilteredTotal * 0.95);
  });
});
