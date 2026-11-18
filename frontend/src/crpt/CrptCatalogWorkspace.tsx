import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import {
  AddRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  ContentCopyOutlined,
  DownloadRounded,
  ExpandMoreRounded,
  Inventory2Outlined,
  OpenInNewRounded,
  RefreshRounded,
  SearchRounded,
  ViewColumnOutlined,
} from '@mui/icons-material';
import {
  useCatalogProductGroups,
  useCatalogProducts,
  catalogKeys,
} from '../marking/hooks/use-honest-sign-catalog';
import { catalogApiService } from '../marking/lib/honest-sign/catalogApiService';
import type {
  CatalogCardRequest,
  CatalogProduct,
  CatalogProductFilters,
  CatalogSubmission,
} from '../marking/lib/honest-sign/catalogTypes';
import { CatalogCardForm } from '../marking/components/honest-sign/CatalogCardForm';
import { CatalogCardWorkflow } from '../marking/components/honest-sign/CatalogCardWorkflow';
import { CatalogProductStatus } from '../marking/components/honest-sign/CatalogProductStatus';
import { CatalogPermitsPanel } from '../marking/components/honest-sign/CatalogPermitsPanel';
import { CatalogSubmissionHistory } from '../marking/components/honest-sign/CatalogSubmissionHistory';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../marking/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../marking/components/ui/alert-dialog';
import { cryptoProSignatureService } from '../marking/lib/honest-sign/cryptoProSignatureService';
import { CrptBatchPanel } from './CrptBatchPanel';
import { CrptAccessPanel } from './CrptAccessPanel';
import { assertCrptEnvironment, captureCrptEnvironment, type CrptEnvironment } from './environment';
import { exportSheet, cardsToRows, similarCard } from './spreadsheet';
import { crptApi } from './api';

const columns = [
  ['gtin', 'GTIN'],
  ['name', 'Наименование товара'],
  ['brand', 'Бренд'],
  ['tnved', 'ТН ВЭД'],
  ['status', 'Статус карточки'],
  ['updatedAt', 'Обновление'],
] as const;
type Column = (typeof columns)[number][0];
type Editor = { title: string; card?: CatalogCardRequest; batch?: boolean };
type Outcome = { gtin: string; message: string; error?: boolean };

