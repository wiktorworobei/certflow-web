import { test, expect } from '@playwright/test';
import { blankSuzRow, buildSuzOrders, codesCsv, importSuzRows, parseSuzCodes, suzRowsToSheet } from '../src/crpt/suz';
const row = (index = 0) => ({ ...blankSuzRow('milk'), gtin: String(46000000000000 + index), quantity: '150000', template: '20' });
test('SUZ splits ten GTIN limits, large quantities and order-level attributes without changing totals', () => {
  const rows = Array.from({ length: 22 }, (_, i) => row(i)); rows[0].quantity = '2000000'; rows[1].release = 'IMPORT';
  const orders = buildSuzOrders(rows);
  expect(orders).toHaveLength(4); expect(orders.every(x => x.payload.products.length <= 10)).toBe(true);
  expect(orders.find(x => x.payload.products[0].quantity === 2000000)?.payload.products).toHaveLength(1);
  expect(orders.reduce((n, x) => n + x.payload.products.reduce((s, p) => s + p.quantity, 0), 0)).toBe(5150000);
});
test('SUZ template roundtrip retains leading zeros, producer and order identifiers', () => {
  const source = { ...row(), gtin: '00460000000008', producer: '0012345678', production: 'Заказ 0001', name: 'Набор' };
  const imported = importSuzRows(suzRowsToSheet([source])); expect(imported[0]).toMatchObject({ ...source, id: expect.any(String) });
  expect(buildSuzOrders(imported)[0].payload.products[0].attributes).toEqual({ producer: '0012345678' });
});
test('SUZ rejects duplicate GTIN, scientific notation, fractional quantities and malformed producer', () => {
  expect(() => buildSuzOrders([row(), row()])).toThrow(/повторяется/);
  for (const change of [{ gtin: '4.6E+13' }, { quantity: '1.5' }, { quantity: '2000001' }, { template: '' }, { producer: '123' }]) expect(() => buildSuzOrders([{ ...row(), ...change }])).toThrow();
});
test('SUZ CSV roundtrip preserves GS, quotes, punctuation and significant spaces byte-for-byte', () => {
  const codes = ['010046000000000821ABC,;"serial\x1d93x/y+ ', '010046000000000821SECOND\x1d91ABC\x1d92abc=='];
  expect(parseSuzCodes(codesCsv(codes))).toEqual(codes); expect(parseSuzCodes(JSON.stringify(codes))).toEqual(codes);
  expect(parseSuzCodes(codes.join('\r\n'))).toEqual(codes);
  expect(() => parseSuzCodes('code\n"invalid"')).toThrow();
});
