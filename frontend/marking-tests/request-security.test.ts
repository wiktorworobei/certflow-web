import { test, expect } from '@playwright/test';
import { captureRequestScope, isRequestScopeCurrent, requestMatchesFirm } from '../src/requestScope';
import { markingRequestUrl } from '../src/marking/lib/request-routing';
import { parseDelimited, readSheet } from '../src/crpt/spreadsheet';
import { zipSync, strToU8 } from 'fflate';

const session = { user: { id: 'actor-a' }, firmId: 'firm-a', authEpoch: 1, workspaceEpoch: 1 };
test('request scope survives token rotation but rejects logout/login and firm switches even after switching back', () => {
  const scope = captureRequestScope(session);
  expect(isRequestScopeCurrent(scope, { ...session })).toBe(true);
  expect(isRequestScopeCurrent(scope, { ...session, authEpoch: 3 })).toBe(false);
  expect(isRequestScopeCurrent(scope, { ...session, workspaceEpoch: 3 })).toBe(false);
  expect(isRequestScopeCurrent(scope, { ...session, firmId: 'firm-b', workspaceEpoch: 2 }, false)).toBe(true);
  expect(isRequestScopeCurrent(scope, { ...session, user: { id: 'actor-b' } }, false)).toBe(false);
});
test('company requests reject another firm and encoded or literal traversal before credentials are attached', () => {
  expect(requestMatchesFirm('/firms/firm-a/declarations', 'firm-a')).toBe(true);
  for (const path of ['/firms/firm-b/declarations', '/api/firms/firm-b/declarations', '/firms/firm-a/../firm-b', '/firms/firm-a/%2e%2e/firm-b', '/firms/firm-a%2f..%2ffirm-b', '/firms/firm-a\\..\\firm-b']) expect(requestMatchesFirm(path, 'firm-a')).toBe(false);
});
test('marking routing keeps credentials within the selected firm and contour after browser normalization', () => {
  expect(markingRequestUrl('/api/honest-sign/orders/search?limit=20', 'firm-a', 'sandbox')).toBe('/api/firms/firm-a/crpt/sandbox/honest-sign/orders/search?limit=20');
  expect(markingRequestUrl('/api/dmkod/session', 'firm-a', null)).toBe('/api/firms/firm-a/marking/dmkod/session');
  for (const path of ['https://evil.example/api/honest-sign', '//evil.example/api/honest-sign', '/api/honest-sign-evil/orders', '/api/honest-sign/../../auth/me', '/api/honest-sign/%2e%2e/%2e%2e/auth/me', '/api/firms/firm-b/marking/honest-sign/session', '/api/firms/firm-a/crpt/production/honest-sign/session']) expect(() => markingRequestUrl(path, 'firm-a', 'sandbox')).toThrow();
});
test('CSV parsing stops oversized row and column input before building an unbounded table', () => {
  expect(() => parseDelimited('a\nb\nc', 2)).toThrow(/строк/);
  expect(() => parseDelimited(Array.from({ length: 102 }, () => 'a').join(';'))).toThrow(/столбцов/);
  expect(parseDelimited('code\n"01abc,;\"\"def\u001d93tail"')).toEqual([['code'], ['01abc,;"def\u001d93tail']]);
});
test('XLSX rejects DTD and entity expansion before invoking the XML parser', async () => {
  const bytes = zipSync({ 'xl/workbook.xml': strToU8('<!DOCTYPE x [<!ENTITY a "expanded">]><workbook/>'), 'xl/_rels/workbook.xml.rels': strToU8('<Relationships/>') });
  await expect(readSheet(new File([bytes.slice().buffer], 'untrusted.xlsx'))).rejects.toThrow(/DTD/);
});
