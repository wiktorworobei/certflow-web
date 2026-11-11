import { useState } from 'react';
import { Alert, Box, Button, Chip, FormControlLabel, MenuItem, Pagination, Radio, RadioGroup, TextField, Typography } from '@mui/material';
import { ArrowForwardRounded, CloudDownloadOutlined, DescriptionOutlined, RefreshRounded, SearchRounded } from '@mui/icons-material';
import { EmptyState, ErrorState, Loading, Section } from './common';
import { dateTime, errorMessage } from './types';
import { downloadRegistryFile, marketplaceApi, type RegistryExport, type RegistryQuery, type RegistrySection } from './marketplaceApi';
import { registrySections, RegistryResult } from './RegistryVerification';

const message = (e: unknown) => e instanceof Error ? e.message : errorMessage(e);
const registryName = (key: string) => registrySections.find(([id]) => id === key.toLowerCase())?.[1] ?? key;
const statusNames: Record<string, string> = { PENDING: 'Ожидает обработки', RUNNING: 'Обрабатывается', SUCCESS: 'Готово', FAILED: 'Ошибка обработки' };

export function RegistryLookup({ firmId }: { firmId: string }) {
  const [section, setSection] = useState<RegistrySection>('rds'); const [number, setNumber] = useState('');
  const [date, setDate] = useState(''); const [inn, setInn] = useState('');
  const [lookup, state] = marketplaceApi.useRegistryLookupMutation();
  return <Section title="Найти документ в реестре" subtitle="Укажите регистрационный номер сертификата или декларации. Дата и ИНН помогут уточнить поиск, если найдено несколько совпадений.">
    <Box component="form" onSubmit={e => { e.preventDefault(); void lookup({ firmId, section, query: { numberDoc: number.trim(), regDate: date || undefined, applicantInn: section === 'reaeu' ? undefined : inn || undefined } }); }}>
      <div className="registry-input-grid">
        <TextField select label="Реестр документа" value={section} onChange={e => { setSection(e.target.value as RegistrySection); state.reset(); }}>{registrySections.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}</TextField>
        <TextField required label="Номер документа в реестре" value={number} onChange={e => { setNumber(e.target.value); state.reset(); }} inputProps={{ maxLength: 500 }} className="registry-input-wide"/>
        <TextField label="Дата регистрации (необязательно)" type="date" value={date} onChange={e => { setDate(e.target.value); state.reset(); }} InputLabelProps={{ shrink: true }}/>
        {section !== 'reaeu' && <TextField label="ИНН заявителя (необязательно)" value={inn} onChange={e => { setInn(e.target.value); state.reset(); }} inputProps={{ maxLength: 12, inputMode: 'numeric' }}/>}
      </div>
      <div className="registry-form-actions"><Button type="submit" variant="contained" startIcon={<SearchRounded/>} disabled={state.isLoading || !number.trim()}>{state.isLoading ? 'Проверяем…' : 'Найти в реестре'}</Button><span>Ответ появится здесь. Исходная декларация сохраняется отдельно.</span></div>
      {state.error && <Alert severity="error">{message(state.error)}</Alert>}
      {state.data && <RegistryResult result={state.data}/>}
    </Box>
  </Section>;
}

