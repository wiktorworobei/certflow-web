// Isolated UI checks with explicit fixtures. Full-stack tests are in app.spec.ts.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function fixtures(page: Page, lookupConfigured = false, declarationOverrides: Record<string, unknown> = {}, role = 'Admin', showOverwriteWarning = false, profile: { displayName?: string; firmName?: string } = {}) {
  const firm = { id: '11111111-1111-4111-8111-111111111111', name: profile.firmName ?? 'Моя компания', inn: '', role };
  const user = { id: '33333333-3333-4333-8333-333333333333', userName: 'SuperViktor', displayName: profile.displayName ?? 'Виктор', email: '', firms: [firm, { ...firm, id: '22222222-2222-4222-8222-222222222222', name: 'Вектор Импорт' }] };
  if (!showOverwriteWarning) await page.addInitScript(id => localStorage.setItem(`certflow.dadata-overwrite-warning.v1.${id}`, 'hidden'), user.id);
  let signedIn = false;
  let personalKey = false; let keyVerified = false; let failCheck = false;
  const keyState = () => ({ enabled: true, hasPersonalKey: personalKey, isConfigured: personalKey || lookupConfigured, source: personalKey ? 'Personal' : lookupConfigured ? 'Server' : 'None', updatedAt: personalKey ? '2026-10-20T10:00:00Z' : null, verifiedAt: keyVerified ? '2026-10-20T10:00:00Z' : null });
  const rows = ['Оборудование для упаковки', 'Одежда второго слоя', 'Светильники светодиодные', 'Мебель для офиса', 'Оборудование насосное', 'Текстиль домашний'].map((title, i) => ({ id: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`, reference: `CF-26-${100 + i}`, title, kind: 'Декларация ТР ЕАЭС', status: ['Draft', 'InReview', 'Ready'][i % 3], applicant: 'ООО «Атлас Импорт»', manufacturer: 'Atlas Manufacturing', product: title, tnVed: '8422400008', registrationNumber: '', validUntil: '2027-10-14', updatedAt: '2026-10-15T08:00:00Z', isSample: true, revision: 2 }));
  const party = { name: '', inn: '', ogrn: '', kpp: '', country: 'Россия', address: '', email: '', phone: '', signatory: '', position: '' };
  if (typeof declarationOverrides.status === 'string') rows[0].status = declarationOverrides.status;
  if (typeof declarationOverrides.revision === 'number') rows[0].revision = declarationOverrides.revision;
  let savedBody: Record<string, unknown> | null = null;
  const statusRequests: { id: string; status: string; revision: number; reason?: string }[] = []; let statusFailure = false;
  const declarationEvents = new Map<string, Record<string, unknown>[]>();
  const declarationData = (row = rows[0]) => ({ ...row, ...(savedBody ?? {}), applicant: party, manufacturer: party,
    product: { name: '', identification: '', tnVed: '', okpd2: '', gtin: '', productionType: 'Serial', batchDetails: '', storageConditions: '', ...((savedBody?.product as object) ?? {}) },
    regulations: [], additionalInfo: '', adoptedAt: null, validUntil: null, scheme: '1д', reports: [], attachments: [], missingRequirements: ['заявитель'], ...declarationOverrides,
    status: row.status, revision: row.revision, events: declarationEvents.get(row.id) ?? declarationOverrides.events ?? [] });
  let markingSettings = { profile: 'Sandbox', omsId: '', connectionId: '', participantInn: '', updatedAtUtc: null as string | null };
  const markingLinks: Record<string, unknown>[] = [];
  const batches = new Map<string, { body: Record<string, unknown>; metadata: Record<string, unknown> }>();
  const batchSubmissions: Record<string, unknown>[] = []; let loseBatchResponse = false;
  const organizations: Record<string, unknown>[] = []; let directoryFailure = false; let directoryRefreshes = 0;
  const identityMatch = (firmId: string, inn: string, ogrn: string, kpp: string) => {
    const rows = organizations.filter(o => o.firmId === firmId && String(o.kpp ?? '').trim() === kpp.trim());
    return (inn.trim() ? rows.find(o => o.inn === inn.trim()) ?? rows.find(o => !o.inn && !!ogrn.trim() && o.ogrn === ogrn.trim()) : rows.find(o => !!ogrn.trim() && o.ogrn === ogrn.trim())) ?? null;
  };
  let directoryDeletions = 0; let directoryDeletionFailure = false;
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const p = url.pathname.replace(/\/$/, '');
    if (!p.startsWith('/api/')) return route.continue();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const auth = { accessToken: 'ui-test-token', expiresAt: '2099-01-01T00:00:00Z', user };
    if (p === '/api/auth/refresh') return signedIn ? json(auth) : json({ detail: 'Войдите в аккаунт.' }, 401);
    if (p === '/api/auth/login') {
      if (request.postDataJSON().password !== 'test12345-') return json({ detail: 'Неверный логин или пароль.' }, 401);
      signedIn = true; return json(auth);
    }
    if (p === '/api/auth/logout') { signedIn = false; return route.fulfill({ status: 204 }); }
    if (!signedIn) return json({}, 401);
    if (p.endsWith('/marking/settings')) {
      if (request.method() === 'PUT') markingSettings = { ...markingSettings, ...request.postDataJSON(), updatedAtUtc: '2026-10-20T10:00:00Z' };
      return json(markingSettings);
    }
    if (p.endsWith('/marking/connections')) return json({ profile: 'Sandbox', chz: null, dmKod: [] });
    if (p.endsWith('/marking/links')) {
      if (request.method() === 'POST') markingLinks.push({ ...request.postDataJSON(), id: '55555555-5555-4555-8555-555555555555', declarationReference: rows[0].reference, declarationTitle: rows[0].title, registrationNumber: '', productName: 'Моторное масло', createdAtUtc: '2026-10-20T10:00:00Z' });
      return json(request.method() === 'POST' ? markingLinks.at(-1) : markingLinks);
    }
    if (p.endsWith('/marking/honest-sign/session')) return json({ isAuthenticated: true, hasHonestSignSession: false, certificateThumbprint: null, honestSignSessionExpiresAtUtc: null });
    if (p.endsWith('/marking/dmkod/session')) return json({ isAuthenticated: true, hasDmKodSession: false, environment: request.headers()['x-dmkod-environment'] ?? 'TEST' });
    if (p.endsWith('/marking/documents') && request.method() === 'POST') return json({ id: request.postDataJSON().id, replayed: false });
    if (p.endsWith('/marking/batches')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); batchSubmissions.push(body);
        const replayed = batches.has(body.id); const linkId = '66666666-6666-4666-8666-666666666666';
        if (!replayed) {
          const link = { ...body, id: linkId, declarationReference: rows[0].reference, declarationTitle: rows[0].title, registrationNumber: '', gtin: body.gtin, provider: 'ChZ', environment: 'Sandbox', productName: rows[0].title, codesDocumentId: body.id, createdAtUtc: '2026-10-20T10:00:00Z' };
          markingLinks.push(link); batches.set(body.id, { body, metadata: { id: body.id, title: body.title, uploadedAtUtc: '2026-10-20T10:00:00Z', compositionConfirmed: true, codes: body.codes.length, boxes: 0, pallets: 0, declarations: [link] } });
        }
        if (loseBatchResponse) { loseBatchResponse = false; return route.abort('failed'); }
        return json({ id: body.id, linkId, replayed });
      }
      const search = url.searchParams.get('search') ?? ''; const declaration = url.searchParams.get('declarationId');
      const items = [...batches.values()].filter(b => (!declaration || b.body.declarationId === declaration) && (!search || `${b.body.title} ${b.body.gtin} ${b.body.batchNumber}`.includes(search))).map(b => b.metadata);
      return json({ items, total: items.length, page: 1, pageSize: 10 });
    }
    if (p.includes('/marking/batches/')) {
      const [id, operation] = p.split('/marking/batches/')[1].split('/'); const batch = batches.get(id);
      if (!batch) return json({ message: 'Партия не найдена.' }, 404);
      if (operation === 'codes') { const values = batch.body.codes as string[]; return json({ items: values.map((code, i) => ({ sequenceNumber: i + 1, code, status: 'Printed', boxSscc: null, palletSscc: null })), total: values.length, page: 1, pageSize: 50 }); }
      if (operation === 'download') return route.fulfill({ contentType: 'text/plain', body: (batch.body.codes as string[]).join('\r\n') + '\r\n' });
      return json(batch.metadata);
    }
    if (p === '/api/me/integrations/dadata') {
      if (request.method() === 'PUT') { personalKey = true; keyVerified = false; }
      if (request.method() === 'DELETE') { personalKey = false; keyVerified = false; }
      return json(keyState());
    }
    if (p === '/api/me/integrations/dadata/check') { keyVerified = !failCheck; return failCheck ? json({ detail: 'DaData отклонила доступ. Проверьте API-ключ.' }, 503) : json(keyState()); }
    if (p.endsWith('/integrations')) return json([
      { id: 'fgis', name: 'ФГИС Росаккредитации', status: 'NotConfigured', description: 'Черновики и статусы' },
      { id: 'marking', name: 'Честный знак', status: 'NotConfigured', description: 'Маркировка' },
      { id: 'erp', name: '1С / ERP', status: 'NotConfigured', description: 'Товары и поставки' },
      { id: 'organizations', name: 'DaData — реквизиты компаний', status: lookupConfigured || personalKey ? 'Configured' : 'NotConfigured', description: 'Поиск реквизитов' },
    ]);
    if (p.endsWith('/dashboard')) return json({ total: rows.filter(r => r.status !== 'Archived').length, draft: rows.filter(r => r.status === 'Draft').length, inReview: rows.filter(r => r.status === 'InReview').length, ready: rows.filter(r => r.status === 'Ready').length, registered: rows.filter(r => r.status === 'Registered').length, expiring: 0, suspended: 0, organizations: 2, recent: rows.filter(r => r.status !== 'Archived'), expiringDocuments: [], activity: [{ declarationId: rows[0].id, reference: rows[0].reference, title: rows[0].title, occurredAt: rows[0].updatedAt, actor: 'Виктор', description: 'Обновлены сведения документа' }] });
    if (p.endsWith('/organizations/refresh-schedule')) return json({ enabled: true, hour: 3, timeZoneId: 'Europe/Minsk' });
    if (p.endsWith('/organizations/match')) return json({ organization: identityMatch(p.split('/')[3], url.searchParams.get('inn') ?? '', url.searchParams.get('ogrn') ?? '', url.searchParams.get('kpp') ?? '') });
    if (/\/organizations\/[^/]+\/refresh$/.test(p)) {
      directoryRefreshes++;
      const org = organizations.find(o => o.id === p.split('/').at(-2) && o.firmId === p.split('/')[3]);
      if (!org) return json({ detail: 'Не найдена' }, 404);
      org.registryAttemptedAt = '2026-10-21T00:00:00Z'; org.registryError = directoryFailure ? 'DaData недоступна. Повторите позже.' : '';
      if (!directoryFailure) { Object.assign(org, { name: 'Обновлённая компания', phone: '', email: '', registrationAuthority: '', signatory: '', position: '', registryCheckedAt: org.registryAttemptedAt, registryStatus: 'ACTIVE' }); }
      return json(org);
    }
    if (p.endsWith('/organizations') || /\/organizations\/[^/]+$/.test(p)) {
      const firmId = p.split('/')[3];
      if (request.method() === 'DELETE') {
        directoryDeletions++;
        if (role === 'Viewer') return json({ detail: 'Недостаточно прав.' }, 403);
        if (directoryDeletionFailure) return json({ detail: 'Не удалось удалить компанию. Повторите позже.' }, 503);
        const index = organizations.findIndex(o => o.firmId === firmId && o.id === p.split('/').at(-1));
        if (index < 0) return json({ detail: 'Компания не найдена.' }, 404);
        organizations.splice(index, 1); return route.fulfill({ status: 204 });
      }
      if (request.method() === 'POST' || request.method() === 'PUT') {
        const body = request.postDataJSON(); const id = request.method() === 'PUT' ? p.split('/').at(-1) : undefined;
        const matched = identityMatch(firmId, body.inn ?? '', body.ogrn ?? '', body.kpp ?? '');
        const existing = id ? organizations.find(o => o.firmId === firmId && o.id === id) : matched;
        if (id && !existing) return json({ detail: 'Компания не найдена.' }, 404);
        if (!id && existing && body.existingOrganizationId !== existing.id) return json({ detail: 'Компания с такими ИНН и КПП уже есть в справочнике.' }, 409);
        if (!id && body.existingOrganizationId && existing?.id !== body.existingOrganizationId) return json({ detail: 'Состав справочника изменился.' }, 409);
        if (organizations.some(o => o.firmId === firmId && o.id !== existing?.id && (o.kpp ?? '') === (body.kpp ?? '') && ((body.inn && o.inn === body.inn) || (body.ogrn && o.ogrn === body.ogrn)))) return json({ detail: 'Компания с такими ИНН и КПП уже есть в справочнике.' }, 409);
        const org = { ...body, kind: existing && !id && existing.kind !== body.kind ? 'Both' : body.kind, id: existing?.id ?? randomUUID(), firmId };
        delete org.existingOrganizationId;
        if (existing) Object.assign(existing, org); else organizations.push(org);
        return json(org);
      }
      return json(organizations.filter(o => o.firmId === firmId));
    }
    if (p.endsWith('/laboratories')) return json([]);
    if (p.endsWith('/declarations') && request.method() === 'POST') {
      savedBody = request.postDataJSON();
      return json({ ...savedBody, id: rows[0].id, reference: 'CF-26-NEW', status: 'Draft', registrationNumber: '', registryUrl: '', createdAt: rows[0].updatedAt, updatedAt: rows[0].updatedAt, isSample: false, revision: 2, reports: [], attachments: [], events: [], missingRequirements: ['заявитель'] });
    }
    if (/\/declarations\/[^/]+\/status$/.test(p) && request.method() === 'POST') {
      const row = rows.find(r => r.id === p.split('/').at(-2)); const body = request.postDataJSON();
      if (role === 'Viewer') return json({ detail: 'Недостаточно прав.' }, 403);
      if (!row) return json({ detail: 'Декларация не найдена.' }, 404);
      statusRequests.push({ id: row.id, ...body });
      if (statusFailure) return json({ detail: 'Не удалось изменить статус. Повторите позже.' }, 503);
      if (body.revision !== row.revision) return json({ detail: 'Документ изменился. Обновите страницу.' }, 409);
      row.status = body.status; row.revision++; row.updatedAt = new Date().toISOString();
      declarationEvents.set(row.id, [...(declarationEvents.get(row.id) ?? []), { occurredAt: row.updatedAt, actor: 'Виктор', description: `Статус: ${body.status === 'Archived' ? 'В архиве' : body.status}${body.reason ? `. ${body.reason}` : ''}` }]);
      return json(declarationData(row));
    }
    if (p.endsWith('/declarations')) {
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const status = url.searchParams.get('status'); const list = rows.filter(r => r.title.toLowerCase().includes(search) && (status ? r.status === status : r.status !== 'Archived'));
      const page = Number(url.searchParams.get('page') ?? 1); const pageSize = Number(url.searchParams.get('pageSize') ?? 10);
      return json({ items: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize });
    }
    if (p.includes('/declarations/')) return json(declarationData(rows.find(r => r.id === p.split('/declarations/')[1].split('/')[0]) ?? rows[0]));
    return json({ detail: 'UI fixture has no handler' }, 404);
  });
  page.on('pageerror', error => console.error('Browser runtime:', error.message));
  return { getDeclarations: () => rows, getStatusRequests: () => statusRequests, failStatusChanges: (value: boolean) => { statusFailure = value; }, getSaved: () => savedBody, getOrganizations: () => organizations, getDirectoryRefreshes: () => directoryRefreshes, getDirectoryDeletions: () => directoryDeletions, failDirectoryDeletion: (value: boolean) => { directoryDeletionFailure = value; }, failDirectory: (value: boolean) => { directoryFailure = value; }, seedOrganization: (data: Record<string, unknown>) => organizations.push({ ...party, autoRefresh: true, kind: 'Both', id: '77777777-7777-4777-8777-000000000000', firmId: firm.id, ...data }), failCheck: (value: boolean) => { failCheck = value; }, loseBatchResponseOnce: () => { loseBatchResponse = true; }, batchSubmissions };
}
async function login(page: Page, displayName = 'Виктор') {
  await page.goto('/'); await page.getByRole('textbox', { name: 'Логин', exact: true }).fill('SuperViktor');
  await page.getByLabel('Пароль', { exact: true }).fill('test12345-'); await page.getByRole('button', { name: 'Войти в CertFlow' }).click();
  await expect(page.getByRole('heading', { name: `Добрый день, ${displayName}` })).toBeVisible();
}

test('login distinguishes an unavailable server from incorrect credentials and can recover', async ({ page }) => {
  await fixtures(page);
  let unavailable = true;
  await page.route('**/api/auth/login', route => unavailable ? route.fulfill({ status: 502, body: '' }) : route.fallback());
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Логин', exact: true }).fill('SuperViktor');
  await page.getByLabel('Пароль', { exact: true }).fill('test12345-');
  await page.getByRole('button', { name: 'Войти в CertFlow' }).click();
  await expect(page.getByRole('alert')).toContainText('Сервис входа сейчас недоступен');
  await expect(page.getByRole('alert')).not.toContainText('Неверный логин или пароль');
  unavailable = false;
  await page.getByLabel('Пароль', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Войти в CertFlow' }).click();
  await expect(page.getByRole('alert')).toContainText('Неверный логин или пароль');
  await page.getByLabel('Пароль', { exact: true }).fill('test12345-');
  await page.getByRole('button', { name: 'Войти в CertFlow' }).click();
  await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
});

test('declaration archive requires confirmation and keeps documents accessible in the archive and history', async ({ page }) => {
  const fixture = await fixtures(page); await login(page);
  await page.getByRole('link', { name: 'Декларации', exact: true }).click();
  const title = 'Оборудование для упаковки'; const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Действия CF-26-100', exact: true }).click();
  await page.getByRole('menuitem', { name: 'В архив', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Отправить в архив?' });
  await expect(dialog).toContainText(title); await expect(dialog).toContainText('Данные, файлы и история сохранятся');
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(dialog).toBeHidden(); expect(fixture.getStatusRequests()).toHaveLength(0);
  await row.getByRole('button', { name: 'Действия CF-26-100', exact: true }).click();
  await page.getByRole('menuitem', { name: 'В архив', exact: true }).click();
  await dialog.getByLabel('Комментарий к архивированию').fill('Работа завершена');
  await dialog.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(row).toHaveCount(0);
  expect(fixture.getStatusRequests()).toEqual([expect.objectContaining({ status: 'Archived', revision: 2, reason: 'Работа завершена' })]);
  await page.goto('/#/declarations?status=Registered&expiring=true');
  await page.getByRole('button', { name: 'Архив', exact: true }).click();
  await expect(page).toHaveURL(/status=Archived/); await expect(page).not.toHaveURL(/expiring/);
  await expect(row).toBeVisible(); await page.reload(); await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Действия CF-26-100', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'В архив', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Открыть документ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'В архив', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Название декларации')).toBeDisabled();
  await page.getByRole('tab', { name: 'Файлы и история', exact: true }).click();
  await expect(page.getByText('Статус: В архиве. Работа завершена', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть архив', exact: true }).click();
  await expect(page).toHaveURL(/status=Archived/);
});

for (const status of ['InReview', 'Suspended']) {
  test(`declaration archive is available from the ${status} editor and respects unsaved changes`, async ({ page }) => {
    const fixture = await fixtures(page, false, { status }, 'Manager'); await login(page);
    await page.goto('/#/declarations/44444444-4444-4444-8444-000000000000');
    const archive = page.getByRole('button', { name: 'В архив', exact: true }); await expect(archive).toBeEnabled();
    if (status === 'InReview') {
      const title = page.getByLabel('Название декларации');
      await expect(title).toHaveValue('Оборудование для упаковки');
      await title.fill('Несохранённые изменения'); await expect(archive).toBeDisabled();
      await title.fill('Оборудование для упаковки'); await expect(archive).toBeEnabled();
      await page.getByRole('button', { name: 'Изменить статус', exact: true }).click();
      await page.getByRole('menuitem', { name: 'В архив', exact: true }).click();
    } else {
      await page.setViewportSize({ width: 390, height: 844 }); await archive.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'declaration-archive-mobile.png'), animations: 'disabled' });
    }
    const dialog = page.getByRole('dialog', { name: 'Отправить в архив?' });
    await dialog.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
    await expect(dialog).toBeHidden(); await expect(page.getByRole('button', { name: 'Открыть архив', exact: true })).toBeVisible();
    await expect(archive).toHaveCount(0); expect(fixture.getDeclarations()[0].status).toBe('Archived');
  });
}

test('declaration archive displays errors and blocks repeated confirmation while submitting', async ({ page }) => {
  const fixture = await fixtures(page); fixture.failStatusChanges(true); await login(page);
  await page.getByRole('link', { name: 'Декларации', exact: true }).click();
  await page.getByRole('button', { name: 'Действия CF-26-100', exact: true }).click();
  await page.getByRole('menuitem', { name: 'В архив', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Отправить в архив?' });
  await dialog.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Не удалось изменить статус');
  expect(fixture.getDeclarations()[0].status).toBe('Draft'); fixture.failStatusChanges(false);
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/declarations/*/status', async route => { await held; await route.fallback(); });
  await dialog.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  try {
    await expect(dialog.getByRole('button', { name: 'Отправляем…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(dialog).toBeHidden(); expect(fixture.getStatusRequests()).toHaveLength(2);
});

test('declaration archive can be read by a viewer who cannot archive documents', async ({ page }) => {
  const fixture = await fixtures(page, false, {}, 'Viewer'); await login(page);
  await page.getByRole('link', { name: 'Декларации', exact: true }).click();
  await page.getByRole('button', { name: 'Действия CF-26-100', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'В архив', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape'); fixture.getDeclarations()[0].status = 'Archived';
  await page.getByRole('button', { name: 'Архив', exact: true }).click();
  await page.getByRole('link', { name: 'Оборудование для упаковки', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Открыть архив', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'В архив', exact: true })).toHaveCount(0);
  expect(fixture.getStatusRequests()).toHaveLength(0);
});

test('declaration archive returns to a valid page after the last row on a page is archived', async ({ page }) => {
  const fixture = await fixtures(page); const rows = fixture.getDeclarations();
  for (let i = 0; i < 5; i++) rows.push({ ...rows[0], id: `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`, reference: `CF-26-P${i}`, title: `Проверка страницы ${i}` });
  await login(page); await page.goto('/#/declarations?page=2');
  await page.getByRole('button', { name: 'Действия CF-26-P4', exact: true }).click();
  await page.getByRole('menuitem', { name: 'В архив', exact: true }).click();
  await page.getByRole('dialog', { name: 'Отправить в архив?' }).getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole('table', { name: 'Реестр деклараций' }).getByRole('row')).toHaveCount(11);
  expect(fixture.getStatusRequests()).toHaveLength(1);
});

test('declaration selects a ChZ product with preview and preserves fields missing from NK', async ({ page }) => {
  const state = await fixtures(page);
  let lookupHeaders: Record<string, string> = {};
  await page.route('**/catalog/products?*', route => {
    lookupHeaders = route.request().headers();
    return route.fulfill({ json: [{ gtin: '05011846021161', name: 'Масло моторное 5W-30', brand: 'Oil Brand', tnved: '2710198200', identification: 'Торговая марка: Oil Brand; Модель: Premium', okpd2: '', storageConditions: '', status: 'published' }] });
  });
  await login(page); await page.goto('/#/declarations/new');
  await page.getByLabel('Название декларации').fill('Декларация на моторное масло');
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await page.getByLabel('ОКПД2', { exact: true }).fill('19.20.29.110');
  await page.getByLabel('Условия хранения и эксплуатации').fill('Хранить в закрытой таре');
  await page.getByLabel('Сведения о партии / изделии').fill('Партия 17');
  await page.getByRole('button', { name: 'Выбрать товар из ЧЗ', exact: true }).click();
  await page.getByLabel('GTIN для поиска в ЧЗ').fill('5011846021161');
  await page.getByRole('button', { name: 'Найти в ЧЗ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Масло моторное 5W-30');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'declaration-product-search.png'), fullPage: true });
  await expect(page.getByLabel('Наименование продукции', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Подставить данные товара' }).click();
  await expect(page.getByLabel('Наименование продукции', { exact: true })).toHaveValue('Масло моторное 5W-30');
  await expect(page.getByLabel('GTIN', { exact: true })).toHaveValue('05011846021161');
  await expect(page.getByLabel('Код ТН ВЭД', { exact: true })).toHaveValue('2710198200');
  await expect(page.getByLabel('ОКПД2', { exact: true })).toHaveValue('19.20.29.110');
  await expect(page.getByLabel('Условия хранения и эксплуатации')).toHaveValue('Хранить в закрытой таре');
  await expect(page.getByLabel('Сведения о партии / изделии')).toHaveValue('Партия 17');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect.poll(() => state.getSaved()?.product).toMatchObject({ name: 'Масло моторное 5W-30', gtin: '05011846021161', okpd2: '19.20.29.110', batchDetails: 'Партия 17' });
  expect(lookupHeaders.authorization).toBe('Bearer ui-test-token');
});

test('declaration ChZ lookup distinguishes unavailable service from missing card and clears stale results', async ({ page }) => {
  await fixtures(page);
  let fail = true;
  await page.route('**/catalog/products?*', route => fail
    ? route.fulfill({ status: 502, json: { message: 'Национальный каталог временно недоступен' } })
    : route.fulfill({ json: [] }));
  await login(page); await page.goto('/#/declarations/new');
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать товар из ЧЗ', exact: true }).click();
  await page.getByLabel('GTIN для поиска в ЧЗ').fill('05011846021161');
  await page.getByRole('button', { name: 'Найти в ЧЗ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Национальный каталог временно недоступен');
  await expect(page.getByRole('button', { name: 'Заполнить товар вручную', exact: true })).toHaveCount(0);
  fail = false; await page.getByRole('button', { name: 'Найти в ЧЗ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('доступная карточка не найдена');
  await page.getByLabel('GTIN для поиска в ЧЗ').fill('5011846021161');
  await expect(page.getByRole('button', { name: 'Заполнить товар вручную', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Найти в ЧЗ', exact: true }).click();
  await page.getByRole('button', { name: 'Заполнить товар вручную', exact: true }).click();
  await expect(page.getByLabel('GTIN', { exact: true })).toHaveValue('05011846021161');
  await expect(page.getByLabel('Наименование продукции', { exact: true })).toHaveValue('');
});

test('standalone NK card creation needs no declaration and does not save or link one', async ({ page }) => {
  const state = await fixtures(page);
  let externalCard: Record<string, unknown> | null = null;
  let orderRequests = 0; let linkWrites = 0;
  page.on('request', request => { if (request.url().includes('/orders/')) orderRequests++; if (request.url().includes('/marking/links') && request.method() === 'POST') linkWrites++; });
  await page.route('**/marking/honest-sign/**', route => {
    const p = new URL(route.request().url()).pathname;
    if (p.endsWith('/session')) return route.fulfill({ json: { isAuthenticated: true, hasHonestSignSession: true, certificateThumbprint: 'A'.repeat(40), honestSignSessionExpiresAtUtc: '2099-01-01T00:00:00Z' } });
    if (p.endsWith('/connectivity')) return route.fulfill({ json: { isAvailable: true } });
    if (p.endsWith('/categories')) return route.fulfill({ json: [{ id: 100, name: 'Моторные масла', parentId: 0, level: 1, isActive: true }] });
    if (p.endsWith('/attributes')) return route.fulfill({ json: [] });
    if (p.endsWith('/submissions')) return route.fulfill({ json: { items: [], hasNextPage: false } });
    if (p.endsWith('/autofluids/cards')) { externalCard = route.request().postDataJSON(); return route.fulfill({ json: { id: '88888888-8888-4888-8888-888888888888', gtin: '05011846021161', state: 'Accepted', feedId: '42', sendToModeration: false, createdAtUtc: '2026-10-21T10:00:00Z' } }); }
    if (p.endsWith('/status')) return route.fulfill({ json: { submissionId: '88888888-8888-4888-8888-888888888888', feedId: '42', submissionState: 'Accepted', status: 'Received', receivedAtUtc: null, updatedAtUtc: null, errors: [] } });
    if (p.endsWith('/card')) return route.fulfill({ json: { submissionId: '88888888-8888-4888-8888-888888888888', gtin: '05011846021161', goodId: 42, status: 'draft', detailedStatuses: ['draft'], isSigned: false, canOrderCodes: false, canIntroduce: false, canEdit: false, canModerate: false, canSign: false, draft: null, blockingOperation: null } });
    return route.fulfill({ status: 404, json: { message: 'Unconfigured catalog test route' } });
  });
  await login(page); await page.getByRole('link', { name: 'Карточки ЧЗ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Карточки ЧЗ', exact: true })).toBeVisible();
  await expect(page.locator('#catalog-name')).toHaveValue('');
  await expect(page.getByLabel('Название декларации')).toHaveCount(0);
  expect(externalCard).toBeNull();
  await page.locator('#catalog-name').fill('Новое масло Premium');
  await page.locator('#catalog-gtin').fill('05011846021161');
  await page.locator('#catalog-tnved').fill('2710198200');
  await page.locator('#catalog-brand').fill('Oil Brand');
  await page.getByRole('button', { name: 'Подобрать категории' }).click();
  await page.getByRole('combobox', { name: 'Категория НК *', exact: true }).selectOption('100');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'standalone-catalog.png'), fullPage: true });
  await page.getByRole('button', { name: 'Создать черновик', exact: true }).click();
  await expect.poll(() => externalCard).toMatchObject({ name: 'Новое масло Premium', gtin: '05011846021161', categoryId: 100, brand: 'Oil Brand', sendToModeration: false });
  await expect(page.locator('main')).toContainText('42');
  expect(state.getSaved()).toBeNull(); expect(linkWrites).toBe(0); expect(orderRequests).toBe(0);
  await expect(page).toHaveURL(/#\/catalog$/);
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.marking-surface')).toHaveClass(/dark/);
  await expect(page.locator('#catalog-name')).toHaveValue('Новое масло Premium');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'standalone-catalog-dark-mobile.png'), animations: 'disabled', timeout: 8000 });
});

test('declaration has no NK creation even through an old URL and separate catalog offers certificate login', async ({ page }) => {
  const state = await fixtures(page);
  await login(page); await page.goto('/#/declarations/new?catalog=create');
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить и создать карточку в ЧЗ', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Выбрать товар из ЧЗ', exact: true })).toBeVisible();
  expect(state.getSaved()).toBeNull();
  await page.getByRole('link', { name: 'Карточки ЧЗ', exact: true }).click();
  await expect(page.locator('#honest-sign-certificate')).toBeVisible();
  expect(state.getSaved()).toBeNull();
});

test('viewer cannot create cards in the separate ChZ catalog', async ({ page }) => {
  await fixtures(page, false, {}, 'Viewer'); await login(page);
  await page.getByRole('link', { name: 'Карточки ЧЗ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('доступны специалисту или администратору');
  await expect(page.locator('#catalog-name')).toHaveCount(0);
  await expect(page.locator('#honest-sign-certificate')).toHaveCount(0);
});

test('registered declaration cannot import or create an NK product', async ({ page }) => {
  await fixtures(page, false, { status: 'Registered' });
  await login(page); await page.goto('/#/declarations/44444444-4444-4444-8444-000000000000');
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выбрать товар из ЧЗ', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Сохранить и создать карточку в ЧЗ', exact: true })).toHaveCount(0);
});

test('marking links connect a declaration to a GTIN and batch', async ({ page }) => {
  await fixtures(page); await login(page); await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click();
  await page.getByRole('combobox', { name: 'Декларация для товара' }).click();
  await page.getByRole('option', { name: /CF-26-100/ }).click();
  await page.getByLabel('GTIN товара').fill('05011846021161');
  await page.getByLabel('ID внешнего заказа').fill('synthetic-order-17');
  await page.getByLabel('Номер партии (необязательно)').fill('OIL-17');
  await page.getByRole('button', { name: 'Связать с декларацией' }).click();
  await expect(page.getByText('Связь с декларацией сохранена.')).toBeVisible();
  await expect(page.getByText(/Партия OIL-17 · Заказ synthetic-order-17/)).toBeVisible();
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'marking-links.png'), fullPage: true });
});

test('marking settings show active external sessions and save company identifiers', async ({ page }) => {
  await fixtures(page);
  await page.route('**/marking/connections', route => route.fulfill({ json: { profile: 'Sandbox', chz: { dateModified: '2026-10-20T10:00:00Z', expiresAtUtc: '2099-01-01T10:00:00Z' }, dmKod: [{ environment: 'TEST', dateModified: '2026-10-20T10:00:00Z', accessTokenExpiresAtUtc: '2099-01-01T10:00:00Z', honestSignConnectedAtUtc: null }] } }));
  await login(page); await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await expect(page.getByLabel('Успешные подключения')).toContainText('Честный знак · Наша марка');
  await page.getByLabel('ИНН участника ЧЗ').fill('7707083893');
  await page.getByLabel('OMS ID', { exact: true }).fill('11111111-1111-4111-8111-111111111111');
  await page.getByLabel('Connection ID', { exact: true }).fill('22222222-2222-4222-8222-222222222222');
  await page.getByRole('button', { name: 'Сохранить настройки ЧЗ' }).click();
  await expect(page.getByText('Настройки сохранены. Выполните вход по сертификату в разделе «ЧЗ и Наша марка».')).toBeVisible();
});

test('code batch import preserves GS and requires physical confirmation', async ({ page }) => {
  await fixtures(page); let imported: Record<string, unknown> | undefined;
  await page.route('**/marking/batches', route => { if (route.request().method() === 'POST') imported = route.request().postDataJSON(); return route.fallback(); });
  await login(page); await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click();
  await page.getByRole('tab', { name: 'Партии и коды' }).click();
  await page.getByRole('combobox', { name: 'Декларация партии' }).click(); await page.getByRole('option', { name: /CF-26-100/ }).click();
  await page.getByLabel('GTIN партии').fill('05011846021161');
  await page.getByLabel('Полные коды Data Matrix').fill('010501184602116121SYNTHETIC<GS>93TEST');
  await expect(page.getByRole('button', { name: 'Сохранить партию и связать с декларацией' })).toBeDisabled();
  await page.getByLabel('Коды нанесены, физический результат и состав партии проверены').check();
  await page.getByRole('button', { name: 'Сохранить партию и связать с декларацией' }).click();
  await expect(page.getByText(/Состав партии сохранён и связан с декларацией/)).toBeVisible();
  expect(imported?.codes).toEqual(['010501184602116121SYNTHETIC\u001d93TEST']);
  expect(imported?.physicalOutcomesConfirmed).toBe(true);
});

async function fillBatch(page: Page) {
  await login(page); await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click(); await page.getByRole('tab', { name: 'Партии и коды' }).click();
  await page.getByRole('combobox', { name: 'Декларация партии' }).click(); await page.getByRole('option', { name: /CF-26-100/ }).click();
  await page.getByLabel('Название партии').fill('Масло · партия OIL-42'); await page.getByLabel('GTIN партии').fill('05011846021161');
}

test('batch file import, journal and download preserve full code and GS on mobile in dark theme', async ({ page }) => {
  await fixtures(page); await fillBatch(page);
  const fullCode = '010501184602116121SYNTHETIC\u001d93tail,"x"';
  await page.getByLabel('Файл с кодами партии').setInputFiles({ name: 'codes.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFFcode\r\n"' + fullCode.replaceAll('"', '""') + '"\r\n') });
  await expect(page.getByText('Загружено кодов: 1. Проверьте состав перед сохранением.')).toBeVisible();
  await page.getByLabel('Коды нанесены, физический результат и состав партии проверены').check();
  await page.getByRole('button', { name: 'Сохранить партию и связать с декларацией' }).click();
  const dialog = page.getByRole('dialog', { name: 'Масло · партия OIL-42', exact: true });
  await expect(dialog.getByRole('table', { name: 'Состав кодов партии' })).toBeVisible();
  await expect(dialog.getByText(fullCode.replaceAll('\u001d', '<GS>'), { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Скачать полные коды TXT' }).click();
  const file = await downloadEvent; expect(fs.readFileSync((await file.path())!, 'utf8')).toBe(fullCode + '\r\n');
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск партии, GTIN или документа' }).fill('OIL-42'); await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click(); await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Масло · партия OIL-42', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'marking-batches-dark-mobile.png'), fullPage: true });
});

test('unknown batch outcome retries identical frozen request without duplicate and can recover after reload', async ({ page }) => {
  const fixture = await fixtures(page); fixture.loseBatchResponseOnce(); await fillBatch(page);
  await page.getByLabel('Полные коды Data Matrix').fill('010501184602116121SYNTHETIC<GS>93TAIL');
  await page.getByLabel('Коды нанесены, физический результат и состав партии проверены').check();
  await page.getByRole('button', { name: 'Сохранить партию и связать с декларацией' }).click();
  await expect(page.getByRole('button', { name: 'Проверить и повторить сохранение' })).toBeVisible();
  await expect(page.getByLabel('GTIN партии')).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Декларация партии' })).toBeDisabled();
  const stored = await page.evaluate(() => JSON.stringify(sessionStorage)); expect(stored).not.toContain('SYNTHETIC');
  await page.getByRole('button', { name: 'Проверить и повторить сохранение' }).click();
  await expect(page.getByRole('dialog', { name: 'Масло · партия OIL-42' })).toBeVisible();
  expect(fixture.batchSubmissions).toHaveLength(2); expect(fixture.batchSubmissions[0]).toEqual(fixture.batchSubmissions[1]);
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  fixture.loseBatchResponseOnce(); await page.getByLabel('Полные коды Data Matrix').fill('010501184602116121SECOND<GS>93TAIL'); await page.getByLabel('Коды нанесены, физический результат и состав партии проверены').check();
  await page.getByRole('button', { name: 'Сохранить партию и связать с декларацией' }).click(); await expect(page.getByRole('button', { name: 'Проверить и повторить сохранение' })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Проверить сохранение', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Масло · партия OIL-42' })).toBeVisible(); expect(fixture.batchSubmissions).toHaveLength(3);
});

test('viewer sees batch journal but cannot import or request raw codes', async ({ page }) => {
  await fixtures(page, false, {}, 'Viewer'); let rawRequests = 0;
  const row = { id: '77777777-7777-4777-8777-777777777777', title: 'Партия для наблюдателя', uploadedAtUtc: '2026-10-20T10:00:00Z', compositionConfirmed: true, codes: 10, boxes: 0, pallets: 0, declarations: [] };
  await page.route('**/marking/batches*', route => route.fulfill({ json: { items: [row], total: 1, page: 1, pageSize: 10 } }));
  await page.route('**/marking/batches/**', route => { if (route.request().url().endsWith('/codes')) rawRequests++; return route.fulfill({ json: row }); });
  await login(page); await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click(); await page.getByRole('tab', { name: 'Партии и коды' }).click();
  await expect(page.getByLabel('Полные коды Data Matrix')).toHaveCount(0); await page.getByRole('button', { name: 'Открыть партию' }).click();
  await expect(page.getByText('Просмотр полных кодов и скачивание доступны специалисту или администратору компании.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Скачать полные коды TXT' })).toHaveCount(0); expect(rawRequests).toBe(0);
});

test('DMkod login uses the company API and TEST context without retaining password', async ({ page }) => {
  await fixtures(page); let sent: { body: unknown; headers: Record<string, string>; url: string } | undefined;
  await page.route('**/marking/dmkod/auth/sign-in', route => { const r = route.request(); sent = { body: r.postDataJSON(), headers: r.headers(), url: r.url() }; return route.fulfill({ status: 400, json: { message: 'Тестовый ответ: неверный пароль DMkod.' } }); });
  await login(page); await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click(); await page.getByRole('tab', { name: 'Наша марка', exact: true }).click();
  await page.getByLabel('Имя пользователя', { exact: true }).fill('synthetic-operator'); await page.getByLabel('Пароль', { exact: true }).fill('synthetic-secret');
  await page.getByRole('button', { name: 'Войти в DMkod', exact: true }).click();
  await expect(page.getByText('Тестовый ответ: неверный пароль DMkod.')).toBeVisible();
  expect(sent?.url).toContain('/api/firms/11111111-1111-4111-8111-111111111111/marking/');
  expect(sent?.headers.authorization).toBe('Bearer ui-test-token'); expect(sent?.headers['x-dmkod-environment']).toBe('TEST');
  expect(sent?.body).toEqual({ username: 'synthetic-operator', password: 'synthetic-secret' });
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain('synthetic-secret');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'marking-dmkod.png'), fullPage: true });
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'marking-dmkod-dark-mobile.png'), fullPage: true });
});

test('company switch during certificate signing prevents authentication submission', async ({ page }) => {
  await fixtures(page); let submissions = 0;
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const cert = { HasPrivateKey: true, SubjectName: 'CN=Synthetic test', IssuerName: 'Test', Thumbprint: 'A'.repeat(40), ValidFromDate: '2026-01-01', ValidToDate: '2099-01-01' };
    const certs = { Count: 1, Find: async () => certs, Item: async () => cert };
    w.cadesplugin = { CreateObjectAsync: async (kind: string) => {
      if (kind === 'CAdESCOM.Store') return { Certificates: certs, Open: async () => {}, Close: async () => {} };
      if (kind === 'CADESCOM.CPAttribute') return { propset_Name: async () => {}, propset_Value: async () => {} };
      if (kind === 'CAdESCOM.CPSigner') return { propset_Certificate: async () => {}, propset_CheckCertificate: async () => {}, propset_Options: async () => {}, AuthenticatedAttributes2: { Add: async () => {} } };
      return { propset_ContentEncoding: async () => {}, propset_Content: async () => {}, SignCades: () => new Promise(resolve => { w.testSigningStarted = true; w.testReleaseSigning = () => { w.testSigningFinished = true; resolve('synthetic-signature'); }; }) };
    } };
  });
  await page.route('**/marking/honest-sign/auth/challenge', route => route.fulfill({ json: { uuid: 'test-challenge', data: 'test-data' } }));
  await page.route('**/marking/honest-sign/auth/sign-in', route => { submissions++; return route.fulfill({ json: {} }); });
  await login(page); await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click(); await page.getByRole('tab', { name: 'Честный знак', exact: true }).click();
  await page.getByRole('combobox', { name: 'Сертификат', exact: true }).selectOption('A'.repeat(40));
  await page.getByRole('button', { name: 'Войти по сертификату', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>).testSigningStarted)).toBe(true);
  await page.getByRole('combobox', { name: 'Компания', exact: true }).selectOption('22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
  await page.evaluate(() => ((window as unknown as Record<string, () => void>).testReleaseSigning)());
  await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>).testSigningFinished)).toBe(true);
  // Drain the continuation after the mock plugin resolves.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(submissions).toBe(0);
});

test('motor oil catalog prefills product and declaration permit using loaded category attributes', async ({ page }) => {
  await fixtures(page, false, { registrationNumber: 'ЕАЭС N TEST-123', adoptedAt: '2026-10-15', product: { name: 'Масло 5W-30', gtin: '05011846021161', tnVed: '2710198200' } });
  await page.route('**/marking/honest-sign/**', route => {
    const p = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ json: body });
    if (p.endsWith('/session')) return json({ isAuthenticated: true, hasHonestSignSession: true, certificateThumbprint: 'A'.repeat(40), honestSignSessionExpiresAtUtc: '2099-01-01T00:00:00Z' });
    if (p.endsWith('/participants/product-groups')) return json(['autofluids']);
    if (p.endsWith('/connectivity')) return json({ isAvailable: true });
    if (p.endsWith('/orders/search')) return json({ items: [], totalItems: 0 });
    if (p.endsWith('/catalog/submissions')) return json({ items: [], hasNextPage: false });
    if (p.endsWith('/categories')) return json([{ id: 100, name: 'Моторные масла', parentId: 0, level: 1, isActive: true }]);
    if (p.endsWith('/attributes')) return json([{ id: 23555, name: 'Декларация о соответствии', groupName: 'Разрешительные документы', fieldType: 'string', requirement: 'o', isMultiple: false, multiplicityType: null, presetOnly: false, options: [], valueTypes: [], dependencies: [], isFirstLayer: true, isSecondLayer: false, hasUnsupportedDictionary: false }]);
    return json({});
  });
  await login(page); await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click();
  await page.getByRole('combobox', { name: 'Декларация для товара' }).click(); await page.getByRole('option', { name: /CF-26-100/ }).click();
  await page.getByRole('tab', { name: 'Честный знак', exact: true }).click(); await page.getByRole('button', { name: 'Национальный каталог', exact: true }).click();
  await page.getByRole('button', { name: 'Подставить данные декларации' }).click();
  await expect(page.getByLabel('Полное наименование товара *', { exact: true })).toHaveValue('Масло 5W-30');
  await page.getByRole('button', { name: 'Подобрать категории' }).click();
  await page.getByRole('combobox', { name: 'Категория НК *', exact: true }).selectOption('100');
  await expect(page.getByRole('group', { name: 'Декларация о соответствии' })).toBeVisible();
  await page.getByRole('button', { name: 'Подставить данные декларации' }).click();
  await expect(page.locator('#catalog-attribute-23555-0')).toHaveValue('ЕАЭС N TEST-123');
  await expect(page.locator('#catalog-attribute-23555-0-date')).toHaveValue('2026-10-15');
  await expect(page.locator('#catalog-gtin')).toHaveValue('05011846021161');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'marking-catalog-declaration.png'), fullPage: true });
});
test('login screen and overview desktop rendering', async ({ page }) => {
  await fixtures(page); const screenshots = path.resolve('..', 'artifacts', 'screenshots'); fs.mkdirSync(screenshots, { recursive: true });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible();
  await page.screenshot({ path: path.join(screenshots, 'ui-login.png'), fullPage: true, animations: 'disabled' });
  await login(page); await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: path.join(screenshots, 'ui-overview.png'), fullPage: true, animations: 'disabled' });
  await page.reload(); await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
});
test('search, filtering and responsive registry', async ({ page }) => {
  await fixtures(page); await login(page); await page.getByRole('link', { name: 'Декларации', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск деклараций' }).fill('Одежда');
  await expect(page.getByRole('link', { name: 'Одежда второго слоя', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Мебель для офиса', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Поиск деклараций' }).fill('');
  await expect(page.getByRole('link', { name: 'Мебель для офиса', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Черновики', exact: true }).click();
  await expect(page.getByText('Черновик', { exact: true })).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'ui-mobile.png'), fullPage: true, animations: 'disabled' });
});
test('new declaration validates title and sends entered data', async ({ page }) => {
  const fixture = await fixtures(page); await login(page); await page.getByRole('link', { name: 'Новая декларация' }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByText('Укажите название документа')).toBeVisible();
  await page.getByLabel('Название декларации').fill('Проверка пользовательской формы');
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click(); await page.getByLabel('Наименование продукции', { exact: true }).fill('Упаковочная машина');
  await page.getByLabel('Код ТН ВЭД', { exact: true }).fill('8422400008');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByText('Декларация сохранена')).toBeVisible();
  expect(fixture.getSaved()?.title).toBe('Проверка пользовательской формы');
  expect(fixture.getSaved()?.product).toMatchObject({ name: 'Упаковочная машина', tnVed: '8422400008' });
});

const lookupCandidate = { name: 'ООО «Тестовый заявитель»', inn: '7707083893', ogrn: '1027700132195', kpp: '773601001', address: 'Москва, адрес из источника', type: 'LEGAL', branchType: 'MAIN', status: 'ACTIVE', managerName: 'Иванов Иван Иванович', managerPosition: 'Генеральный директор', dataInvalid: false, shortName: 'Тестовый заявитель', legalForm: 'Общество с ограниченной ответственностью', registrationDate: '2003-01-01', registrationAuthority: 'Тестовая налоговая инспекция', standardizedAddress: 'г Москва, тестовый адрес' };

async function identityLookup(page: Page, candidate = lookupCandidate, side = 0) {
  await page.route('**/organizations/lookup', route => route.fulfill({ json: { items: [candidate], retrievedAt: '2026-10-27T10:00:00Z', fromCache: false } }));
  await login(page); await page.getByRole('link', { name: 'Новая декларация' }).click(); await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).nth(side).click();
  const dialog = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData' });
  await dialog.getByLabel('ИНН или ОГРН / ОГРНИП').fill(candidate.inn || candidate.ogrn);
  await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  return dialog;
}

test('organization identity saves a new company without any overwrite warning', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true); const dialog = await identityLookup(page);
  await dialog.getByRole('button', { name: 'Сохранить в справочник и подставить' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' })).toBeHidden();
  expect(fixture.getOrganizations()).toHaveLength(1); expect(fixture.getOrganizations()[0]).toMatchObject({ inn: lookupCandidate.inn, kpp: lookupCandidate.kpp });
});

test('organization identity adds a new directory card after an INN-only lookup without overwrite warnings', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true);
  await page.route('**/organizations/lookup', route => route.fulfill({ json: { items: [lookupCandidate], retrievedAt: '2026-10-27T10:00:00Z', fromCache: false } }));
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить компанию' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая компания' });
  await editor.getByLabel('ИНН', { exact: true }).fill(lookupCandidate.inn);
  await editor.getByLabel('КПП', { exact: true }).fill(lookupCandidate.kpp);
  await editor.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).click();
  const lookup = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData' });
  await lookup.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await lookup.getByRole('button', { name: 'Подставить реквизиты', exact: true }).click();
  await expect(lookup).toBeHidden();
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: lookupCandidate.name })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Реквизиты формы будут заменены' })).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' })).toBeHidden();
  expect(fixture.getOrganizations()).toHaveLength(1);
});

test('organization identity keeps different KPP branches separate without overwrite confirmation', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true);
  fixture.seedOrganization({ ...lookupCandidate, name: 'Головная организация', phone: 'Ручной телефон' });
  const candidate = { ...lookupCandidate, name: 'Другой филиал', kpp: '540602001', branchType: 'BRANCH' };
  const dialog = await identityLookup(page, candidate);
  await dialog.getByRole('button', { name: 'Сохранить в справочник и подставить' }).click();
  await expect(dialog).toBeHidden(); expect(fixture.getOrganizations()).toHaveLength(2);
  expect(fixture.getOrganizations()[0]).toMatchObject({ name: 'Головная организация', phone: 'Ручной телефон', kpp: lookupCandidate.kpp });
  await expect(page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' })).toBeHidden();
});

for (const individual of [false, true]) {
  test(`organization identity confirms replacement only for an existing ${individual ? 'individual without KPP' : 'INN and KPP pair'}`, async ({ page }) => {
    const fixture = await fixtures(page, true, {}, 'Admin', true);
    const candidate = individual ? { ...lookupCandidate, inn: '500100732259', ogrn: '304500116000157', kpp: '', type: 'INDIVIDUAL' } : lookupCandidate;
    fixture.seedOrganization({ ...candidate, name: 'Существующая карточка', kind: 'Applicant', phone: 'Ручной телефон' });
    const dialog = await identityLookup(page, candidate, 1);
    const save = dialog.getByRole('button', { name: 'Сохранить в справочник и подставить' }); await save.click();
    const warning = page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' });
    await expect(warning).toContainText('Существующая карточка'); await expect(warning).toContainText(`ИНН ${candidate.inn}`);
    await expect(warning).toContainText(candidate.kpp ? `КПП ${candidate.kpp}` : 'КПП не указан');
    await warning.getByRole('button', { name: 'Отмена', exact: true }).click();
    expect(fixture.getOrganizations()[0].phone).toBe('Ручной телефон'); expect(fixture.getOrganizations()).toHaveLength(1);
    await save.click(); await warning.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await expect(dialog).toBeHidden(); expect(fixture.getOrganizations()).toHaveLength(1);
    expect(fixture.getOrganizations()[0]).toMatchObject({ id: '77777777-7777-4777-8777-000000000000', kind: 'Both', phone: '' });
  });
}

test('organization identity lookup failure does not blindly save and can be retried', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true); const dialog = await identityLookup(page); let failed = true;
  await page.route('**/organizations/match?*', route => failed ? route.fulfill({ status: 503, json: { detail: 'Проверка справочника недоступна' } }) : route.fallback());
  const save = dialog.getByRole('button', { name: 'Сохранить в справочник и подставить' }); await save.click();
  await expect(dialog.getByRole('alert')).toContainText('Проверка справочника недоступна'); expect(fixture.getOrganizations()).toHaveLength(0);
  failed = false; await save.click(); await expect(dialog).toBeHidden(); expect(fixture.getOrganizations()).toHaveLength(1);
});

test('organization identity handles a concurrent insert without silent replacement', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true); const dialog = await identityLookup(page); let concurrent = true;
  await page.route('**/organizations/match?*', async route => {
    if (!concurrent) return route.fallback(); concurrent = false;
    fixture.seedOrganization({ ...lookupCandidate, name: 'Создана в другой сессии', phone: 'Сохраняемый телефон' });
    await route.fulfill({ json: { organization: null } });
  });
  const save = dialog.getByRole('button', { name: 'Сохранить в справочник и подставить' }); await save.click();
  await expect(dialog.getByRole('alert')).toContainText('уже есть в справочнике');
  expect(fixture.getOrganizations()).toHaveLength(1); expect(fixture.getOrganizations()[0].phone).toBe('Сохраняемый телефон');
  await save.click(); const warning = page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' });
  await expect(warning).toContainText('Создана в другой сессии'); await warning.getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(fixture.getOrganizations()[0].phone).toBe('Сохраняемый телефон');
});

test('organization identity rejects manual duplicates and changing a branch into another existing pair', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true);
  fixture.seedOrganization({ ...lookupCandidate });
  fixture.seedOrganization({ ...lookupCandidate, id: '77777777-7777-4777-8777-000000000001', name: 'Другой филиал', kpp: '540602001' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить компанию' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая компания' });
  await editor.getByRole('textbox', { name: 'Полное наименование', exact: true }).fill('Новый дубль');
  await editor.getByLabel('ИНН', { exact: true }).fill(lookupCandidate.inn); await editor.getByLabel('КПП', { exact: true }).fill(lookupCandidate.kpp);
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor.getByRole('alert').last()).toContainText('уже есть в справочнике'); expect(fixture.getOrganizations()).toHaveLength(2);
  await editor.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByRole('button', { name: 'Редактировать Другой филиал', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Редактирование компании' }); await edit.getByLabel('КПП', { exact: true }).fill(lookupCandidate.kpp);
  await edit.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(edit.getByRole('alert').last()).toContainText('уже есть в справочнике'); expect(fixture.getOrganizations()[1].kpp).toBe('540602001');
});

test('organization identity applies a first lookup to an empty form without a replacement warning', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true); const dialog = await identityLookup(page);
  await dialog.getByRole('button', { name: 'Подставить реквизиты', exact: true }).click(); await expect(dialog).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Реквизиты формы будут заменены' })).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Полное наименование', exact: true }).first()).toHaveValue(lookupCandidate.name);
  expect(fixture.getOrganizations()).toHaveLength(0);
});

test('overwrite warning requires confirmation and remembers suppression only after acceptance for the current user', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true);
  const key = 'certflow.dadata-overwrite-warning.v1.33333333-3333-4333-8333-333333333333';
  await page.addInitScript(() => localStorage.setItem('certflow.dadata-overwrite-warning.v1.another-user', 'hidden'));
  fixture.seedOrganization({ ...lookupCandidate, country: 'Россия', phone: 'Ручной телефон', email: 'manual@example.com', registrationAuthority: 'Вручную', signatory: 'Подписант' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  const refresh = () => page.getByRole('button', { name: /^Обновить / }).click();
  const warning = page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' });
  await refresh(); await expect(warning).toBeVisible();
  await expect(warning.getByText(/Поля, которых нет в ответе DaData, будут очищены/)).toBeVisible();
  await expect(warning.getByText(/Ночное обновление сохраняет поля/)).toBeVisible();
  expect(fixture.getDirectoryRefreshes()).toBe(0);
  await warning.getByRole('checkbox', { name: 'Больше не показывать' }).check();
  await warning.getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  expect(fixture.getOrganizations()[0].phone).toBe('Ручной телефон'); expect(fixture.getDirectoryRefreshes()).toBe(0);
  await refresh(); await expect(warning.getByRole('checkbox', { name: 'Больше не показывать' })).not.toBeChecked();
  await warning.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect.poll(() => fixture.getDirectoryRefreshes()).toBe(1);
  expect(fixture.getOrganizations()[0]).toMatchObject({ phone: '', email: '', registrationAuthority: '', signatory: '' });
  await refresh(); await expect(warning).toBeVisible();
  await warning.getByRole('checkbox', { name: 'Больше не показывать' }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'dadata-overwrite-warning-mobile.png'), fullPage: true, animations: 'disabled' });
  await warning.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect.poll(() => fixture.getDirectoryRefreshes()).toBe(2);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('hidden');
  await page.reload(); await refresh();
  await expect.poll(() => fixture.getDirectoryRefreshes()).toBe(3); await expect(warning).toBeHidden();
});

test('ordinary manual edits save without a warning and only a forced refresh asks for overwrite confirmation', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Admin', true);
  fixture.seedOrganization({ ...lookupCandidate, country: 'Россия', phone: 'Старый телефон' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: `Редактировать ${lookupCandidate.name}`, exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Редактирование компании' });
  await editor.getByLabel('Телефон', { exact: true }).fill('+7 999 123-45-67');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const warning = page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' });
  await expect(editor).toBeHidden(); await expect(warning).toBeHidden();
  expect(fixture.getOrganizations()[0].phone).toBe('+7 999 123-45-67');
  await page.getByRole('button', { name: `Обновить ${lookupCandidate.name}`, exact: true }).click();
  await expect(warning).toBeVisible(); await warning.getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(fixture.getOrganizations()[0].phone).toBe('+7 999 123-45-67'); expect(fixture.getDirectoryRefreshes()).toBe(0);
});

test('lookup replacement waits for overwrite confirmation and cancellation preserves manual form values', async ({ page }) => {
  await fixtures(page, true, {}, 'Admin', true);
  await page.route('**/organizations/lookup', route => route.fulfill({ json: { items: [{ ...lookupCandidate, registrationAuthority: '' }], retrievedAt: '2026-10-21T10:00:00Z', fromCache: false } }));
  await login(page); await page.getByRole('link', { name: 'Новая декларация' }).click(); await page.getByRole('tab', { name: 'Участники' }).click();
  const authority = page.getByLabel('Регистрирующий орган', { exact: true }).first(); const phone = page.getByLabel('Телефон', { exact: true }).first();
  await authority.fill('Ручной орган'); await phone.fill('+7 999 111-22-33');
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).first().click();
  const lookup = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData' });
  await lookup.getByLabel('ИНН или ОГРН / ОГРНИП').fill(lookupCandidate.inn);
  await lookup.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await lookup.getByRole('button', { name: 'Подставить реквизиты', exact: true }).click();
  const warning = page.getByRole('dialog', { name: 'Реквизиты формы будут заменены' });
  await warning.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(authority).toHaveValue('Ручной орган'); await expect(phone).toHaveValue('+7 999 111-22-33');
  await lookup.getByRole('button', { name: 'Подставить реквизиты', exact: true }).click();
  await warning.getByRole('button', { name: 'Продолжить', exact: true }).click(); await expect(lookup).toBeHidden();
  await expect(authority).toHaveValue(''); await expect(phone).toHaveValue('');
});

test('manual phone and registration authority can be entered but are replaced by another empty lookup', async ({ page }) => {
  const fixture = await fixtures(page, true); let requests = 0;
  await page.route('**/organizations/lookup', route => { requests++; return route.fulfill({ json: { items: [{ ...lookupCandidate, registrationAuthority: '' }], retrievedAt: '2026-10-20T10:00:00Z', fromCache: false } }); });
  await login(page); await page.getByRole('link', { name: 'Новая декларация' }).click(); await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData' });
  await dialog.getByLabel('ИНН или ОГРН / ОГРНИП').fill(lookupCandidate.inn);
  await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await dialog.getByLabel('Телефон', { exact: true }).fill('+375 29 123-45-67');
  await dialog.getByLabel('Регистрирующий орган', { exact: true }).fill('Инспекция, указанная вручную');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'manual-organization-details.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Сохранить в справочник и подставить' }).click(); await expect(dialog).toBeHidden();
  expect(fixture.getOrganizations()[0]).toMatchObject({ phone: '+375 29 123-45-67', registrationAuthority: 'Инспекция, указанная вручную' });
  expect(fixture.getOrganizations()[0].manuallyEditedFields).toEqual(expect.arrayContaining(['phone', 'registrationAuthority']));
  await expect(page.getByLabel('Телефон', { exact: true }).first()).toHaveValue('+375 29 123-45-67');
  await expect(page.getByLabel('Регистрирующий орган', { exact: true }).first()).toHaveValue('Инспекция, указанная вручную');
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).first().click();
  await expect(dialog.getByLabel('Регистрирующий орган', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Телефон', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Подставить реквизиты', exact: true }).click();
  await expect(page.getByLabel('Регистрирующий орган', { exact: true }).first()).toHaveValue('');
  expect(requests).toBe(2);
});

test('directory lookup keeps source provenance while tracking manual additions made before and after applying it', async ({ page }) => {
  const fixture = await fixtures(page, true);
  fixture.seedOrganization({ ...lookupCandidate, country: 'Россия', name: 'Старая карточка' });
  await page.route('**/organizations/lookup', route => route.fulfill({ json: { items: [lookupCandidate], retrievedAt: '2026-10-21T10:00:00Z', fromCache: false } }));
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Редактировать Старая карточка', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Редактирование компании' });
  await editor.getByRole('button', { name: 'Найти по ИНН / ОГРН', exact: true }).click();
  const lookup = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData' });
  await lookup.getByLabel('Телефон', { exact: true }).fill('+7 999 333-44-55');
  await lookup.getByRole('button', { name: 'Подставить реквизиты', exact: true }).click(); await expect(lookup).toBeHidden();
  await editor.getByLabel('Электронная почта', { exact: true }).fill('manual-after-lookup@example.com');
  await editor.getByLabel('Дата регистрации организации', { exact: true }).fill('2005-01-02');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(editor).toBeHidden();
  const saved = fixture.getOrganizations()[0];
  expect(saved.replaceFromDaData).toBe(true);
  expect(saved.manuallyEditedFields).toEqual(expect.arrayContaining(['phone', 'email', 'registrationDate']));
  expect(saved.manuallyEditedFields).not.toContain('name'); expect(saved.manuallyEditedFields).not.toContain('address');
});

test('company details can be manually edited in the directory and reused after reload', async ({ page }) => {
  const fixture = await fixtures(page, true);
  fixture.seedOrganization({ ...lookupCandidate, country: 'Россия', phone: '', registrationAuthority: '' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: `Редактировать ${lookupCandidate.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Редактирование компании' });
  await dialog.getByRole('textbox', { name: 'Полное наименование', exact: true }).fill('Уточнённое название компании');
  await dialog.getByLabel('Телефон', { exact: true }).fill('+7 999 888-77-66');
  await dialog.getByLabel('Регистрирующий орган', { exact: true }).fill('Регистрирующий орган от пользователя');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Редактировать Уточнённое название компании', exact: true }).click();
  await expect(dialog.getByLabel('Телефон', { exact: true })).toHaveValue('+7 999 888-77-66');
  await expect(dialog.getByLabel('Регистрирующий орган', { exact: true })).toHaveValue('Регистрирующий орган от пользователя');
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByRole('link', { name: 'Обзор', exact: true }).click(); await page.getByRole('link', { name: 'Новая декларация' }).click();
  await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByRole('combobox', { name: 'Подставить из справочника' }).first().fill('Уточнённое название');
  await page.getByRole('option', { name: /Уточнённое название/ }).click();
  await expect(page.getByLabel('Телефон', { exact: true }).first()).toHaveValue('+7 999 888-77-66');
  await expect(page.getByLabel('Регистрирующий орган', { exact: true }).first()).toHaveValue('Регистрирующий орган от пользователя');
});

test('directory company deletion requires confirmation and updates saved lists', async ({ page }) => {
  const fixture = await fixtures(page, true);
  fixture.seedOrganization({ ...lookupCandidate, country: 'Россия' });
  fixture.seedOrganization({ id: '77777777-7777-4777-8777-000000000001', name: 'Компания, которую сохраняем' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: `Удалить ${lookupCandidate.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Удалить компанию?' });
  await expect(dialog).toContainText(lookupCandidate.name);
  await expect(dialog).toContainText('Реквизиты в ранее созданных декларациях сохранятся');
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(dialog).toBeHidden(); expect(fixture.getDirectoryDeletions()).toBe(0);
  await expect(page.getByRole('row').filter({ hasText: lookupCandidate.name })).toBeVisible();
  await page.getByRole('button', { name: `Удалить ${lookupCandidate.name}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: lookupCandidate.name })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Компания, которую сохраняем' })).toBeVisible();
  expect(fixture.getDirectoryDeletions()).toBe(1); expect(fixture.getOrganizations()).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: lookupCandidate.name })).toHaveCount(0);
  await page.getByRole('button', { name: 'Создать декларацию', exact: true }).click();
  await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByRole('combobox', { name: 'Подставить из справочника' }).first().fill(lookupCandidate.name);
  await expect(page.getByRole('option', { name: /Тестовый заявитель/ })).toHaveCount(0);
});

