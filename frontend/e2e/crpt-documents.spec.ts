import { expect, test, type Page } from '@playwright/test';
import { installCertificatePluginFixture } from './certificate-plugin-fixture';

const companyId = '11111111-1111-4111-8111-111111111111';
const reportId = 'b8199d14-b55a-43c4-a490-4d3089f271ad';
const productionReportId = 'e1e2363f-8ddd-4c89-a429-ddf7754897ed';
const eventId = 'receipt-event-7';
const relatedDocumentId = 'ace583b8-9e7a-4f6b-bbde-3fbdc9677650';
const archiveId = '3ed2c230-25cc-4a06-bbc3-8ec5ec44ede5';
const registryIds = ['registry-document-first', 'registry-document-next'];
const continuation = 'opaque-registry-continuation';
const cis = '010460000000000021TEST000000001';
const archiveCode = `${cis}\x1d93TEST`;
const contourPath = (environment: string) =>
  `/api/firms/${companyId}/crpt/${environment}/honest-sign`;
const receiptPath = '/reports/receipts';

function makeReceipt(resultDocId: string) {
  return {
    resultDocId,
    state: 'SUCCESS',
    resultDocDate: 1795696300001,
    sourceDocId: 'a710229b-b2d3-4fbb-b51b-fe47ff7d66c3',
    sourceDocDate: 1795696300000,
    code: 0,
    workflow: 'REPORT_UTILIZE',
    workflowVersion: 1,
    description: null,
    details: { orderId: null, utilisationType: null },
    operations: [],
  };
}

async function mockDocumentsApi(page: Page) {
  const requests: { method: string; url: URL }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installCertificatePluginFixture(page);
  const auth = {
    accessToken: 'synthetic-documents-test',
    expiresAt: '2099-01-01T00:00:00Z',
    user: {
      id: '22222222-2222-4222-8222-222222222222',
      userName: 'test',
      displayName: 'Тест документов',
      email: '',
      firms: [{ id: companyId, name: 'Тестовая компания', role: 'Admin' }],
    },
  };
  const archived = { id: archiveId, name: 'Коды из заказа', gtin: '04600000000000', codesCount: 1 };
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push({ method: request.method(), url });
    const json = (value: unknown) => route.fulfill({ json: value });

    if (path.startsWith('/api/auth/')) return json(auth);
    if (path.endsWith('/session'))
      return json({
        isAuthenticated: true,
        hasHonestSignSession: true,
        certificateThumbprint: 'A'.repeat(40),
        honestSignSessionExpiresAtUtc: '2099-01-01T00:00:00Z',
      });
    if (path.endsWith('/participants/product-groups')) return json(['toys']);
    if (path.endsWith('/orders/search')) return json({ totalItems: 0, items: [] });
    if (path.endsWith('/documents/page')) {
      const cursor = url.searchParams.get('cursor');
      return json({
        items: [
          {
            documentId: registryIds[cursor ? 1 : 0],
            documentDateUtc: '2026-11-26T12:00:00Z',
            receivedAtUtc: null,
            type: 'LK_RECEIPT',
            status: 'CHECKED_OK',
            productGroup: 'toys',
            isIncoming: false,
            errors: [],
          },
        ],
        nextCursor: cursor ? null : continuation,
      });
    }
    if (path.endsWith('/reports/utilisation/batches'))
      return json({ items: [], page: 1, hasNextPage: false });
    if (path.endsWith('/suz/operations')) return json([archived]);
    if (path.endsWith(`/suz/operations/${archiveId}`))
      return json({ ...archived, codes: [archiveCode] });
    if (path.endsWith(receiptPath)) {
      const selectedId = path.startsWith(contourPath('production')) ? productionReportId : reportId;
      return json({
        results: [makeReceipt(selectedId)],
        page: 1,
        limit: 20,
        totalCount: 1,
        hasNextPage: false,
      });
    }
    if (path.endsWith(`${receiptPath}/${reportId}`))
      return json([
        {
          ...makeReceipt(reportId),
          operations: [
            {
              operationId: eventId,
              operationType: 'RNMS_GIS_PROCESSED',
              operationDate: 1795696300001,
              docId: relatedDocumentId,
              docDate: 1795696300001,
              state: 'PARTIALLY',
              description: null,
              processed: 1,
              total: 2,
            },
          ],
        },
      ]);
    if (path.endsWith(`${receiptPath}/${reportId}/operations/${eventId}/codes`)) {
      return json([{ cis, code: 4, description: 'Код отклонён при обработке' }]);
    }
    return json({ items: [], total: 0, unreadCount: 0 });
  });
  return { requests, errors };
}