export function CrptCatalogWorkspace({
  companyId,
  environment,
  selectedThumbprint,
  onUnsavedChange,
}: {
  companyId: string;
  environment: CrptEnvironment;
  selectedThumbprint: string;
  onUnsavedChange: (dirty: boolean) => void;
}) {
  const client = useQueryClient();
  const [tab, setTab] = useState('products');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<CatalogProductFilters>({
    fromDate: '2000-01-01',
    toDate: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  });
  const [search, setSearch] = useState('');
  const [detailStatus, setDetailStatus] = useState('all');
  const [gtinSearch, setGtinSearch] = useState('');
  const lookup = useQuery({
    queryKey: ['crpt-search', companyId, gtinSearch],
    queryFn: ({ signal }) => crptApi.search(gtinSearch, signal),
    enabled: !!gtinSearch,
  });
  const [permitOpen, setPermitOpen] = useState(false);
  const [permit, setPermit] = useState({ attributeId: '23557', number: '', date: '' });
  const [sort, setSort] = useState<Column>('updatedAt');
  const [ascending, setAscending] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Column[]>(columns.map((x) => x[0]));
  const [columnMenu, setColumnMenu] = useState<HTMLElement | null>(null);
  const [actionMenu, setActionMenu] = useState<HTMLElement | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [batch, setBatch] = useState<CatalogCardRequest[]>([]);
  const [childBusy, setChildBusy] = useState(false);
  useEffect(() => {
    const unsaved = dirty || batch.length > 0;
    onUnsavedChange(unsaved);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      onUnsavedChange(false);
    };
  }, [dirty, batch.length, onUnsavedChange]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [confirmation, setConfirmation] = useState<'Moderate' | 'Sign' | null>(null);
  const [confirmSign, setConfirmSign] = useState(false);
  const groups = useCatalogProductGroups(companyId);
  const products = useCatalogProducts(companyId, page, filters);
  const opening = useRef(false);
  const items = gtinSearch ? (lookup.data ?? []) : (products.data?.items ?? []);
  const filtered = useMemo(() => {
    const terms = search
      .toLocaleLowerCase('ru')
      .split(/[\s,;]+/)
      .filter(Boolean);
    return items
      .filter(
        (row) =>
          (!terms.length ||
            terms.some((term) =>
              `${row.gtin} ${row.name} ${row.brand} ${row.tnved}`
                .toLocaleLowerCase('ru')
                .includes(term),
            )) &&
          (detailStatus === 'all' ||
            row.detailedStatuses.includes(detailStatus) ||
            row.status === detailStatus),
      )
      .sort(
        (a, b) =>
          (ascending ? 1 : -1) *
          String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), 'ru', { numeric: true }),
      );
  }, [items, search, detailStatus, sort, ascending]);
  const selected = items.filter((x) => selection.has(x.goodId));
  const busy = formBusy || childBusy;
  const clearSelection = () => setSelection(new Set());
  const refresh = async () => {
    clearSelection();
    await client.invalidateQueries({ queryKey: catalogKeys.all(companyId) });
  };
  const startEditor = (value: Editor) => {
    setDirty(false);
    setEditor(value);
  };
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else {
      setEditor(null);
      setDetail(null);
    }
  };
  const track = async (row: CatalogProduct) =>
    row.submissionId
      ? { id: row.submissionId }
      : catalogApiService.trackProduct(row.goodId, row.gtin);
  const action = useMutation({
    mutationFn: async (kind: 'open' | 'similar' | 'set' | 'export') => {
      if (opening.current) return;
      opening.current = true;
      const scope = captureCrptEnvironment();
      try {
        if (kind === 'set') {
          if (!selected.length) return;
          const first = await track(selected[0]);
          assertCrptEnvironment(scope);
          const card = await catalogApiService.card(first.id);
          assertCrptEnvironment(scope);
          if (!card.draft) throw new Error('Не удалось определить категорию выбранного товара.');
          const base = similarCard(card.draft);
          startEditor({
            title: 'Создать набор из выбранных товаров',
            card: {
              ...base,
              isSet: true,
              isKit: false,
              isTechGtin: false,
              isSim: false,
              name: '',
              attributes: [],
              setGtins: selected.map((x) => ({ gtin: x.gtin, quantity: 1 })),
            },
          });
          return;
        }
        const cards: CatalogCardRequest[] = [];
        for (const row of kind === 'export' ? selected : selected.slice(0, 1)) {
          const local = await track(row);
          assertCrptEnvironment(scope);
          if (kind === 'open') {
            setDirty(false);
            setDetail(local.id);
            return;
          }
          const card = await catalogApiService.card(local.id);
          assertCrptEnvironment(scope);
          if (!card.draft)
            throw new Error(`Карточка ${row.gtin} пока недоступна для копирования или экспорта.`);
          if (kind === 'similar') {
            startEditor({ title: 'Создать подобный товар', card: similarCard(card.draft) });
            return;
          }
          cards.push(card.draft);
        }
        if (kind === 'export') exportSheet('ZNAQ-CRPT-карточки.xlsx', cardsToRows(cards));
      } finally {
        opening.current = false;
      }
    },
  });
  const bulk = useMutation({
    mutationFn: async (kind: 'Moderate' | 'Sign') => {
      const scope = captureCrptEnvironment();
      setOutcomes([]);
      onDialogDone();
      for (const row of selected) {
        assertCrptEnvironment(scope);
        try {
          const local = await track(row);
          assertCrptEnvironment(scope);
          const requestId = crypto.randomUUID();
          let result;
          if (kind === 'Moderate') result = await catalogApiService.moderate(local.id, requestId);
          else {
            const data = await catalogApiService.signingData(local.id, true);
            assertCrptEnvironment(scope);
            if (
              data.certificateThumbprint.replace(/[^a-f0-9]/gi, '').toUpperCase() !==
              selectedThumbprint.replace(/[^a-f0-9]/gi, '').toUpperCase()
            )
              throw new Error('Сертификат сессии изменился. Подключитесь повторно.');
            const proof = await cryptoProSignatureService.signDetached({
              thumbprint: selectedThumbprint,
              message: data.xml,
              cadesType: 'bes',
            });
            assertCrptEnvironment(scope);
            result = await catalogApiService.sign(local.id, {
              requestId,
              preparationId: data.preparationId,
              xml: data.xml,
              payloadHash: data.payloadHash,
              publicationAgreement: true,
              signature: cryptoProSignatureService.normalizeDetachedSignature(proof.pkcs7),
              certificateThumbprint: selectedThumbprint,
            });
          }
          assertCrptEnvironment(scope);
          setOutcomes((value) => [
            ...value,
            {
              gtin: row.gtin,
              message:
                result.state === 'Accepted'
                  ? kind === 'Sign'
                    ? 'Подпись принята НК'
                    : 'Запрос модерации принят НК'
                  : result.error || 'Результат требует сверки в журнале',
              error: result.state !== 'Accepted',
            },
          ]);
        } catch (e) {
          assertCrptEnvironment(scope);
          setOutcomes((value) => [
            ...value,
            {
              gtin: row.gtin,
              message: `${e instanceof Error ? e.message : 'Ошибка'}. Проверьте карточку перед повтором.`,
              error: true,
            },
          ]);
        }
      }
      await refresh();
    },
  });
  const addPermit = useMutation({
    mutationFn: async () => {
      const scope = captureCrptEnvironment();
      setPermitOpen(false);
      setOutcomes([]);
      for (const row of selected) {
        assertCrptEnvironment(scope);
        try {
          const tracked = await track(row);
          assertCrptEnvironment(scope);
          const card = await catalogApiService.card(tracked.id);
          assertCrptEnvironment(scope);
          if (!card.draft || !card.canEdit)
            throw new Error('Карточка недоступна для редактирования.');
          const model = await catalogApiService.attributes(
            card.draft.categoryId,
            undefined,
            card.draft.productGroupCode ?? undefined,
            card.draft.isSet,
          );
          assertCrptEnvironment(scope);
          const attributeId = Number(permit.attributeId);
          if (!model.some((x) => x.id === attributeId))
            throw new Error('Выбранный тип РД отсутствует в атрибутивной модели товара.');
          const result = await catalogApiService.update(tracked.id, {
            ...card.draft,
            requestId: crypto.randomUUID(),
            sendToModeration: false,
            attributes: [
              ...card.draft.attributes.filter(
                (x) =>
                  x.id !== attributeId ||
                  (x.gtin && x.gtin.padStart(14, '0') !== card.gtin.padStart(14, '0')),
              ),
              {
                id: attributeId,
                value: `${permit.number.trim()}:::${permit.date}`,
                valueType: null,
              },
            ],
          });
          assertCrptEnvironment(scope);
          setOutcomes((value) => [
            ...value,
            {
              gtin: row.gtin,
              message:
                result.state === 'Processing'
                  ? 'РД отправлен. Дождитесь обработки в НК.'
                  : result.error || 'Результат требует проверки',
              error: !['Processing', 'Accepted'].includes(result.state),
            },
          ]);
        } catch (e) {
          assertCrptEnvironment(scope);
          setOutcomes((value) => [
            ...value,
            {
              gtin: row.gtin,
              message: e instanceof Error ? e.message : 'Не удалось добавить РД.',
              error: true,
            },
          ]);
        }
      }
      await refresh();
    },
  });
  const onDialogDone = () => {
    setConfirmation(null);
    setConfirmSign(false);
  };
  const locked = busy || action.isPending || bulk.isPending || addPermit.isPending;
  const cabinet =
    environment === 'sandbox'
      ? 'https://markirovka.sandbox.crptech.ru/'
      : 'https://markirovka.crpt.ru/';
  function onSaved(receipt: CatalogSubmission) {
    setEditor(null);
    setDirty(false);
    setDetail(receipt.id);
    void refresh();
  }
  return (
    <div className="crpt-console">
      <Tabs
        value={tab}
        onChange={(_, value: string) => {
          if (!locked) setTab(value);
        }}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Разделы ZNAQ.CRPT"
        className="crpt-console-tabs"
      >
        <Tab value="products" label="Каталог товаров" />
        <Tab value="batch" label={`Массовое создание${batch.length ? ` · ${batch.length}` : ''}`} />
        <Tab value="permits" label="Разрешительные документы" />
        <Tab value="access" label="Субаккаунты" />
        <Tab value="history" label="Журнал операций" />
        <Tab value="deletion" label="Удаление карточек" />
      </Tabs>
      {tab === 'products' && (
        <>
          <div className="crpt-catalog-intro">
            <div>
              <h2>Ваши товары в Национальном каталоге</h2>
              <p>Создавайте карточки, проверяйте статусы и управляйте выбранными товарами.</p>
            </div>
            <Chip label="Синхронизация с НК" variant="outlined" size="small" />
          </div>
          <section className="crpt-panel">
            <div className="crpt-toolbar crpt-main-toolbar">
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                disabled={locked}
                onClick={() => startEditor({ title: 'Новая карточка товара' })}
              >
                Создать новую позицию
              </Button>
              <Button
                variant="outlined"
                endIcon={<ExpandMoreRounded />}
                disabled={!selected.length || locked}
                onClick={(e) => setActionMenu(e.currentTarget)}
              >
                Действия{selected.length ? ` · ${selected.length}` : ''}
              </Button>
              <div className="crpt-toolbar-spacer" />
              <Button
                startIcon={<RefreshRounded />}
                disabled={products.isFetching || locked}
                onClick={() => void refresh()}
              >
                Запросить список карточек
              </Button>
              <Button
                startIcon={<DownloadRounded />}
                disabled={!selected.length || locked}
                onClick={() => action.mutate('export')}
              >
                Экспорт XLSX
              </Button>
              <Button
                aria-label="Настроить столбцы"
                onClick={(e) => setColumnMenu(e.currentTarget)}
              >
                <ViewColumnOutlined />
              </Button>
            </div>
            <Menu anchorEl={actionMenu} open={!!actionMenu} onClose={() => setActionMenu(null)}>
              {[
                ['Открыть / редактировать', () => action.mutate('open'), selected.length !== 1],
                ['Создать подобный товар', () => action.mutate('similar'), selected.length !== 1],
                [
                  'Создать набор',
                  () => action.mutate('set'),
                  !selected.length || selected.some((x) => !x.gtin),
                ],
                ['Отправить на модерацию', () => setConfirmation('Moderate'), !selected.length],
                [
                  'Подписать и опубликовать',
                  () => setConfirmation('Sign'),
                  !selected.length || !selectedThumbprint,
                ],
                ['Предоставить доступ другой компании', () => setTab('access'), !selected.length],
                ['Добавить разрешительный документ', () => setPermitOpen(true), !selected.length],
              ].map(([label, callback, disabled]) => (
                <MenuItem
                  key={String(label)}
                  disabled={Boolean(disabled)}
                  onClick={() => {
                    setActionMenu(null);
                    (callback as () => void)();
                  }}
                >
                  {String(label)}
                </MenuItem>
              ))}
            </Menu>
            <Menu anchorEl={columnMenu} open={!!columnMenu} onClose={() => setColumnMenu(null)}>
              {columns.map(([key, label]) => (
                <MenuItem
                  key={key}
                  onClick={() =>
                    setVisibleColumns((value) =>
                      value.includes(key)
                        ? value.length > 1
                          ? value.filter((x) => x !== key)
                          : value
                        : [...value, key],
                    )
                  }
                >
                  <Checkbox checked={visibleColumns.includes(key)} />
                  {label}
                </MenuItem>
              ))}
            </Menu>
            <div className="crpt-filters">
              <TextField
                select
                size="small"
                label="Статус в НК"
                value={filters.status ?? 'all'}
                onChange={(e) => {
                  setFilters((value) => ({
                    ...value,
                    status:
                      e.target.value === 'all'
                        ? undefined
                        : (e.target.value as CatalogProductFilters['status']),
                  }));
                  setPage(1);
                  clearSelection();
                }}
              >
                <MenuItem value="all">Все статусы</MenuItem>
                <MenuItem value="published">Опубликованные</MenuItem>
                <MenuItem value="draft">Черновики и модерация</MenuItem>
                <MenuItem value="archived">В архиве</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Уточнить статус на странице"
                value={detailStatus}
                onChange={(e) => {
                  setDetailStatus(e.target.value);
                  clearSelection();
                }}
              >
                <MenuItem value="all">Все состояния</MenuItem>
                <MenuItem value="moderation">На модерации</MenuItem>
                <MenuItem value="notsigned">Ожидают подписи</MenuItem>
                <MenuItem value="errors">Ошибка модерации</MenuItem>
              </TextField>
              <TextField
                size="small"
                className="crpt-search"
                label="GTIN, название или бренд"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (gtinSearch) setGtinSearch('');
                  clearSelection();
                }}
                helperText="Название и бренд — на странице. GTIN можно искать по всему НК."
                InputProps={{
                  startAdornment: <SearchRounded fontSize="small" sx={{ mr: 1, opacity: 0.5 }} />,
                }}
              />
              <Button
                disabled={
                  locked ||
                  lookup.isFetching ||
                  !search.trim() ||
                  !search
                    .trim()
                    .split(/[\s,;]+/)
                    .every((x) => /^\d{8}$|^\d{12,14}$/.test(x))
                }
                onClick={() => {
                  setGtinSearch(search.trim());
                  clearSelection();
                }}
              >
                Найти GTIN в НК
              </Button>
              <TextField
                size="small"
                label="Обновлены с"
                type="date"
                value={filters.fromDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => {
                  setFilters((value) => ({ ...value, fromDate: e.target.value }));
                  setPage(1);
                  clearSelection();
                }}
              />
              <TextField
                size="small"
                label="Обновлены по"
                type="date"
                value={filters.toDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => {
                  setFilters((value) => ({ ...value, toDate: e.target.value }));
                  setPage(1);
                  clearSelection();
                }}
              />
            </div>
            {(products.isFetching ||
              lookup.isFetching ||
              action.isPending ||
              bulk.isPending ||
              addPermit.isPending) && <LinearProgress />}
            {gtinSearch && (
              <Alert severity="info">
                Поиск указанных GTIN по всему каталогу.{' '}
                <Button
                  size="small"
                  onClick={() => {
                    setGtinSearch('');
                    setSearch('');
                  }}
                >
                  Вернуться к списку
                </Button>
              </Alert>
            )}
            {lookup.isError && gtinSearch && <Alert severity="error">{lookup.error.message}</Alert>}
            {addPermit.isError && <Alert severity="error">{addPermit.error.message}</Alert>}
            {products.isError && (
              <Alert severity="error">
                {products.error.message}{' '}
                <Button onClick={() => void products.refetch()}>Повторить</Button>
              </Alert>
            )}
            {action.isError && <Alert severity="error">{action.error.message}</Alert>}
            {bulk.isError && <Alert severity="error">{bulk.error.message}</Alert>}
            {!!selection.size && (
              <div className="crpt-selection">
                <strong>Выбрано {selection.size}</strong>
                <span>Выбор действует на текущей странице.</span>
                <Button size="small" onClick={clearSelection}>
                  Снять выделение
                </Button>
              </div>
            )}
            <div className="crpt-table-wrap">
              <table className="crpt-table">
                <thead>
                  <tr>
                    <th className="crpt-check-cell">
                      <Checkbox
                        size="small"
                        inputProps={{ 'aria-label': 'Выбрать все карточки на странице' }}
                        disabled={locked || !filtered.length}
                        checked={
                          !!filtered.length && filtered.every((x) => selection.has(x.goodId))
                        }
                        indeterminate={
                          filtered.some((x) => selection.has(x.goodId)) &&
                          !filtered.every((x) => selection.has(x.goodId))
                        }
                        onChange={(e) =>
                          setSelection(
                            e.target.checked ? new Set(filtered.map((x) => x.goodId)) : new Set(),
                          )
                        }
                      />
                    </th>
                    {columns
                      .filter(([key]) => visibleColumns.includes(key))
                      .map(([key, label]) => (
                        <th key={key}>
                          <button
                            type="button"
                            onClick={() => {
                              setSort(key);
                              setAscending(sort === key ? !ascending : true);
                            }}
                          >
                            {label}
                            {sort === key ? (
                              ascending ? (
                                <ArrowUpwardRounded />
                              ) : (
                                <ArrowDownwardRounded />
                              )
                            ) : null}
                          </button>
                        </th>
                      ))}
                    <th aria-label="Открытие карточки" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.goodId}
                      className={selection.has(row.goodId) ? 'crpt-row-selected' : ''}
                    >
                      <td className="crpt-check-cell">
                        <Checkbox
                          size="small"
                          inputProps={{ 'aria-label': `Выбрать ${row.gtin || row.name}` }}
                          checked={selection.has(row.goodId)}
                          disabled={locked}
                          onChange={(e) =>
                            setSelection((value) => {
                              const next = new Set(value);
                              if (e.target.checked) next.add(row.goodId);
                              else next.delete(row.goodId);
                              return next;
                            })
                          }
                        />
                      </td>
                      {visibleColumns.includes('gtin') && (
                        <td className="crpt-mono">{row.gtin || 'Назначается'}</td>
                      )}
                      {visibleColumns.includes('name') && (
                        <td className="crpt-product-name">{row.name}</td>
                      )}
                      {visibleColumns.includes('brand') && <td>{row.brand || '—'}</td>}
                      {visibleColumns.includes('tnved') && (
                        <td className="crpt-mono">{row.tnved || '—'}</td>
                      )}
                      {visibleColumns.includes('status') && (
                        <td>
                          <CatalogProductStatus product={row} />
                        </td>
                      )}
                      {visibleColumns.includes('updatedAt') && (
                        <td className="crpt-date">
                          {row.updatedAt?.replace('T', ' ').slice(0, 16) || '—'}
                        </td>
                      )}
                      <td>
                        <Button
                          size="small"
                          disabled={locked || !row.gtin}
                          onClick={async () => {
                            if (opening.current) return;
                            opening.current = true;
                            const scope = captureCrptEnvironment();
                            try {
                              const local = await track(row);
                              assertCrptEnvironment(scope);
                              setDirty(false);
                              setDetail(local.id);
                            } catch (e) {
                              setOutcomes([
                                {
                                  gtin: row.gtin,
                                  message: e instanceof Error ? e.message : 'Ошибка открытия',
                                  error: true,
                                },
                              ]);
                            } finally {
                              opening.current = false;
                            }
                          }}
                        >
                          Открыть
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && !products.isFetching && !products.isError && (
              <div className="crpt-empty">
                <Inventory2Outlined />
                <h3>
                  {search || detailStatus !== 'all'
                    ? 'На этой странице совпадений нет'
                    : 'Здесь будут ваши карточки'}
                </h3>
                <p>
                  {search || detailStatus !== 'all'
                    ? 'Измените фильтры или перейдите на другую страницу.'
                    : 'Создайте новую позицию или запросите актуальный список из Национального каталога.'}
                </p>
                <Button
                  variant="outlined"
                  onClick={() => startEditor({ title: 'Новая карточка товара' })}
                >
                  Создать карточку
                </Button>
              </div>
            )}
            <div className="crpt-pagination">
              <span>
                На странице: {filtered.length}
                {!gtinSearch && products.data?.total !== null && products.data?.total !== undefined
                  ? ` · Всего в НК: ${products.data.total}`
                  : ''}
              </span>
              {!gtinSearch && (
                <div>
                  <Button
                    aria-label="Предыдущая страница карточек"
                    disabled={page === 1 || products.isFetching || locked}
                    onClick={() => {
                      setPage((x) => x - 1);
                      clearSelection();
                    }}
                  >
                    <ChevronLeftRounded />
                  </Button>
                  <span>Страница {page}</span>
                  <Button
                    aria-label="Следующая страница карточек"
                    disabled={!products.data?.hasNextPage || products.isFetching || locked}
                    onClick={() => {
                      setPage((x) => x + 1);
                      clearSelection();
                    }}
                  >
                    <ChevronRightRounded />
                  </Button>
                </div>
              )}
            </div>
          </section>
          {!!outcomes.length && (
            <section className="crpt-panel crpt-outcomes">
              <h3>Результаты действий</h3>
              {outcomes.map((row, i) => (
                <Alert key={i} severity={row.error ? 'warning' : 'success'}>
                  <strong>{row.gtin}</strong> · {row.message}
                </Alert>
              ))}
            </section>
          )}
          <div className="crpt-catalog-help">
            <ContentCopyOutlined />
            <p>
              Для создания по образцу выберите одну карточку и нажмите «Действия → Создать подобный
              товар». Новой карточке потребуется новый GTIN.
            </p>
          </div>
        </>
      )}
      {tab === 'batch' && (
        <CrptBatchPanel
          companyId={companyId}
          cards={batch}
          onChange={setBatch}
          onAdd={() => startEditor({ title: 'Добавить карточку в пакет', batch: true })}
          onBusyChange={setChildBusy}
        />
      )}
      {tab === 'permits' && (
        <div className="crpt-panel">
          <CatalogPermitsPanel companyId={companyId} />
          <Alert severity="info">
            Чтобы внести РД в товар, откройте карточку в каталоге и заполните поля разрешительной
            документации. Декларация и сертификат имеют отдельные поля номера и даты.
          </Alert>
        </div>
      )}
      {tab === 'access' && (
        <CrptAccessPanel
          selectedGtins={selected.map((x) => x.gtin)}
          selectedThumbprint={selectedThumbprint}
          onBusyChange={setChildBusy}
        />
      )}
      {tab === 'history' && (
        <div className="crpt-panel">
          <CatalogSubmissionHistory
            companyId={companyId}
            onOpen={(id) => {
              setDirty(false);
              setDetail(id);
            }}
          />
        </div>
      )}
      {tab === 'deletion' && (
        <section className="crpt-panel crpt-deletion">
          <h2>Удаление карточек из Национального каталога</h2>
          <p>По инструкции ЧЗ удаление выполняется в кабинете через импорт официального шаблона.</p>
          <Alert severity="info">
            Откройте «Национальный каталог → Товары → Импорт → Удаление карточек», выгрузите шаблон,
            заполните его и загрузите в Честный знак.
          </Alert>
          <h3>Перед отправкой проверьте условия</h3>
          <ul>
            <li>Карточка принадлежит вашей организации, не опубликована и не заблокирована.</li>
            <li>По ней не заказывались коды маркировки, отсутствует регистрация в ГС1 РУС.</li>
            <li>Карточка не входит в набор, который был опубликован или отправлен на модерацию.</li>
            <li>
              За последние 24 часа запрос на удаление не отправлялся; после запроса карточка не
              изменялась.
            </li>
          </ul>
          <p>
            Окончательное решение и результат обработки отображаются в кабинете ЧЗ. Для
            опубликованных и трансграничных карточек действуют ограничения.
          </p>
          <div className="crpt-toolbar">
            <Button
              variant="contained"
              component="a"
              href={cabinet}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewRounded />}
            >
              Открыть {environment === 'sandbox' ? 'песочницу ЧЗ' : 'кабинет ЧЗ'}
            </Button>
            <Button
              disabled={!selected.length}
              onClick={() =>
                exportSheet('ZNAQ-CRPT-GTIN-для-сверки.xlsx', [
                  ['GTIN'],
                  ...selected.map((x) => [x.gtin]),
                ])
              }
            >
              Скачать выбранные GTIN для сверки
            </Button>
          </div>
          <small>
            Выгрузка GTIN служит для сверки. Для отправки используйте официальный шаблон из
            кабинета.
          </small>
        </section>
      )}
      <Dialog
        open={!!editor || !!detail}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent className="crpt-editor-dialog sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editor?.title || 'Карточка товара'}</DialogTitle>
            <DialogDescription>
              {editor?.title.includes('подобный')
                ? 'Характеристики перенесены. Укажите новый GTIN и проверьте данные товара.'
                : `Национальный каталог · ${environment === 'sandbox' ? 'песочница ЧЗ' : 'рабочий контур'}`}
            </DialogDescription>
          </DialogHeader>
          {editor ? (
            groups.isError ? (
              <Alert severity="error">{groups.error.message}</Alert>
            ) : groups.isPending ? (
              <LinearProgress />
            ) : (
              <CatalogCardForm
                key={editor.title}
                companyId={companyId}
                productGroups={groups.data ?? []}
                initialCard={editor.card}
                onDirtyChange={setDirty}
                onBusyChange={setFormBusy}
                onSubmitted={onSaved}
                onStage={
                  editor.batch
                    ? (request) => {
                        setBatch((value) => [...value, request]);
                        setDirty(false);
                        setEditor(null);
                      }
                    : undefined
                }
              />
            )
          ) : (
            detail && (
              <CatalogCardWorkflow
                companyId={companyId}
                submissionId={detail}
                selectedThumbprint={selectedThumbprint}
                productGroups={groups.data ?? []}
                onDirtyChange={setDirty}
                onBusyChange={setFormBusy}
              />
            )
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть без сохранения?</AlertDialogTitle>
            <AlertDialogDescription>
              Несохранённые изменения карточки будут потеряны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить редактирование</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDirty(false);
                setEditor(null);
                setDetail(null);
                setDiscard(false);
              }}
            >
              Закрыть карточку
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!confirmation}
        onOpenChange={(value) => {
          if (!value) onDialogDone();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation === 'Sign'
                ? 'Подписать выбранные карточки?'
                : 'Отправить карточки на модерацию?'}
            </DialogTitle>
            <DialogDescription>
              Выбрано товаров: {selected.length}. Контур:{' '}
              {environment === 'sandbox' ? 'песочница ЧЗ' : 'промышленный'}.
            </DialogDescription>
          </DialogHeader>
          <p className="crpt-mono">{selected.map((x) => x.gtin).join(', ')}</p>
          {confirmation === 'Sign' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmSign}
                  onChange={(e) => setConfirmSign(e.target.checked)}
                />
              }
              label="Подтверждаю сведения выбранных карточек и согласен на их публикацию"
            />
          )}
          <Button
            variant="contained"
            disabled={confirmation === 'Sign' && !confirmSign}
            onClick={() => confirmation && bulk.mutate(confirmation)}
          >
            {confirmation === 'Sign' ? 'Подписать и опубликовать' : 'Отправить на модерацию'}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={permitOpen} onOpenChange={setPermitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить РД в выбранные карточки</DialogTitle>
            <DialogDescription>
              Товаров: {selected.length}. Ранее заполненное значение выбранного типа документа будет
              заменено. Остальные типы РД сохраняются.
            </DialogDescription>
          </DialogHeader>
          <TextField
            select
            size="small"
            label="Тип разрешительного документа"
            value={permit.attributeId}
            onChange={(e) => setPermit((value) => ({ ...value, attributeId: e.target.value }))}
          >
            <MenuItem value="23557">Декларация о соответствии</MenuItem>
            <MenuItem value="23561">Сертификат соответствия</MenuItem>
            <MenuItem value="23555">Регистрационное удостоверение</MenuItem>
            <MenuItem value="23890">Регистрационное удостоверение в госреестре</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Номер РД"
            value={permit.number}
            onChange={(e) => setPermit((value) => ({ ...value, number: e.target.value }))}
          />
          <TextField
            size="small"
            type="date"
            label="Дата регистрации РД"
            InputLabelProps={{ shrink: true }}
            value={permit.date}
            onChange={(e) => setPermit((value) => ({ ...value, date: e.target.value }))}
          />
          <Button
            variant="contained"
            disabled={!permit.number.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(permit.date)}
            onClick={() => addPermit.mutate()}
          >
            Внести РД в {selected.length} карточки
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