test('directory company deletion shows errors and prevents repeated submissions while retrying', async ({ page }) => {
  const fixture = await fixtures(page, true); fixture.seedOrganization({ ...lookupCandidate, country: 'Россия' });
  fixture.failDirectoryDeletion(true);
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: `Удалить ${lookupCandidate.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Удалить компанию?' });
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Не удалось удалить компанию');
  expect(fixture.getOrganizations()).toHaveLength(1); expect(fixture.getDirectoryDeletions()).toBe(1);
  fixture.failDirectoryDeletion(false);
  let releaseDelete!: () => void;
  const held = new Promise<void>(resolve => { releaseDelete = resolve; });
  await page.route('**/organizations/*', async route => {
    if (route.request().method() === 'DELETE') await held;
    await route.fallback();
  });
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  try {
    await expect(dialog.getByRole('button', { name: 'Удаляем…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled();
  } finally { releaseDelete(); }
  await expect(dialog).toBeHidden(); await expect(page.getByText('Компании не найдены', { exact: true })).toBeVisible();
  expect(fixture.getDirectoryDeletions()).toBe(2);
});

test('directory company deletion is scoped to the selected firm and works for a manager on mobile', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Manager');
  fixture.seedOrganization({ name: 'Компания первого пространства' });
  fixture.seedOrganization({ id: '77777777-7777-4777-8777-000000000001', firmId: '22222222-2222-4222-8222-222222222222', name: 'Компания второго пространства' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить Компания первого пространства', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Удалить компанию?' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Компания', exact: true }).selectOption('22222222-2222-4222-8222-222222222222');
  await expect(dialog).toBeHidden(); expect(fixture.getDirectoryDeletions()).toBe(0);
  await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
  await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Удалить Компания второго пространства', exact: true }).click();
  await expect(dialog).toContainText('Компания второго пространства');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'directory-delete-mobile.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(page.getByText('Компании не найдены', { exact: true })).toBeVisible();
  expect(fixture.getOrganizations().map(org => org.name)).toEqual(['Компания первого пространства']);
});

test('DaData result can be saved directly to the directory and reused by name INN and KPP without another lookup', async ({ page }) => {
  const fixture = await fixtures(page, true); let requests = 0;
  await page.route('**/organizations/lookup', route => { requests++; return route.fulfill({ json: { items: [lookupCandidate], retrievedAt: '2026-10-20T10:00:00Z', fromCache: false } }); });
  await login(page); await page.getByRole('link', { name: 'Новая декларация' }).click();
  await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByLabel('Телефон', { exact: true }).first().fill('+7 999 1234567');
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData' });
  await dialog.getByLabel('ИНН или ОГРН / ОГРНИП').fill(lookupCandidate.inn);
  await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Подставить руководителя как подписанта' }).check();
  await dialog.getByLabel('Телефон', { exact: true }).fill('+7 999 1234567');
  await dialog.getByRole('button', { name: 'Сохранить в справочник и подставить' }).click();
  await expect(dialog).toBeHidden();
  expect(fixture.getOrganizations()).toHaveLength(1);
  expect(fixture.getOrganizations()[0]).toMatchObject({ inn: lookupCandidate.inn, kpp: lookupCandidate.kpp, autoRefresh: true, signatory: lookupCandidate.managerName, phone: '+7 999 1234567' });
  await page.reload(); await page.getByRole('tab', { name: 'Участники' }).click();
  const selector = page.getByRole('combobox', { name: 'Подставить из справочника' }).first();
  for (const search of ['Тестовый заявитель', lookupCandidate.inn, lookupCandidate.kpp]) {
    await selector.fill(search);
    await page.getByRole('option', { name: /Тестовый заявитель/ }).click();
    await expect(page.getByRole('textbox', { name: 'Полное наименование', exact: true }).first()).toHaveValue(lookupCandidate.name);
  }
  await expect(page.getByLabel('Телефон', { exact: true }).first()).toHaveValue('+7 999 1234567');
  expect(requests).toBe(1);
  await page.getByRole('combobox', { name: 'Компания', exact: true }).selectOption('22222222-2222-4222-8222-222222222222');
  await page.getByRole('link', { name: 'Новая декларация' }).click(); await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByRole('combobox', { name: 'Подставить из справочника' }).first().fill(lookupCandidate.inn);
  await expect(page.getByRole('option', { name: /Тестовый заявитель/ })).toHaveCount(0);
});

test('directory shows nightly schedule replaces manual contacts and reports failed refreshes', async ({ page }) => {
  const fixture = await fixtures(page, true);
  fixture.seedOrganization({ ...lookupCandidate, country: 'Россия', email: 'saved@example.com', signatory: 'Мой подписант' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await expect(page.getByText(/ежедневно в 03:00 \(Europe\/Minsk\)/)).toBeVisible();
  await page.getByRole('button', { name: `Обновить ${lookupCandidate.name}`, exact: true }).click();
  await expect(page.getByText('Обновлённая компания', { exact: true })).toBeVisible();
  await expect(page.getByText(/Обновлено/)).toBeVisible();
  expect(fixture.getOrganizations()[0]).toMatchObject({ email: '', signatory: '' });
  fixture.failDirectory(true);
  await page.getByRole('button', { name: 'Обновить Обновлённая компания', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Обновлённая компания' }).getByRole('alert')).toContainText('DaData недоступна');
  await page.getByRole('button', { name: 'Редактировать Обновлённая компания' }).click();
  await page.getByRole('checkbox', { name: /Автоматически обновлять реквизиты из DaData/ }).uncheck();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Автообновление выключено')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('certflow.theme', 'dark'));
  await page.reload(); await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Обновить Обновлённая компания', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'directory-refresh-mobile.png'), fullPage: true, animations: 'disabled' });
});

test('viewer can read directory freshness but cannot refresh or save companies', async ({ page }) => {
  const fixture = await fixtures(page, true, {}, 'Viewer'); fixture.seedOrganization({ ...lookupCandidate, country: 'Россия', registryCheckedAt: '2026-10-20T10:00:00Z', registryStatus: 'ACTIVE' });
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await expect(page.getByText('Действующая', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Обновить / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Добавить компанию' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Удалить / })).toHaveCount(0);
});

test('DaData directory preview selects branch and replaces prior contacts after explicit apply', async ({ page }) => {
  await fixtures(page, true); await login(page);
  let requests = 0; let saved: Record<string, unknown> | null = null;
  await page.route('**/organizations/lookup', route => { requests++; return route.fulfill({ json: { items: [lookupCandidate, { ...lookupCandidate, name: 'Филиал тестового заявителя', kpp: '540602001', branchType: 'BRANCH' }], retrievedAt: '2026-10-20T10:00:00Z', fromCache: false } }); });
  await page.route('**/organizations/', async route => {
    if (route.request().method() === 'POST') { saved = route.request().postDataJSON(); return route.fulfill({ json: { ...saved, id: '99999999-9999-4999-8999-999999999999' } }); }
    return route.fulfill({ json: [] });
  });
  await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить компанию' }).click();
  await page.getByRole('textbox', { name: 'Полное наименование', exact: true }).fill('Введено вручную');
  await page.getByLabel('Электронная почта', { exact: true }).fill('office@example.com');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 000 000-00-00');
  await page.getByLabel('ФИО подписанта', { exact: true }).fill('Уполномоченный сотрудник');
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).click();
  const dialog = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData', exact: true });
  await dialog.getByLabel('ИНН или ОГРН / ОГРНИП').fill('123');
  await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await expect(dialog.getByText('Введите ИНН из 10 или 12 цифр либо ОГРН / ОГРНИП из 13 или 15 цифр.')).toBeVisible();
  expect(requests).toBe(0);
  await dialog.getByLabel('ИНН или ОГРН / ОГРНИП').fill('7707083893');
  await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Подставить реквизиты' })).toBeDisabled();
  await dialog.getByRole('radio', { name: /Филиал тестового заявителя/ }).check();
  await expect(dialog.getByText('Проверьте найденные реквизиты')).toBeVisible();
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'dadata-preview-desktop.png') });
  expect(saved).toBeNull();
  await dialog.getByRole('button', { name: 'Подставить реквизиты' }).click();
  await expect(page.getByRole('textbox', { name: 'Полное наименование', exact: true })).toHaveValue('Филиал тестового заявителя');
  await expect(page.getByLabel('КПП', { exact: true })).toHaveValue('540602001');
  await expect(page.getByLabel('Электронная почта', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('ФИО подписанта', { exact: true })).toHaveValue('');
  expect(saved).toBeNull();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Запись сохранена')).toBeVisible();
  expect(saved).toMatchObject({ name: 'Филиал тестового заявителя', kpp: '540602001', phone: '', signatory: '' });
});

test('DaData declaration lookup handles empty and failed responses and requires explicit manager selection', async ({ page }) => {
  const fixture = await fixtures(page, true); await login(page);
  let mode: 'empty' | 'error' | 'success' = 'empty';
  await page.route('**/organizations/lookup', route => mode === 'error'
    ? route.fulfill({ status: 503, json: { detail: 'Достигнут лимит запросов DaData.' } })
    : route.fulfill({ json: { items: mode === 'empty' ? [] : [lookupCandidate], retrievedAt: '2026-10-20T10:00:00Z', fromCache: false } }));
  await page.getByRole('link', { name: 'Новая декларация' }).click();
  await page.getByLabel('Название декларации').fill('Автозаполнение заявителя');
  await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByLabel('ИНН', { exact: true }).first().fill('7707083893');
  await page.getByLabel('ФИО подписанта', { exact: true }).fill('Старый подписант');
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData', exact: true });
  await expect(dialog.getByLabel('ИНН или ОГРН / ОГРНИП')).toHaveValue('7707083893');
  await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await expect(dialog.getByText(/Организация не найдена/)).toBeVisible();
  mode = 'error'; await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await expect(dialog.getByText('Достигнут лимит запросов DaData.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Подставить реквизиты' })).toBeDisabled();
  mode = 'success'; await dialog.getByRole('button', { name: 'Найти организацию', exact: true }).click();
  await expect(dialog.getByText(lookupCandidate.name, { exact: true })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Подставить руководителя как подписанта' })).not.toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Подставить руководителя как подписанта' }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'dadata-preview-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Подставить реквизиты' }).click();
  await expect(page.getByLabel('ФИО подписанта', { exact: true })).toHaveValue(lookupCandidate.managerName);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Декларация сохранена')).toBeVisible();
  expect(fixture.getSaved()?.applicant).toMatchObject({ name: lookupCandidate.name, inn: lookupCandidate.inn, signatory: lookupCandidate.managerName });
});

test('personal DaData key can be configured in account and used to fill OGRN requisites like the video', async ({ page }) => {
  const fixture = await fixtures(page); await login(page);
  let requestedIdentifier = '';
  await page.route('**/organizations/lookup', route => {
    requestedIdentifier = route.request().postDataJSON().query;
    return route.fulfill({ json: { items: [lookupCandidate], retrievedAt: '2026-10-20T10:00:00Z', fromCache: false } });
  });
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('API-ключ DaData', { exact: true }).fill('ui-test-personal-key-0123456789');
  await page.getByRole('button', { name: 'Сохранить и проверить', exact: true }).click();
  await expect(page.getByText('Доступ подтверждён', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Новый API-ключ DaData')).toHaveValue('');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'dadata-personal-account.png'), animations: 'disabled' });
  await page.getByRole('link', { name: 'Перейти к новой декларации', exact: true }).click();
  await page.getByLabel('Название декларации').fill('Подстановка по ОГРН');
  await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByLabel('ОГРН / ОГРНИП', { exact: true }).first().fill('1027700132195');
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData', exact: true });
  await expect(dialog.getByText(lookupCandidate.name, { exact: true })).toBeVisible();
  expect(requestedIdentifier).toBe('1027700132195');
  await dialog.getByRole('checkbox', { name: 'Подставить руководителя как подписанта' }).check();
  await dialog.getByRole('checkbox', { name: 'Использовать адрес, приведённый DaData к стандартному виду' }).check();
  await dialog.getByRole('button', { name: 'Подставить реквизиты' }).click();
  await expect(page.getByLabel('ИНН', { exact: true }).first()).toHaveValue(lookupCandidate.inn);
  await expect(page.getByLabel('КПП', { exact: true }).first()).toHaveValue(lookupCandidate.kpp);
  await expect(page.getByLabel('Дата регистрации организации', { exact: true }).first()).toHaveValue('2003-01-01');
  await expect(page.getByLabel('Сокращённое наименование', { exact: true }).first()).toHaveValue(lookupCandidate.shortName);
  await expect(page.getByLabel('Регистрирующий орган', { exact: true }).first()).toHaveValue(lookupCandidate.registrationAuthority);
  await expect(page.getByLabel('Адрес', { exact: true }).first()).toHaveValue(lookupCandidate.standardizedAddress);
  await page.getByLabel('Адрес', { exact: true }).first().fill('Адрес, исправленный вручную');
  await page.getByLabel('Электронная почта', { exact: true }).first().fill('manual@example.com');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Декларация сохранена')).toBeVisible();
  expect(fixture.getSaved()?.applicant).toMatchObject({ registrationDate: '2003-01-01', managerName: lookupCandidate.managerName, signatory: lookupCandidate.managerName, address: 'Адрес, исправленный вручную', email: 'manual@example.com' });
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить личный ключ', exact: true }).click();
  await expect(page.getByText('Ключ не добавлен', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByLabel('API-ключ DaData', { exact: true })).toHaveValue('');
});

test('theme selection persists, follows the system and applies to forms on mobile', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await fixtures(page); await login(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'redesign-overview-dark.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await page.getByRole('tab', { name: 'Оформление', exact: true }).click();
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'redesign-appearance-dark.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /Как в системе/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /^Светлая/ }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('link', { name: 'Обзор', exact: true }).click();
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'redesign-overview-light.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.getByLabel('API-ключ DaData', { exact: true })).toBeVisible();
  const background = await page.getByLabel('API-ключ DaData', { exact: true }).evaluate(element => getComputedStyle(element.parentElement!).backgroundColor);
  expect(background).toBe('rgb(32, 35, 45)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'redesign-settings-mobile-dark.png'), fullPage: true, animations: 'disabled' });
});

test('development information is in the plan and old integration links lead to settings', async ({ page }) => {
  await fixtures(page); await login(page);
  await page.getByRole('link', { name: 'План разработки', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'План разработки', exact: true })).toBeVisible();
  await expect(page.getByLabel('API-ключ DaData', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Развернуть все' }).click();
  await expect(page.getByText('Зачем вам это нужно', { exact: true })).toHaveCount(8);
  await page.getByRole('button', { name: 'Свернуть все' }).click();
  await page.getByRole('group', { name: 'Направления разработки' }).getByRole('button', { name: 'ЧЗ и Наша марка', exact: true }).click();
  await expect(page.locator('.integration-guide')).toHaveCount(3);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'redesign-development-plan.png'), fullPage: true, animations: 'disabled' });
  await page.goto('/#/integrations');
  await expect(page.getByRole('tab', { name: 'Интеграции', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Зачем вам это нужно', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'О модуле', exact: true }).nth(1).click();
  await expect(page.locator('#integration-marking')).toHaveClass(/Mui-expanded/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('connection is successful only after verification and loses success after a failed recheck', async ({ page }) => {
  const fixture = await fixtures(page); await login(page);
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Успешные подключения' });
  await expect(summary.getByText('0 подключено', { exact: true })).toBeVisible();
  fixture.failCheck(true);
  await page.getByLabel('API-ключ DaData', { exact: true }).fill('ui-fixture-key-0123456789');
  await page.getByRole('button', { name: 'Сохранить и проверить' }).click();
  await expect(page.getByText('Личный ключ сохранён', { exact: true })).toBeVisible();
  await expect(summary.getByText('0 подключено', { exact: true })).toBeVisible();
  fixture.failCheck(false);
  await page.getByRole('button', { name: 'Проверить сохранённый ключ' }).click();
  await expect(summary.getByText('1 подключено', { exact: true })).toBeVisible();
  await page.reload(); await expect(summary.getByText('1 подключено', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'redesign-connections-verified-fixture.png'), fullPage: true, animations: 'disabled' });
  fixture.failCheck(true);
  await page.getByRole('button', { name: 'Проверить сохранённый ключ' }).click();
  await expect(page.getByText('DaData отклонила доступ. Проверьте API-ключ.', { exact: true })).toBeVisible();
  await expect(summary.getByText('0 подключено', { exact: true })).toBeVisible();
  await page.reload(); await expect(summary.getByText('0 подключено', { exact: true })).toBeVisible();
});

test('all color themes support both modes with readable tokens and persistent selection', async ({ page }) => {
  await fixtures(page); await login(page);
  await page.goto('/#/settings?tab=appearance');
  const palettes = [['sapphire', 'Сапфир'], ['ocean', 'Океан'], ['sage', 'Шалфей'], ['sandstone', 'Песчаник'], ['graphite', 'Графит'], ['dragonfly', 'Стрекозы']] as const;
  for (const mode of ['light', 'dark'] as const) {
    await page.getByRole('group', { name: 'Режим интерфейса' }).getByRole('button', { name: mode === 'light' ? /^Светлая/ : /^Тёмная/ }).click();
    for (const [id, title] of palettes) {
      const option = page.getByRole('button', { name: `Тема ${title}`, exact: true });
      await option.click();
      await expect(option).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-color-theme', id);
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      const contrast = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        const rgb = (name: string) => {
          const hex = styles.getPropertyValue(name).trim().slice(1, 7);
          return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        };
        const ratio = (text: string, background: string) => { const a = rgb(text), b = rgb(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
        return [ratio('--text', '--canvas'), ratio('--muted', '--surface'), ratio('--faint', '--surface'), ratio('--accent', '--surface'), ratio('--on-accent', '--accent'), ratio('--sidebar-muted', '--sidebar'), ratio('--sidebar-text', '--sidebar')];
      });
      for (const ratio of contrast) expect(ratio, `${title} / ${mode}: text contrast`).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'dragonfly');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'design-themes-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Тема Океан', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'design-themes-mobile.png'), fullPage: true, animations: 'disabled' });
});

test('color theme menu is keyboard accessible, syncs tabs and preserves the mode', async ({ page, context }) => {
  await fixtures(page); await login(page);
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  const other = await context.newPage();
  await fixtures(other); await login(other);
  const picker = page.getByRole('button', { name: 'Выбрать цветовую тему' });
  await picker.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: 'Цветовая тема' })).toBeVisible();
  await page.getByRole('menuitemradio', { name: 'Шалфей' }).focus(); await page.keyboard.press('Enter');
  await expect(picker).toBeFocused();
  for (const tab of [page, other]) {
    await expect(tab.locator('html')).toHaveAttribute('data-color-theme', 'sage');
    await expect(tab.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  await other.close();
});

test('personal palettes reach marking components and their dialog portals', async ({ page }) => {
  await fixtures(page); await login(page);
  await page.getByRole('button', { name: 'Выбрать цветовую тему' }).click();
  await page.getByRole('menuitemradio', { name: 'Океан' }).click();
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await page.goto('/#/marking?tab=dmkod');
  const integration = page.locator('[data-integration="dmkod"]').first();
  await expect(integration).toBeVisible();
  expect(await integration.evaluate(element => getComputedStyle(element).getPropertyValue('--primary').trim())).toBe('#77d5e3');
  const portal = page.locator('#marking-portals');
  expect(await portal.evaluate(element => getComputedStyle(element).getPropertyValue('--primary').trim())).toBe('#77d5e3');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'design-marking-ocean-dark.png'), fullPage: true, animations: 'disabled' });
});

test('theme defaults recover from corrupt storage and remain usable when saving is denied', async ({ page }) => {
  await fixtures(page);
  await page.addInitScript(() => { localStorage.setItem('certflow.color-theme', 'invalid-palette'); localStorage.setItem('certflow.theme', 'invalid-mode'); });
  await page.emulateMedia({ colorScheme: 'dark' }); await login(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'sapphire');
  await page.goto('/#/settings?tab=appearance');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage disabled', 'SecurityError'); }; });
  await page.getByRole('button', { name: 'Тема Песчаник', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'sandstone');
  await expect(page.getByText('Браузер не разрешил сохранить оформление.', { exact: false })).toBeVisible();
});

test('mobile document cards, navigation and reduced motion remain usable at 320px', async ({ page }) => {
  await fixtures(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Логин', exact: true })).toBeVisible();
  await expect(page.locator('.login-dragonfly')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'login').toBe(true);
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'design-login-mobile.png'), fullPage: true, animations: 'disabled' });
  await login(page);
  for (const route of ['/', '/declarations', '/declarations/new', '/settings?tab=appearance', '/directories', '/development-plan']) {
    await page.goto(`/#${route}`);
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
  }
  await page.goto('/#/declarations');
  await expect(page.getByRole('link', { name: 'Оборудование для упаковки', exact: true })).toBeVisible();
  await page.getByLabel('Выбрать все на странице', { exact: true }).check();
  await expect(page.getByText('Выбрано: 6', { exact: true })).toBeVisible();
  await page.getByLabel('Выбрать все на странице', { exact: true }).uncheck();
  expect(await page.locator('.document-table .MuiChip-label').evaluateAll(labels => labels.every(label => label.scrollWidth <= label.clientWidth)), 'mobile statuses are fully readable').toBe(true);
  const registryUrl = page.url();
  await page.getByRole('link', { name: 'К содержимому' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(page.url()).toBe(registryUrl);
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  const drawer = page.locator('#mobile-navigation');
  await expect(drawer.getByRole('navigation', { name: 'Основное меню' })).toBeVisible();
  await drawer.getByRole('link', { name: 'Обзор', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toHaveAttribute('aria-expanded', 'false');
  const transform = await page.locator('.stat-card').first().evaluate(element => getComputedStyle(element).transform);
  expect(transform).toBe('none');
  await page.goto('/#/declarations');
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'design-registry-320.png'), fullPage: true, animations: 'disabled' });
});