export function RegistryBatch({ firmId, onCreated }: { firmId: string; onCreated: (requestId: string) => void }) {
  const [section, setSection] = useState<RegistrySection>('rds'); const [kind, setKind] = useState('find-doc');
  const [scope, setScope] = useState('list'); const [input, setInput] = useState(''); const [days, setDays] = useState(1); const [error, setError] = useState('');
  const [find, findState] = marketplaceApi.useRegistryFindMutation(); const [check, checkState] = marketplaceApi.useRegistryCheckStatusesMutation();
  const lines = input.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  async function submit() {
    setError('');
    try {
      const subscription = kind === 'check-status' && scope === 'subscription';
      if (!subscription && (lines.length < 1 || lines.length > 100000)) throw new Error('Укажите от 1 до 100 000 документов, по одному в строке.');
      let receipt: { requestId: string };
      if (kind === 'find-doc') {
        const items: RegistryQuery[] = lines.map((line, index) => {
          const parts = line.split('|').map(x => x.trim()); const date = parts[1];
          if (!parts[0] || parts.length > (section === 'reaeu' ? 2 : 3) || date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error(`Строка ${index + 1}: используйте формат «номер | дата YYYY-MM-DD${section === 'reaeu' ? '' : ' | ИНН'}». Дата и ИНН необязательны.`);
          return { numberDoc: parts[0], regDate: date || undefined, applicantInn: parts[2] || undefined };
        });
        receipt = await find({ firmId, section, items }).unwrap();
      } else {
        if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('Выберите период от 1 до 14 дней.');
        const documentIds = subscription ? undefined : section === 'reaeu' ? lines : lines.map((id, index) => { if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new Error(`Строка ${index + 1}: укажите числовой ID документа из реестра РФ.`); return Number(id); });
        receipt = await check({ firmId, section, daysBack: days, documentIds }).unwrap();
      }
      onCreated(receipt.requestId);
    } catch (e) { setError(message(e)); }
  }
  return <Section title="Проверить список документов" subtitle="Выберите задачу, подготовьте список и отправьте его на обработку. Готовые файлы появятся в истории запросов.">
    <div className="registry-choice-grid" role="group" aria-label="Задача пакетной проверки">
      <button type="button" className={kind === 'find-doc' ? 'registry-choice is-active' : 'registry-choice'} aria-pressed={kind === 'find-doc'} onClick={() => { setKind('find-doc'); setInput(''); setError(''); }}><DescriptionOutlined/><strong>Найти по номерам</strong><span>Полные сведения о документах и добавление в подписку.</span></button>
      <button type="button" className={kind === 'check-status' ? 'registry-choice is-active' : 'registry-choice'} aria-pressed={kind === 'check-status'} onClick={() => { setKind('check-status'); setInput(''); setError(''); }}><RefreshRounded/><strong>Проверить изменения статусов</strong><span>Документы, статус которых изменился за выбранный период.</span></button>
    </div>
    <div className="registry-input-grid">
      <TextField select label="Реестр пакета" value={section} onChange={e => setSection(e.target.value as RegistrySection)}>{registrySections.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}</TextField>
      {kind === 'check-status' && <TextField type="number" label="За сколько дней" inputProps={{ min: 1, max: 14 }} value={days} onChange={e => setDays(Number(e.target.value))}/>}
    </div>
    {kind === 'check-status' && <RadioGroup row value={scope} onChange={e => setScope(e.target.value)} aria-label="Какие документы проверить"><FormControlLabel value="list" control={<Radio/>} label="Список ID документов"/><FormControlLabel value="subscription" control={<Radio/>} label="Подписка организации"/></RadioGroup>}
    {kind === 'check-status' && scope === 'subscription' ? <Alert severity="info" sx={{ my: 2 }}>Будут проверены документы выбранного реестра, добавленные в подписку организации через пакетный поиск.</Alert> : <Box sx={{ mt: 2 }}><TextField multiline minRows={6} maxRows={14} label={kind === 'find-doc' ? 'Документы, по одному в строке' : 'ID документов, по одному в строке'} value={input} onChange={e => setInput(e.target.value)} helperText={kind === 'find-doc' ? `Номер | дата регистрации YYYY-MM-DD${section === 'reaeu' ? '' : ' | ИНН'}. Дата и ИНН необязательны.` : section === 'reaeu' ? 'UUID или идентификатор ЕАЭС из 24 шестнадцатеричных символов.' : 'Числовые ID из результатов поиска в реестре. Это не регистрационные номера.'}/><Typography variant="caption" color="text.secondary">Строк в списке: {lines.length.toLocaleString('ru-RU')}</Typography></Box>}
    <div className="registry-form-actions"><Button variant="contained" endIcon={<ArrowForwardRounded/>} disabled={findState.isLoading || checkState.isLoading} onClick={() => void submit()}>{findState.isLoading || checkState.isLoading ? 'Отправляем…' : 'Создать пакетный запрос'}</Button><span>До 100 000 документов. Стандартный лимит — 30 запросов в день.</span></div>
    {error && <Alert severity="error">{error}</Alert>}
    {kind === 'check-status' && <Typography variant="body2" color="text.secondary">В результат попадают только изменения. Отсутствие документа в файле означает, что за указанный период статус не менялся.</Typography>}
  </Section>;
}

export function RegistryRequestHistory({ firmId, requestId, onSelect, canFetch }: { firmId: string; requestId: string; onSelect: (id: string) => void; canFetch: boolean }) {
  const [section, setSection] = useState(''); const [kind, setKind] = useState(''); const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false); const [error, setError] = useState('');
  const history = marketplaceApi.useRegistryHistoryQuery({ firmId, section: section || undefined, kind: kind || undefined, page });
  const selected = history.currentData?.items.find(x => x.requestId === requestId);
  const status = marketplaceApi.useRegistryRequestStatusQuery({ firmId, requestId }, { skip: !requestId || !canFetch || selected?.usesCurrentConnection === false });
  async function file(errors: boolean) {
    setDownloading(true); setError('');
    try { await downloadRegistryFile(firmId, `/async/${errors ? 'errors' : 'result'}/${requestId}`, `${requestId}-${errors ? 'errors' : 'result'}.jsonl.gz`, 0); }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(message(e)); } finally { setDownloading(false); }
  }
  return <div className="registry-history-layout">
    <Section title="Запросы компании" subtitle="Выберите запрос, проверьте готовность и скачайте результат. Файлы у поставщика хранятся 24 часа.">
      <div className="registry-input-grid"><TextField select label="Реестр в истории" value={section} onChange={e => { setSection(e.target.value); setPage(1); }}><MenuItem value="">Все реестры</MenuItem>{registrySections.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}</TextField><TextField select label="Задача в истории" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><MenuItem value="">Все задачи</MenuItem><MenuItem value="find-doc">Поиск документов</MenuItem><MenuItem value="check-status">Изменения статусов</MenuItem></TextField></div>
      {history.isLoading || history.isFetching && !history.currentData ? <Loading/> : history.error ? <ErrorState error={history.error} retry={history.refetch}/> : <>
        {!history.currentData?.items.length ? <EmptyState title="Запросов пока нет" text="Создайте пакетную проверку или измените фильтры."/> : <div className="registry-task-list">{history.currentData.items.map(request => <button type="button" key={request.requestId} className={`registry-task-row${requestId === request.requestId ? ' is-active' : ''}`} aria-pressed={requestId === request.requestId} aria-label={`Открыть запрос ${request.requestId}`} onClick={() => { setError(''); onSelect(request.requestId); }}><DescriptionOutlined/><span><strong>{request.kind === 'find-doc' ? 'Поиск документов' : 'Изменения статусов'}</strong><span>{registryName(request.section)} · {dateTime(request.createdAtUtc)}</span><code>{request.requestId}</code>{!request.usesCurrentConnection && <span>Создан с прежними настройками доступа</span>}</span><ArrowForwardRounded/></button>)}</div>}
        {!!history.currentData?.total && <Box className="registry-pagination"><Typography variant="body2" color="text.secondary">Всего: {history.currentData.total}</Typography><Pagination size="small" page={page} count={Math.ceil(history.currentData.total / 10)} onChange={(_, value) => setPage(value)}/></Box>}
      </>}
    </Section>
    <Section title="Готовность и файлы" subtitle={requestId || 'Выберите запрос из списка слева.'}>
      {!requestId ? <EmptyState title="Откройте запрос" text="Здесь появятся статус обработки и файлы для скачивания."/> : !canFetch ? <Alert severity="info">Для чтения результатов настройте подключение маркетплейса.</Alert> : selected?.usesCurrentConnection === false ? <Alert severity="warning">Запрос создан с прежними настройками подключения. Создайте новый запрос с текущим ключом.</Alert> : <>
        {status.isFetching && <Typography role="status" sx={{ mb: 2 }}>Уточняем готовность…</Typography>}
        {status.error && <Alert severity="error" sx={{ mb: 2 }}>{message(status.error)}</Alert>}
        {status.currentData && <div aria-live="polite"><Chip color={status.currentData.status === 'SUCCESS' ? 'success' : status.currentData.status === 'FAILED' ? 'error' : 'default'} variant="outlined" label={statusNames[status.currentData.status] ?? status.currentData.status} sx={{ mb: 2 }}/>{status.currentData.errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{status.currentData.errorMessage}</Alert>}
          <div className="registry-download-actions"><Button variant="contained" startIcon={<CloudDownloadOutlined/>} disabled={downloading || !status.currentData.resultAvailable} onClick={() => void file(false)}>Скачать результат JSONL.GZ</Button><Button variant="outlined" disabled={downloading || !status.currentData.errorsAvailable} onClick={() => void file(true)}>Скачать ошибки JSONL.GZ</Button></div></div>}
        <Button sx={{ mt: 2 }} startIcon={<RefreshRounded/>} disabled={status.isFetching} onClick={() => void status.refetch()}>Обновить статус запроса</Button>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </>}
    </Section>
  </div>;
}

