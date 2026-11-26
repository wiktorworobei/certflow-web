import { expect, test } from '@playwright/test';
import type {
  CatalogCardRequest,
  CatalogProduct,
  CatalogSubmission,
} from '../src/marking/lib/honest-sign/catalogTypes';
import { installCertificatePluginFixture } from './certificate-plugin-fixture';

const companyId = '11111111-1111-4111-8111-111111111111';
const submissionId = '33333333-3333-4333-8333-333333333333';
const expiredFeed = 'old-feed';
const draftFeed = 'draft-feed';
const gtin = '05011846021161';
const createdAtUtc = '2026-11-17T12:00:00Z';
const expiresAt = '2099-01-01T00:00:00Z';
const group = { code: 43, name: 'Моторные масла' };
const catalog = `/api/firms/${companyId}/crpt/sandbox/honest-sign/catalog`;
const draft: CatalogCardRequest = {
  requestId: '55555555-5555-4555-8555-555555555555',
  categoryId: 100,
  productGroupCode: group.code,
  gtin,
  name: 'Масло для проверки черновика',
  brand: 'Учебная марка',
  tnved: '2710198200',
  sendToModeration: false,
  photoUrl: null,
  attributes: [],
};

test('CRPT separates saved drafts from confirmed provider drafts and does not moderate a draft send', async ({
  page,
}) => {
  test.slow();
  await installCertificatePluginFixture(page);
  let draftSent = false;
  let providerConfirmed = false;
  const writes: Array<{ method: string; path: string; sendToModeration: string | boolean | null }> =
    [];
  const receipt = (): CatalogSubmission => ({
    id: submissionId,
    gtin,
    state: draftSent ? 'Accepted' : 'Draft',
    feedId: draftSent ? draftFeed : expiredFeed,
    sendToModeration: false,
    createdAtUtc,
    draftVersion: '66666666-6666-4666-8666-666666666666',
  });

  await page.route('**/api/**', (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const json = (data: unknown) => route.fulfill({ json: data });
    if (pathname.startsWith('/api/auth/'))
      return json({
        accessToken: 'synthetic-lifecycle-test',
        expiresAt,
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          userName: 'tester',
          displayName: 'Проверка черновика',
          email: '',
          firms: [{ id: companyId, name: 'Тестовая компания', role: 'Admin' }],
        },
      });
    if (pathname.endsWith('/session'))
      return json({
        isAuthenticated: true,
        hasHonestSignSession: true,
        certificateThumbprint: 'A'.repeat(40),
        honestSignSessionExpiresAtUtc: expiresAt,
      });
    if (pathname === `${catalog}/product-groups`) return json([group]);
    if (pathname === `${catalog}/gtins/check`) return json({ gtin, state: 'NotFound', cards: [] });
    if (pathname === `${catalog}/categories`)
      return json([
        {
          id: 100,
          name: group.name,
          parentId: 0,
          level: 1,
          isActive: true,
          productGroupCodes: [group.code],
        },
      ]);
    if (pathname === `${catalog}/categories/${draft.categoryId}/attributes`) return json([]);
    if (pathname === `${catalog}/products`) {
      const providerDraft: CatalogProduct = {
        goodId: 123,
        gtin,
        name: draft.name,
        brand: draft.brand,
        tnved: draft.tnved,
        status: 'draft',
        detailedStatuses: ['draft'],
        submissionId,
        updatedAt: createdAtUtc,
      };
      const published: CatalogProduct = {
        ...providerDraft,
        goodId: 124,
        gtin: '04006381333931',
        name: 'Опубликованное масло',
        status: 'published',
        detailedStatuses: ['published'],
        submissionId: null,
      };
      return json({
        items: [providerDraft, published],
        page: 1,
        pageSize: 50,
        total: 2,
        hasNextPage: false,
      });
    }
    if (pathname === `${catalog}/submissions`)
      return json({
        items: [
          receipt(),
          {
            ...receipt(),
            id: '44444444-4444-4444-8444-444444444444',
            gtin: '04006381333931',
            state: 'Accepted',
            feedId: 'other-feed',
          },
        ],
        hasNextPage: false,
      });
    if (pathname === `${catalog}/submissions/${submissionId}/status`)
      return json({
        submissionId,
        submissionState: receipt().state,
        feedId: receipt().feedId,
        status: draftSent && !providerConfirmed ? 'Received' : 'Moderated',
        receivedAtUtc: createdAtUtc,
        updatedAtUtc: createdAtUtc,
        errors: [],
      });
    if (pathname === `${catalog}/submissions/${submissionId}/card`)
      return json({
        submissionId,
        goodId: 123,
        gtin,
        status: 'draft',
        detailedStatuses: ['draft'],
        isSigned: false,
        canEdit: true,
        canModerate: providerConfirmed,
        canSign: false,
        canOrderCodes: false,
        canIntroduce: false,
        draft,
        blockingOperation: null,
      });
    if (pathname === `${catalog}/submissions/${submissionId}/draft`) {
      writes.push({
        method: request.method(),
        path: pathname,
        sendToModeration: request.postDataJSON().sendToModeration,
      });
      return json(receipt());
    }
    if (pathname === `${catalog}/submissions/${submissionId}/send`) {
      writes.push({
        method: request.method(),
        path: pathname,
        sendToModeration: searchParams.get('sendToModeration'),
      });
      expect(searchParams.get('expectedVersion')).toBe(receipt().draftVersion);
      draftSent = true;
      return json(receipt());
    }
    if (request.method() !== 'GET')
      writes.push({ method: request.method(), path: pathname, sendToModeration: null });
    return json({ items: [], total: 0, unreadCount: 0 });
  });

  await page.goto('/#/crpt?environment=sandbox');
  await page.getByRole('button', { name: 'Создать новую позицию', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Новая карточка товара', exact: true });
  const step = editor.locator('[aria-current="step"]');
  const next = editor.getByRole('button', { name: 'Далее', exact: true });
  const back = editor.getByRole('button', { name: 'Назад', exact: true });
  const sendDraft = editor.getByRole('button', { name: 'Создать черновик в НК', exact: true });
  await next.click();
  await expect(step).toContainText('Основные данные');
  await expect(sendDraft).toHaveCount(0);
  await editor.locator('#catalog-productGroup').fill('масла');
  await page.getByRole('option', { name: group.name, exact: true }).click();
  await editor.locator('#catalog-gtin').fill(gtin);
  await editor.locator('#catalog-name').fill(draft.name);
  await editor.locator('#catalog-brand').fill(draft.brand);
  await editor.locator('#catalog-tnved').fill(draft.tnved);
  await editor.getByRole('button', { name: 'Подобрать категории', exact: true }).click();
  await editor.locator('#catalog-category').fill('100');
  await page.getByRole('option', { name: /Моторные масла/ }).click();
  await expect(editor.getByRole('button', { name: 'Сохранить в ZNAQ', exact: true })).toBeEnabled();
  await next.click();
  await expect(step).toContainText('Характеристики');
  await expect(editor.locator('#catalog-name')).toBeHidden();
  await expect(sendDraft).toHaveCount(0);
  await next.click();
  await expect(step).toContainText('Фото и отправка');
  await expect(sendDraft).toBeEnabled();
  await back.click();
  await back.click();
  await expect(editor.locator('#catalog-name')).toHaveValue(draft.name);
  expect(writes).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Закрыть карточку' }).click();
  await page.getByRole('button', { name: 'Черновики', exact: true }).click();
  const history = page.getByRole('region', { name: 'Черновики и отправки в НК', exact: true });
  await expect(history.getByRole('combobox', { name: 'Записи журнала', exact: true })).toHaveValue(
    'draft',
  );
  const localRow = history.getByRole('row').filter({ hasText: gtin });
  await expect(localRow.getByText('Черновик', { exact: true })).toBeVisible();
  await expect(history.getByText('other-feed', { exact: true })).toHaveCount(0);
  await localRow.getByRole('button', { name: 'Открыть карточку', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Карточка товара', exact: true });
  const providerStatus = card.getByText('Черновик в ЧЗ', { exact: true });
  const moderate = card.getByRole('button', {
    name: 'Отправить черновик на модерацию',
    exact: true,
  });
  await expect(card.getByText('Черновик', { exact: true })).toBeVisible();
  await expect(providerStatus).toHaveCount(0);
  await expect(moderate).toHaveCount(0);
  await card.getByRole('button', { name: 'Редактировать карточку', exact: true }).click();
  await card.getByRole('button', { name: 'Сохранить изменения в НК', exact: true }).click();
  await expect(card.getByText('Заявка получена ЧЗ', { exact: true })).toBeVisible();
  await expect(providerStatus).toHaveCount(0);
  await expect(moderate).toHaveCount(0);
  expect(writes).toEqual([
    {
      method: 'PUT',
      path: `${catalog}/submissions/${submissionId}/draft`,
      sendToModeration: false,
    },
    {
      method: 'POST',
      path: `${catalog}/submissions/${submissionId}/send`,
      sendToModeration: 'false',
    },
  ]);

  providerConfirmed = true;
  await card.getByRole('button', { name: 'Обновить', exact: true }).click();
  await expect(providerStatus).toBeVisible();
  await expect(card.getByText('Черновик', { exact: true })).toHaveCount(0);
  await expect(moderate).toBeEnabled();
  expect(writes).toHaveLength(2);
  await page.keyboard.press('Escape');
  await expect(
    history.getByText('На этой странице нет черновиков.', { exact: true }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Каталог товаров', exact: true }).click();
  await page.getByRole('combobox', { name: /^Состояние карточки/ }).click();
  await page.getByRole('option', { name: 'Черновик в ЧЗ', exact: true }).click();
  const providerRow = page.getByRole('row').filter({ hasText: draft.name });
  await expect(providerRow.getByText('Черновик в ЧЗ', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Опубликованное масло' })).toHaveCount(0);
});