test.describe('touch phones and the dragonfly theme', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('dragonflies are optional, support both modes and keep phone controls readable', async ({ page }) => {
    await fixtures(page);
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Логин', exact: true })).toBeVisible();
    await expect(page.locator('.login-main img')).toHaveCount(0);
    expect(await page.getByLabel('Логин', { exact: true }).evaluate(input => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
    await page.getByRole('button', { name: 'Выбрать цветовую тему' }).tap();
    await page.getByRole('menuitemradio', { name: 'Стрекозы' }).tap();
    await login(page);
    await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'dragonfly');
    for (const mode of ['light', 'dark'] as const) {
      if (mode === 'dark') await page.getByRole('button', { name: 'Включить тёмную тему' }).tap();
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      expect(await page.locator('.workspace').evaluate(element => getComputedStyle(element, '::before').maskImage)).toContain('dragonfly.svg');
      for (const route of ['/', '/declarations', '/declarations/new', '/directories', '/settings?tab=appearance', '/catalog', '/marking?tab=dmkod']) {
        await page.goto(`/#${route}`);
        await expect(page.locator('main h1').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} / ${mode}`).toBe(true);
      }
      await page.goto('/#/declarations');
      await expect(page.getByRole('link', { name: 'Оборудование для упаковки', exact: true })).toBeVisible();
      await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', `dragonflies-phone-${mode}.png`), fullPage: true, animations: 'disabled' });
    }
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'dragonfly');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Открыть меню' }).tap();
    await page.locator('#mobile-navigation').getByRole('link', { name: 'Обзор', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
    await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'dragonflies-overview-dark.png'), fullPage: true, animations: 'disabled' });
  });

  test('login opens without a forced keyboard and fits narrow and landscape phones', async ({ page }) => {
    await fixtures(page); await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Логин', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Логин', exact: true })).not.toBeFocused();
    for (const viewport of [{ width: 320, height: 740 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.login-story')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Войти в CertFlow' })).toBeVisible();
    }
  });
});

test.describe('responsive layout', () => {
  test.use({ hasTouch: true });

  test('pages fit phones, tablets and desktop with long names and populated data', async ({ page }) => {
    test.setTimeout(150000);
    const displayName = 'Александр Александрович — специалист по международной сертификации';
    const fixture = await fixtures(page, false, {}, 'Admin', false, { displayName, firmName: 'Международная компания по сертификации и испытаниям оборудования' });
    fixture.seedOrganization({ name: 'ОрганизацияСОченьДлиннымНаименованием'.repeat(3), address: 'Республика Беларусь, Минск, улица Испытательная, административный корпус 14', country: 'Беларусь', inn: '7707083893' });
    const longName = 'ИспытательнаяЛабораторияСпециальногоОборудования'.repeat(2);
    await page.route(/\/api\/firms\/[^/]+\/laboratories\/?$/, route => route.fulfill({ json: [{ id: '88888888-8888-4888-8888-888888888888', name: longName, accreditationNumber: 'RA.RU.21.АБ12345678901234567890', address: 'Минск, испытательный центр оборудования и промышленной продукции, корпус 22', details: { type: 'Accredited', country: 'Беларусь' } }] }));
    await page.route(/\/api\/firms\/[^/]+\/team\/?$/, route => route.fulfill({ json: [{ id: '99999999-9999-4999-8999-999999999999', displayName, userName: 'certification.specialist.with.a.long.login', email: 'international.certification.department.long.address@example.com', role: 'Admin' }] }));
    await login(page, displayName);
    const failures: unknown[] = [];
    for (const width of [320, 390, 600, 768, 950, 1024, 1440]) {
      await page.setViewportSize({ width, height: width <= 600 ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: width === 390 || width === 768 || width === 1024 ? 'dark' : 'light' });
      for (const route of ['/', '/declarations', '/declarations/new', '/declarations/44444444-4444-4444-8444-000000000000', '/directories', '/team', '/settings', '/settings?tab=appearance', '/settings?tab=profile', '/development-plan', '/catalog', '/marking?tab=chz', '/marking?tab=dmkod', '/marking?tab=documents']) {
        await page.goto(`/#${route}`);
        await expect(page.locator('main h1').first()).toBeVisible();
        await expect(page.locator('main .MuiCircularProgress-root')).toHaveCount(0);
        const overflow = await page.evaluate(() => {
          if (document.documentElement.scrollWidth <= innerWidth) return null;
          return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('main *, header *')].filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1); }).slice(0, 6).map(element => ({ tag: element.tagName, class: element.getAttribute('class')?.slice(0, 100), text: element.textContent?.slice(0, 60) })) };
        });
        if (overflow) failures.push({ route, ...overflow });
      }
      await page.goto('/#/directories');
      await page.getByRole('tab', { name: /Лаборатории/ }).click();
      await expect(page.getByRole('table', { name: 'Справочник лабораторий' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `laboratories / ${width}`).toBe(true);
      await page.getByRole('tab', { name: 'Архив компаний' }).click();
      await expect(page.getByRole('tab', { name: 'Архив компаний' })).toHaveAttribute('aria-selected', 'true');
    }
    expect(failures).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/team');
    await expect(page.getByRole('table', { name: 'Участники команды' })).toBeVisible();
    await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', 'responsive-team-phone.png'), fullPage: true, animations: 'disabled' });
  });

  test('phone dialogs keep their actions visible when long forms scroll', async ({ page }) => {
    test.setTimeout(60000);
    await fixtures(page); await login(page);
    for (const viewport of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/#/directories');
      await page.getByRole('button', { name: 'Добавить компанию', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Новая компания', exact: true });
      await expect(dialog).toBeVisible();
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      await expect(dialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeInViewport({ ratio: 1 });
      await dialog.getByLabel('Должность руководителя', { exact: true }).scrollIntoViewIfNeeded();
      expect(await dialog.locator('.MuiDialogContent-root').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expect(dialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeInViewport({ ratio: 1 });
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: path.resolve('..', 'artifacts', 'screenshots', `responsive-company-dialog-${viewport.width}.png`), animations: 'disabled' });
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
      await expect(dialog).toBeHidden();
      await page.goto('/#/team');
      await page.getByRole('button', { name: 'Добавить участника', exact: true }).click();
      const teamDialog = page.getByRole('dialog', { name: 'Новый участник', exact: true });
      await expect(teamDialog.getByRole('button', { name: 'Добавить участника', exact: true })).toBeInViewport({ ratio: 1 });
      await teamDialog.getByLabel(/Начальный пароль/).scrollIntoViewIfNeeded();
      await expect(teamDialog.getByRole('button', { name: 'Добавить участника', exact: true })).toBeInViewport({ ratio: 1 });
      await teamDialog.getByRole('button', { name: 'Отмена', exact: true }).click();
    }
  });
});