export function RegistryExports({ firmId }: { firmId: string }) {
  const [load, state] = marketplaceApi.useLazyRegistryManifestQuery(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [chosenDate, setChosenDate] = useState('');
  const dates = [...new Set(state.data?.deltasSinceFull?.map(x => x.coversDate).filter((date): date is string => !!date))].sort().reverse();
  const date = dates.includes(chosenDate) ? chosenDate : dates[0] ?? '';
  async function file(section: string, metadata: RegistryExport, delta: boolean) {
    setError(''); setBusy(true);
    try {
      if (!['rss', 'rds', 'reaeu'].includes(section) || delta && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.coversDate ?? '')) throw new Error('В манифесте указан неизвестный реестр или дата.');
      const filename = `${section}-${delta ? `delta-${metadata.coversDate}` : 'full'}.jsonl.gz`;
      await downloadRegistryFile(firmId, `/sync/export/${filename}`, filename, metadata.sizeBytes);
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(message(e)); } finally { setBusy(false); }
  }
  function entry(section: RegistrySection, metadata: RegistryExport | null | undefined, delta = false) {
    return <article className="registry-export-card" key={section}><DescriptionOutlined/><h3>{registryName(section)}</h3>{metadata ? <><dl><div><dt>Записей</dt><dd>{metadata.recordCount?.toLocaleString('ru-RU') ?? '—'}</dd></div><div><dt>Размер</dt><dd>{metadata.sizeBytes == null ? '—' : `${(metadata.sizeBytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`}</dd></div></dl><Typography variant="caption" color="text.secondary">Подготовлено {metadata.generatedAt ? dateTime(metadata.generatedAt) : '—'}</Typography><details><summary>Контрольная сумма SHA-256</summary><code>{metadata.sha256 || 'Не указана'}</code></details><Button variant="outlined" startIcon={<CloudDownloadOutlined/>} disabled={busy} onClick={() => void file(section, metadata, delta)}>Скачать {delta ? 'изменения' : 'полную выгрузку'}</Button></> : <Typography color="text.secondary">Файл пока не доступен.</Typography>}</article>;
  }
  return <Section title="Полные выгрузки и изменения" subtitle="Для обновления своей базы реестров. Полные файлы могут быть большими; дельты содержат изменения за один день.">
    <div className="registry-form-actions"><Button variant="contained" startIcon={<RefreshRounded/>} disabled={state.isFetching} onClick={() => void load(firmId)}>{state.isFetching ? 'Проверяем файлы…' : state.data ? 'Обновить список файлов' : 'Получить список выгрузок'}</Button>{state.data && <span>Обновлено {state.data.updatedAt ? dateTime(state.data.updatedAt) : '—'}</span>}</div>
    {state.error && <Alert severity="error">{message(state.error)}</Alert>}{error && <Alert severity="error">{error}</Alert>}
    {state.data && <><Typography component="h3" variant="h6" sx={{ my: 2 }}>Полная база</Typography><div className="registry-export-grid">{entry('rss', state.data.rssFull)}{entry('rds', state.data.rdsFull)}{entry('reaeu', state.data.reaeuFull)}</div><div className="registry-delta-heading"><div><Typography component="h3" variant="h6">Изменения за день</Typography><Typography variant="body2" color="text.secondary">Доступные дельты за последние 7 дней.</Typography></div>{dates.length > 0 && <TextField select label="Дата изменений" value={date} onChange={e => setChosenDate(e.target.value)} sx={{ maxWidth: 240 }}>{dates.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>}</div>{dates.length ? <div className="registry-export-grid">{(['rss', 'rds', 'reaeu'] as const).map(section => entry(section, state.data?.deltasSinceFull?.find(x => x.section?.toLowerCase() === section && x.coversDate === date), true))}</div> : <Alert severity="info">В манифесте пока нет дельт.</Alert>}</>}
    <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>Стандартный лимит — 3 скачивания в день на метод. Файлы готовятся ежедневно; рекомендованное время скачивания — после 05:00.</Typography>
  </Section>;
}