test('Documents show completed SUZ receipts and their code results in the selected environment', async ({
  page,
}) => {
  const { requests, errors } = await mockDocumentsApi(page);
  await page.goto('/#/crpt?service=suz');
  await page.getByRole('tab', { name: 'Документы', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Ввод в оборот', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Вывод из оборота', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Квитанции СУЗ' }).click();
  await page.getByRole('combobox', { name: /^Результат/ }).click();
  await page.getByRole('option', { name: 'Выполнено', exact: true }).click();

  const sandboxRoot = contourPath('sandbox') + receiptPath;
  await expect
    .poll(() =>
      requests.some(
        ({ method, url }) =>
          method === 'GET' &&
          url.pathname === sandboxRoot &&
          url.searchParams.get('state') === 'SUCCESS' &&
          url.searchParams.get('workflow') === 'REPORT_UTILIZE',
      ),
    )
    .toBe(true);
  await page
    .getByRole('row', { name: new RegExp(reportId) })
    .getByRole('button', { name: 'Открыть' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Квитанция СУЗ' });
  await expect(dialog.getByText('Обработано ГИС МТ', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Результаты по КИ' }).click();
  await expect(dialog.getByRole('row', { name: new RegExp(cis) })).toContainText(
    'Код отклонён при обработке',
  );
  expect(
    requests.some(
      ({ url }) => url.pathname === `${sandboxRoot}/${reportId}/operations/${eventId}/codes`,
    ),
  ).toBe(true);
  expect(requests.some(({ url }) => url.pathname.includes(relatedDocumentId))).toBe(false);
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();

  await page.getByRole('tab', { name: 'Рабочий контур', exact: true }).click();
  await expect(page.getByText('Промышленная среда', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Отчёты о нанесении', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Квитанции СУЗ' }).click();
  await expect(page.getByRole('row', { name: new RegExp(productionReportId) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(reportId) })).toHaveCount(0);
  expect(requests.some(({ url }) => url.pathname === contourPath('production') + receiptPath)).toBe(
    true,
  );
  expect(
    requests
      .filter(({ url }) => url.pathname.includes(receiptPath))
      .every(({ method }) => method === 'GET'),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('Processed documents use the True API continuation and reset on a filter change', async ({
  page,
}) => {
  const { requests, errors } = await mockDocumentsApi(page);
  await page.goto('/#/crpt?service=documents');
  await page.getByRole('tab', { name: 'Обработанные в ГИС МТ' }).click();
  await expect(page.getByText(registryIds[0], { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.getByText(registryIds[1], { exact: true })).toBeVisible();
  await expect(page.getByText('Страница 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Далее', exact: true })).toBeDisabled();
  const registryPath = contourPath('sandbox') + '/documents/page';
  expect(
    requests.some(
      ({ url }) =>
        url.pathname === registryPath &&
        url.searchParams.get('view') === 'processed' &&
        url.searchParams.get('cursor') === continuation,
    ),
  ).toBe(true);
  await page.getByRole('combobox', { name: 'Направление', exact: true }).selectOption('incoming');
  await expect(page.getByText(registryIds[0], { exact: true })).toBeVisible();
  await expect(page.getByText('Страница 1', { exact: true })).toBeVisible();
  expect(
    requests.some(
      ({ url }) =>
        url.pathname === registryPath &&
        url.searchParams.get('direction') === 'incoming' &&
        !url.searchParams.has('cursor'),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('Utilisation form reads the selected SUZ archive document without sending a report', async ({
  page,
}) => {
  const { requests, errors } = await mockDocumentsApi(page);
  await page.goto('/#/crpt?service=documents');
  await page.getByRole('button', { name: 'Создать отчёт' }).click();
  await expect(page.getByRole('heading', { name: 'Отчёт о нанесении кодов' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Товарная группа' })).toHaveValue('toys');
  await page.getByLabel(/^Дата производства/).fill('2025-10-01');
  await page.getByRole('button', { name: 'Перейти к товарам' }).click();
  await page
    .getByRole('combobox', { name: 'Документ с полученными кодами' })
    .selectOption(archiveId);
  await expect(page.getByRole('button', { name: 'Проверить коды' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Подписать и отправить отчёт' })).toBeDisabled();
  expect(
    requests.some(
      ({ method, url }) =>
        method === 'GET' &&
        url.pathname === `${contourPath('sandbox')}/suz/operations/${archiveId}`,
    ),
  ).toBe(true);
  expect(
    requests.some(
      ({ method, url }) => method === 'POST' && url.pathname.includes('/reports/utilisation'),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('Utilisation signs the full archive code only after checking and submitting the report', async ({
  page,
}) => {
  await mockDocumentsApi(page);
  const base = contourPath('sandbox');
  const signedBodies: string[] = [];
  await page.route(`**${base}/codes/check`, (route) =>
    route.fulfill({ json: { result: true, quantity: 1 } }),
  );
  await page.route(`**${base}/codes/info`, (route) =>
    route.fulfill({
      json: [
        {
          requestedCode: cis,
          cis,
          gtin: '04600000000000',
          productGroup: 'toys',
          status: 'EMITTED',
        },
      ],
    }),
  );
  await page.route(`**${base}/reports/utilisation?*`, async (route) => {
    expect(route.request().headers()['x-signature']).toBe('synthetic-certificate-proof');
    expect(route.request().postDataJSON()).toEqual({
      productGroup: 'toys',
      attributes: { productionDate: '2025-10-01' },
      sntins: [archiveCode],
    });
    signedBodies.push(route.request().postData()!);
    await route.fulfill({ json: { reportId, status: 'PENDING' } });
  });
  await page.route(`**${base}/reports/utilisation/${reportId}/status`, (route) =>
    route.fulfill({ json: { reportId, status: 'SUCCESS' } }),
  );

  await page.goto('/#/crpt?service=documents');
  await page.getByRole('button', { name: 'Создать отчёт' }).click();
  await page.getByLabel(/^Дата производства/).fill('2025-10-01');
  await page.getByRole('button', { name: 'Перейти к товарам' }).click();
  await page
    .getByRole('combobox', { name: 'Документ с полученными кодами' })
    .selectOption(archiveId);
  await page.getByRole('button', { name: 'Проверить коды' }).click();
  const submit = page.getByRole('button', { name: 'Подписать и отправить отчёт' });
  await expect(submit).toBeEnabled();
  expect(signedBodies).toHaveLength(0);
  await submit.click();
  await expect(page.getByText(`Отчёт ${reportId}`, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Обновить статус отчёта' })).toBeEnabled();
  await expect(page.getByRole('tab', { name: 'Квитанции СУЗ' })).toBeEnabled();
  const messages = await page.evaluate(
    () => (window as unknown as { certificateSignedMessages: string[] }).certificateSignedMessages,
  );
  expect(signedBodies).toEqual([messages.at(-1)]);
});

test('Special utilisation prepares a pair and signs the exact prepared SUZ body', async ({
  page,
}) => {
  await mockDocumentsApi(page);
  const base = contourPath('sandbox');
  const thumbprint = 'A'.repeat(40);
  const hash = 'a'.repeat(64);
  const old = '010460000000000021OLD0000000001';
  let preparedBody = '';
  let signed = 0;
  const receipt = () => ({
    id: archiveId,
    operation: 'SuzReport',
    documentType: 'SPLITMARK',
    productGroup: 'toys',
    state: 'Prepared',
    payloadHash: hash,
    documentJson: preparedBody,
    certificateThumbprint: thumbprint,
    codesCount: 1,
  });
  await page.route(`**${base}/turnover/capabilities`, (route) =>
    route.fulfill({ json: { participantInn: '7701000000' } }),
  );
  await page.route(`**${base}/suz/reports/prepare`, async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({ kind: 'SPLITMARK', productGroup: 'toys' });
    preparedBody = request.documentJson;
    expect(JSON.parse(preparedBody)).toEqual({
      productGroup: 'toys',
      utilisationType: 'SPLITMARK',
      sntins: [`${archiveCode}\x1e${old}`],
      attributes: { participantId: '7701000000' },
    });
    await route.fulfill({ json: receipt() });
  });
  await page.route(`**${base}/turnover/${archiveId}`, (route) =>
    route.fulfill({ json: receipt() }),
  );
  await page.route(`**${base}/turnover/${archiveId}/submit`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      payloadHash: hash,
      signature: 'synthetic-certificate-proof',
      certificateThumbprint: thumbprint,
    });
    signed++;
    await route.fulfill({
      json: { ...receipt(), state: 'Submitted', documentJson: null, externalDocumentId: reportId },
    });
  });

  await page.goto('/#/crpt?service=documents');
  await page.getByRole('button', { name: 'Особое нанесение' }).click();
  await page.getByLabel('Новые полные коды маркировки').fill(archiveCode);
  await page.getByLabel('Исходные коды идентификации').fill(old);
  await page.getByRole('button', { name: 'Подготовить отчёт' }).click();
  const dialog = page.getByRole('dialog', { name: 'Проверка и подписание отчёта СУЗ' });
  const send = dialog.getByRole('button', { name: 'Подписать и отправить' });
  await expect(send).toBeDisabled();
  expect(signed).toBe(0);
  await dialog.getByRole('checkbox', { name: /подтверждаю подписание/ }).check();
  await send.click();
  await expect(
    page.getByRole('dialog', { name: 'Состояние отчёта СУЗ' }).getByText('Передан в СУЗ'),
  ).toBeVisible();
  expect(signed).toBe(1);
  const messages = await page.evaluate(
    () => (window as unknown as { certificateSignedMessages: string[] }).certificateSignedMessages,
  );
  expect(messages.at(-1)).toBe(preparedBody);
});
