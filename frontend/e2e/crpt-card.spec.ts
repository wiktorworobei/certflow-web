import { expect, test, type Page } from '@playwright/test';
import { installCertificatePluginFixture } from './certificate-plugin-fixture';
import type { CatalogProduct } from '../src/marking/lib/honest-sign/catalogTypes';

const firm = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Тестовая компания CRPT',
  role: 'Admin',
};
const user = {
  id: '22222222-2222-4222-8222-222222222222',
  userName: 'test',
  displayName: 'Тест CRPT',
  email: '',
  firms: [firm],
};
const expiresAt = '2099-01-01T00:00:00Z';
const tnved = '2710198200';
const gtin = '05011846021161';

async function mockCatalog(page: Page) {
  await installCertificatePluginFixture(page);
  const writes: string[] = [];
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const json = (value: unknown) => route.fulfill({ json: value });
    if (pathname.startsWith('/api/auth/'))
      return json({ accessToken: 'synthetic-crpt-token', expiresAt, user });
    if (pathname.endsWith('/session'))
      return json({
        isAuthenticated: true,
        hasHonestSignSession: true,
        certificateThumbprint: 'A'.repeat(40),
        honestSignSessionExpiresAtUtc: expiresAt,
      });
    if (pathname.endsWith('/product-groups')) return json([{ code: 43, name: 'Моторные масла' }]);
    if (request.method() !== 'GET') writes.push(pathname);
    return json({ items: [], total: 0, unreadCount: 0 });
  });
  return { writes };
}

test('CRPT finds signable cards across catalog pages with the quick filter', async ({ page }) => {
  const fixture = await mockCatalog(page);
  const item = (
    goodId: number,
    productGtin: string,
    name: string,
    detailedStatuses: string[],
  ): CatalogProduct => ({
    goodId,
    gtin: productGtin,
    name,
    brand: 'Тестовый бренд',
    tnved,
    status: 'published',
    detailedStatuses,
    updatedAt: null,
    submissionId: null,
  });
  const published = item(1, '04006381333931', 'Масло опубликованное', ['published']);
  const awaiting = item(2, gtin, 'Масло с версией на подпись', ['published', 'notsigned']);
  const onModeration = item(3, '00012345600012', 'Масло с версией на модерации', [
    'moderation',
    'notsigned',
  ]);
  const next = item(4, '04601234567893', 'Масло со следующей страницы', ['notsigned']);
  const providerPages = [[published], [awaiting, onModeration], [next]];
  const scanned: { page: number; status: string | null; fromDate: string | null }[] = [];
  await page.route('**/catalog/products?*', (route) => {
    const request = route.request();
    expect(request.method()).toBe('GET');
    const { searchParams } = new URL(request.url());
    const pageNumber = Number(searchParams.get('page'));
    const pageSize = Number(searchParams.get('pageSize'));
    const status = searchParams.get('status');
    expect(status).not.toBe('notsigned');
    if (pageSize === 100) {
      scanned.push({ page: pageNumber, status, fromDate: searchParams.get('fromDate') });
    }
    return route.fulfill({
      json: {
        items: providerPages[pageNumber - 1] ?? [],
        page: pageNumber,
        pageSize,
        total: 201,
        hasNextPage: pageNumber < providerPages.length,
      },
    });
  });
  await page.route('**/catalog/search?*', (route) =>
    route.fulfill({ json: [awaiting, onModeration] }),
  );

  await page.goto('/#/crpt?environment=sandbox');
  await page.getByRole('combobox', { name: /^Статус в НК/ }).click();
  await page.getByRole('option', { name: 'Опубликованные', exact: true }).click();
  await page.getByLabel('Обновлены с', { exact: true }).fill('2026-11-01');
  const search = page.getByRole('textbox', { name: 'GTIN, название или бренд', exact: true });
  await search.fill('Масло');
  await page.getByRole('checkbox', { name: `Выбрать ${published.gtin}`, exact: true }).check();

  const filter = page.getByRole('button', { name: 'Ожидает подписания', exact: true });
  const nextPage = page.getByRole('button', { name: 'Следующая страница карточек', exact: true });
  const more = page.getByRole('button', { name: 'Показать ещё', exact: true });
  await expect(filter).toHaveAttribute('aria-pressed', 'false');
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('combobox', { name: 'Состояние карточки Ожидает подписания', exact: true }),
  ).toBeVisible();
  const visibleRow = (product: CatalogProduct) =>
    page.getByRole('row').filter({ hasText: product.name });
  await expect(visibleRow(awaiting)).toBeVisible();
  await expect(visibleRow(published)).toHaveCount(0);
  await expect(visibleRow(onModeration)).toHaveCount(0);
  await expect(visibleRow(next)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Действия', exact: true })).toBeDisabled();
  await expect(nextPage).toHaveCount(0);
  await expect(search).toHaveValue('Масло');
  expect(scanned).toEqual([
    { page: 1, status: 'published', fromDate: '2026-11-01' },
    { page: 2, status: 'published', fromDate: '2026-11-01' },
  ]);

  await more.click();
  await expect(visibleRow(next)).toBeVisible();
  await expect(visibleRow(awaiting)).toBeVisible();
  await expect(more).toHaveCount(0);
  expect(scanned.at(-1)).toEqual({ page: 3, status: 'published', fromDate: '2026-11-01' });

  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'false');
  await expect(visibleRow(published)).toBeVisible();
  await expect(visibleRow(awaiting)).toHaveCount(0);
  await expect(nextPage).toBeVisible();

  await search.fill(`${awaiting.gtin} ${onModeration.gtin}`);
  await page.getByRole('button', { name: 'Найти GTIN в НК', exact: true }).click();
  await expect(visibleRow(onModeration)).toBeVisible();
  const scansBeforeLookupFilter = scanned.length;
  await filter.click();
  await expect(visibleRow(awaiting)).toBeVisible();
  await expect(visibleRow(onModeration)).toHaveCount(0);
  await expect(more).toHaveCount(0);
  expect(scanned).toHaveLength(scansBeforeLookupFilter);
  expect(fixture.writes).toEqual([]);
});
