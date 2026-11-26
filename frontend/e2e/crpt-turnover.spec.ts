import { expect, test } from '@playwright/test';
import type { TurnoverReceipt } from '../src/crpt/turnover';
import { installCertificatePluginFixture } from './certificate-plugin-fixture';

const companyId = '11111111-1111-4111-8111-111111111111';
const thumbprint = 'A'.repeat(40);
const code = '010460000000000821ABC';
const initialDate = '2026-11-20';
const createdAtUtc = '2026-11-26T10:00:00.000Z';
const productGroup = 'autofluids';
const inn = '7707083893';
const root = `/api/firms/${companyId}/crpt/sandbox/honest-sign`;
const externalDocumentId = '80000000-0000-4000-8000-000000000001';
const introduction = 'LP_INTRODUCE_GOODS';
const withdrawal = 'LK_RECEIPT';
const withdrawalDocument = {
  inn,
  action: 'OWN_USE',
  action_date: initialDate,
  document_type: 'OTHER',
  document_number: 'Акт 20',
  document_date: initialDate,
  primary_document_custom_name: 'Акт использования',
  products: [{ cis: code }],
};

test('CRPT prepares, signs, and reconciles turnover documents', async ({ page }) => {
  test.slow();
  await installCertificatePluginFixture(page);
  const signed: string[] = [];
  const receipts = new Map<string, TurnoverReceipt>();
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (data: unknown) => route.fulfill({ json: data });
    if (path.startsWith('/api/auth/'))
      return json({
        accessToken: 'synthetic-turnover-token',
        expiresAt: '2099-01-01T00:00:00Z',
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          userName: 'tester',
          displayName: 'Тест оборота',
          email: '',
          firms: [{ id: companyId, name: 'Тестовая компания', role: 'Admin' }],
        },
      });
    if (path === `${root}/session`)
      return json({
        isAuthenticated: true,
        hasHonestSignSession: true,
        certificateThumbprint: thumbprint,
        honestSignSessionExpiresAtUtc: '2099-01-01T00:00:00Z',
      });
    if (path === `${root}/participants/product-groups`) return json([productGroup]);
    return json({ items: [], total: 0, unreadCount: 0 });
  });
  await page.route('**/honest-sign/codes/info', (route) => {
    expect(new URL(route.request().url()).pathname).toBe(`${root}/codes/info`);
    expect(route.request().postDataJSON()).toEqual({ codes: [code], productGroup });
    return route.fulfill({
      json: [
        {
          requestedCode: code,
          cis: code,
          productGroup,
          tnVedCode: '2710198200',
          packageType: 'UNIT',
          producedDate: createdAtUtc,
        },
      ],
    });
  });
  await page.route('**/honest-sign/turnover**', async (route) => {
    const url = new URL(route.request().url());
    const base = `${root}/turnover`;
    expect(url.pathname.startsWith(base)).toBe(true);
    const path = url.pathname.slice(base.length);
    const json = (data: unknown) => route.fulfill({ json: data });
    if (path === '/capabilities')
      return json({
        participantInn: inn,
        maxCodes: 30_000,
        maxDocumentBytes: 10 * 1024 * 1024,
        documentTypes: [
          { operation: 'Introduction', documentType: introduction },
          { operation: 'Withdrawal', documentType: withdrawal },
        ],
        withdrawalReasons: ['OWN_USE'],
        productGroupRules: [
          {
            productGroup,
            introductionDocumentTypes: [introduction],
            withdrawalReasons: ['OWN_USE'],
            supportsOsu: false,
          },
        ],
      });
    if (path === '/prepare') {
      const request = route.request().postDataJSON();
      const inbound = request.documentType === introduction;
      expect(request.productGroup).toBe(productGroup);
      expect(request.requestId).toMatch(/^[a-f0-9-]{36}$/);
      expect(JSON.parse(request.documentJson)).toEqual(
        inbound
          ? {
              participant_inn: inn,
              producer_inn: inn,
              owner_inn: inn,
              production_type: 'OWN_PRODUCTION',
              products: [
                { uit_code: code, tnved_code: '2710198200', production_date: '2026-11-26' },
              ],
            }
          : withdrawalDocument,
      );
      const id = request.requestId;
      const receipt: TurnoverReceipt = {
        id,
        operation: inbound ? 'Introduction' : 'Withdrawal',
        documentType: request.documentType,
        productGroup,
        participantInn: inn,
        state: 'Prepared',
        payloadHash: 'a'.repeat(64),
        documentJson: '  ' + request.documentJson,
        certificateThumbprint: thumbprint,
        codesCount: 1,
        externalDocumentId: null,
        externalStatus: null,
        error: null,
        createdAtUtc,
        updatedAtUtc: createdAtUtc,
      };
      receipts.set(id, receipt);
      return json(receipt);
    }
    if (!path)
      return json({
        items: [...receipts.values()].filter(
          (item) => item.operation === url.searchParams.get('operation'),
        ),
        hasNextPage: false,
      });
    const [, id, action] = path.split('/');
    const item = receipts.get(id);
    if (!item) return route.fulfill({ status: 404 });
    if (action === 'submit') {
      expect(route.request().postDataJSON()).toEqual({
        signature: 'synthetic-certificate-proof',
        payloadHash: item.payloadHash,
        certificateThumbprint: thumbprint,
      });
      const messages = await page.evaluate(
        () =>
          (window as unknown as { certificateSignedMessages: string[] }).certificateSignedMessages,
      );
      expect(messages.at(-1)).toBe(item.documentJson);
      signed.push(id);
      const inbound = item.operation === 'Introduction';
      const next: TurnoverReceipt = {
        ...item,
        state: inbound ? 'Submitted' : 'OutcomeUnknown',
        documentJson: null,
        externalDocumentId: inbound ? externalDocumentId : null,
      };
      receipts.set(id, next);
      return json(next);
    }
    if (action === 'reconcile')
      expect(route.request().postDataJSON()).toEqual({ externalDocumentId });
    if (action === 'refresh' || action === 'reconcile') {
      const next: TurnoverReceipt = {
        ...item,
        state: 'Accepted',
        externalStatus: 'CHECKED_OK',
        externalDocumentId,
      };
      receipts.set(id, next);
      return json(next);
    }
    return json(item);
  });

  await page.goto('/#/crpt?service=documents');
  await page.getByRole('tab', { name: 'Ввод в оборот', exact: true }).click();
  const choose = async (label: RegExp, option: string) => {
    await page.getByRole('combobox', { name: label }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  await choose(/^Товарная группа/, 'Моторные масла');
  await page.locator('input[type=file]').setInputFiles({
    name: 'codes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`cis\n"${code}<GS>93ABC"\n`),
  });
  await page.getByRole('button', { name: 'Получить сведения о КИ', exact: true }).click();
  await expect(page.getByText('Получены сведения о КИ: 1.', { exact: true })).toBeVisible();
  const prepare = page.getByRole('button', { name: 'Подготовить к подписи', exact: true });
  await prepare.click();
  let dialog = page.getByRole('dialog', { name: 'Производство в России', exact: true });
  let submit = dialog.getByRole('button', { name: 'Подписать и отправить', exact: true });
  await expect(submit).toBeDisabled();
  expect(signed).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Показать JSON для подписи', exact: true }).click();
  await expect(dialog.locator('pre')).toContainText(code);
  await dialog.getByRole('checkbox', { name: /Подтверждаю подписание/ }).check();
  await submit.click();
  await expect(dialog.getByText('На обработке в ЧЗ', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Проверить статус в ЧЗ', exact: true }).click();
  await expect(dialog.getByText('Обработан успешно', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Журнал документов', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Производство в России' })).toContainText(
    'Обработан успешно',
  );

  await page.getByRole('tab', { name: 'Вывод из оборота', exact: true }).click();
  await choose(/^Товарная группа/, 'Моторные масла');
  await choose(/^Причина вывода/, 'Собственные нужды');
  await page.getByLabel('Дата вывода').fill(initialDate);
  await choose(/^Тип первичного документа/, 'Иной документ');
  await page.getByLabel('Номер первичного документа').fill('Акт 20');
  await page.getByLabel('Дата первичного документа').fill(initialDate);
  await page.getByLabel('Название первичного документа').fill('Акт использования');
  await page.getByRole('textbox', { name: 'Коды идентификации', exact: true }).fill(code);
  await prepare.click();
  dialog = page.getByRole('dialog', { name: 'Поэкземплярный вывод', exact: true });
  submit = dialog.getByRole('button', { name: 'Подписать и отправить', exact: true });
  await dialog.getByRole('checkbox', { name: /Подтверждаю подписание/ }).check();
  await submit.click();
  await expect(dialog.getByText('Исход неизвестен', { exact: true })).toBeVisible();
  await expect(submit).toHaveCount(0);
  await dialog
    .getByRole('textbox', { name: 'ID документа из Честного знака', exact: true })
    .fill(externalDocumentId);
  await dialog.getByRole('button', { name: 'Сверить документ', exact: true }).click();
  await expect(dialog.getByText('Обработан успешно', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', { name: 'Указать официальный JSON', exact: true }).check();
  const originalJson = `  ${JSON.stringify(withdrawalDocument, null, 2).replaceAll('\n', '\r\n')}\r\n`;
  await page.locator('input[type=file]').setInputFiles({
    name: 'withdrawal.json',
    mimeType: 'application/json',
    buffer: Buffer.from(originalJson),
  });
  const preparedRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === `${root}/turnover/prepare`,
  );
  await prepare.click();
  expect((await preparedRequest).postDataJSON().documentJson).toBe(originalJson);
  await expect(
    dialog.getByRole('button', { name: 'Подписать и отправить', exact: true }),
  ).toBeDisabled();
  expect(signed).toHaveLength(2);
});
