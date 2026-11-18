import { test, expect } from '@playwright/test';
import { importCards, cardsToRows, parseDelimited, similarCard } from '../src/crpt/spreadsheet';

test('CRPT Excel rows round trip sets, leading zeros, quotes and all writable attributes', () => {
  const rows = [['GTIN', 'Наименование', 'Бренд', 'ТН ВЭД', 'Группа', 'Категория', 'Тип', 'GTIN вложения', 'Количество', 'Характеристики JSON'],
    ['04600000000008', 'Набор "Уход"', 'Тест', '3304', '35', '100', 'Набор', '05011846021161', '2', '[{"id":23557,"value":"TEST:::2026-11-17","valueType":null}]'],
    ['04600000000008', '', '', '', '', '', 'Набор', '04600000000015', '1', '']];
  const cards = importCards(rows); expect(cards).toHaveLength(1); expect(cards[0].setGtins).toHaveLength(2);
  const restored = importCards(cardsToRows(cards)); expect({ ...restored[0], requestId: '' }).toEqual({ ...cards[0], requestId: '' });
  expect(parseDelimited('GTIN;Название\r\n"04600000000008";"Набор; ""Уход""\nдва"\r\n')).toEqual([['GTIN', 'Название'], ['04600000000008', 'Набор; "Уход"\nдва']]);
});
test('CRPT rejects duplicate contents, formulas-as-code identifiers and inconsistent duplicate GTIN', () => {
  const headers = ['GTIN', 'Наименование', 'Бренд', 'ТН ВЭД', 'Группа', 'Категория', 'Тип', 'GTIN вложения', 'Количество'];
  expect(() => importCards([headers, ['=1+1', 'Товар', 'Тест', '3304', '35', '100', 'Единица']])).toThrow(/GTIN/);
  const first = ['04600000000008', 'Набор', 'Тест', '3304', '35', '100', 'Набор', '05011846021161', '1'];
  expect(() => importCards([headers, first, first])).toThrow(/повторяется/);
  expect(() => importCards([headers, first, ['04600000000008', 'Другое название', 'Тест', '3304', '35', '100', 'Набор']])).toThrow(/повтор GTIN/);
});
test('CRPT similar card discards its old identity, packaging and scoped attributes', () => {
  const card = importCards([['GTIN', 'Наименование', 'Бренд', 'ТН ВЭД', 'Группа', 'Категория', 'Тип'], ['05011846021161', 'Товар', 'Бренд', '2710', '43', '100', 'Единица']])[0];
  card.attributes = [{ id: 1, value: 'base', valueType: null, gtin: card.gtin }, { id: 2, value: 'box', valueType: null, gtin: '04600000000008' }];
  const clone = similarCard(card); expect(clone.gtin).toBe(''); expect(clone.identifiers).toEqual([]); expect(clone.attributes).toEqual([{ id: 1, value: 'base', valueType: null }]); expect(clone.requestId).not.toBe(card.requestId);
});
