import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import {
  AddRounded,
  DownloadRounded,
  FileUploadOutlined,
  Inventory2Outlined,
  RefreshRounded,
} from '@mui/icons-material';
import { participantsApiService } from '../marking/lib/honest-sign/participantsApiService';
import { cryptoProSignatureService } from '../marking/lib/honest-sign/cryptoProSignatureService';
import {
  ORDER_TEMPLATE_OPTIONS,
  PRODUCT_GROUP_LABELS,
} from '../marking/components/honest-sign/constants';
import { CodesCheckWorkspace } from '../marking/components/honest-sign/CodesCheckWorkspace';
import { assertMarkingScope, captureMarkingScope } from '../marking/lib/workspace-scope';
import { downloadFile, exportSheet, readSheet } from './spreadsheet';
import {
  blankSuzRow,
  bufferStatusColors,
  bufferStatuses,
  buildSuzOrders,
  cisOptions,
  codesCsv,
  getSuzReceivingProducts,
  getSuzRecoveryProducts,
  importSuzRows,
  isSuzOrderExhausted,
  isSuzProductExhausted,
  operationStatuses,
  orderStatusColors,
  orderStatuses,
  parseSuzCodes,
  releaseOptions,
  suzRowsToSheet,
  type SuzBatchOrder,
  type SuzCatalogItem,
  type SuzOrder,
  type SuzProduct,
  type SuzReceipt,
  type SuzRow,
} from './suz';
import { suzApi } from './suzApi';
import type { CrptEnvironment } from './environment';
import { SuzCatalogProductPicker } from './SuzCatalogProductPicker';

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('ru'));
const date = (s: string | null) => (s ? new Date(s).toLocaleString('ru-RU') : '—');
const label = (group: string) => PRODUCT_GROUP_LABELS[group] ?? group;
const initialCodesQuantity = (product?: SuzProduct) =>
  String(Math.min(product?.availableCodes ?? 100, 100));
type Props = {
  companyId: string;
  environment: CrptEnvironment;
  selectedThumbprint: string;
  onUnsavedChange: (value: boolean) => void;
};

export function CrptSuzWorkspace({
  companyId,
  environment,
  selectedThumbprint,
  onUnsavedChange,
}: Props) {
  const client = useQueryClient();
  const [tab, setTab] = useState('orders');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const [group, setGroup] = useState('');
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rows, setRows] = useState<SuzRow[]>([]);
  const [review, setReview] = useState<SuzReceipt[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [preparationTotal, setPreparationTotal] = useState(0);
  const [codesDialog, setCodesDialog] = useState<{ order: SuzOrder; recovery: boolean } | null>(
    null,
  );
  const [codeGtin, setCodeGtin] = useState('');
  const [quantity, setCodesQuantity] = useState('100');
  const [blocks, setBlocks] = useState<
    { blockId: string; quantity?: number; blockDateTime?: number }[]
  >([]);
  const [block, setBlock] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [imports, setImports] = useState<{ name: string; codes: string[] }[]>([]);
  const [archiveName, setArchiveName] = useState('Объединённые коды');
  const [openedDocument, setOpenedDocument] = useState<SuzReceipt | null>(null);
  const [catalogGtin, setCatalogGtin] = useState('');
  const [subaccount, setSubaccount] = useState(false);
  const [catalogItem, setCatalogItem] = useState<SuzCatalogItem | null>(null);
  const [includeContents, setIncludeContents] = useState(false);
  const [catalogQuantity, setCatalogQuantity] = useState('1');
  const fileInput = useRef<HTMLInputElement>(null);
  const codeFiles = useRef<HTMLInputElement>(null);
  // Keep a request ID after a lost response, so an explicit retry cannot consume another block.
  const downloadAttempt = useRef<{ key: string; id: string } | null>(null);
  const pendingBatch = useRef<{ key: string; orders: SuzBatchOrder[] } | null>(null);
  const archiveAttempt = useRef<{ key: string; id: string } | null>(null);
  const groups = useQuery({
    queryKey: ['suz-groups', companyId, environment],
    queryFn: () => participantsApiService.getParticipantProductGroups(),
  });
  const datesValid = !!from && !!to && from <= to;
  const orders = useQuery({
    queryKey: ['suz-orders', companyId, environment, page, status, group, from, to],
    enabled: tab === 'orders' && datesValid,
    queryFn: ({ signal }) =>
      suzApi.orders(
        {
          filter: {
            startCreatedTimestamp: Date.parse(from + 'T00:00:00+03:00'),
            endCreatedTimestamp: Date.parse(to + 'T23:59:59.999+03:00'),
            ...(group ? { productGroups: [group] } : {}),
            ...(status === 'all'
              ? {}
              : {
                  orderStatuses:
                    status === 'active' ? ['CREATED', 'PENDING', 'APPROVED', 'READY'] : [status],
                }),
          },
          page,
          limit: 20,
        },
        signal,
      ),
  });
  const history = useQuery({
    queryKey: ['suz-history', companyId, environment, historyPage],
    queryFn: ({ signal }) => suzApi.list(historyPage, signal),
  });
  const receipts = history.data ?? [];
  const dirty = rows.length > 0 || imports.length > 0;
  useEffect(() => {
    onUnsavedChange(dirty);
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      onUnsavedChange(false);
      window.removeEventListener('beforeunload', guard);
    };
  }, [dirty, onUnsavedChange]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['suz-orders'] });
    void client.invalidateQueries({ queryKey: ['suz-history'] });
  };
  const task = useMutation({
    mutationFn: async (run: () => Promise<void>) => {
      setError('');
      setMessage('');
      await run();
    },
    onError: (e) => {
      setError(e.message);
      refresh();
    },
    onSuccess: refresh,
  });
  const run = (fn: () => Promise<void>) => task.mutate(fn);
  const busy = task.isPending;
  const codesOrder =
    codesDialog &&
    (orders.data?.items.find((order) => order.orderId === codesDialog.order.orderId) ??
      codesDialog.order);
  const recovery = codesDialog?.recovery === true;
  const codesProducts = codesOrder
    ? recovery
      ? getSuzRecoveryProducts(codesOrder)
      : getSuzReceivingProducts(codesOrder)
    : [];
  const codeProduct = codesProducts.find((product) => product.gtin === codeGtin);
  const maxQuantity = Math.min(codeProduct?.availableCodes ?? 10_000, 10_000);
  const validQuantity =
    /^[0-9]+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= maxQuantity;
  const codesAvailable = codesProducts.length > 0;
  useEffect(() => {
    if (!busy && codesDialog && !codesAvailable) {
      setCodesDialog(null);
      setMessage(
        'Статус заказа изменился. Обновите список заказов, чтобы увидеть доступные действия.',
      );
    }
  }, [busy, codesDialog, codesAvailable]);
  const update = (id: string, change: Partial<SuzRow>) =>
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...change } : x)));
  const startCodes = (order: SuzOrder, recover = false) => {
    const [product] = recover ? getSuzRecoveryProducts(order) : getSuzReceivingProducts(order);
    if (!product?.gtin) return;
    setCodesDialog({ order, recovery: recover });
    setCodeGtin(product.gtin);
    setCodesQuantity(initialCodesQuantity(product));
    setBlock('');
    setBlocks([]);
  };
  const saveCsv = (receipt: SuzReceipt) => {
    if (receipt.codes?.length)
      downloadFile(`ZNAQ-${receipt.id}.csv`, codesCsv(receipt.codes), 'text/csv;charset=utf-8');
  };
  const prepareBatch = async () => {
    const scope = captureMarkingScope();
    const key = JSON.stringify(rows);
    const batch =
      pendingBatch.current?.key === key ? pendingBatch.current.orders : buildSuzOrders(rows);
    pendingBatch.current = { key, orders: batch };
    setReview([]);
    setConfirmed(false);
    setPreparationTotal(batch.length);
    for (const order of batch) {
      const receipt = await suzApi.prepare(order.requestId, 'Create', order.payload);
      assertMarkingScope(scope);
      setReview((prev) => [...prev, receipt]);
    }
  };
  const sign = async () => {
    const scope = captureMarkingScope();
    for (const receipt of review) {
      if (receipt.state !== 'Prepared' || !receipt.body) continue;
      assertMarkingScope(scope);
      if (receipt.certificateThumbprint.toUpperCase() !== selectedThumbprint.toUpperCase())
        throw new Error('Выбранный сертификат не совпадает с сертификатом подготовки.');
      const proof = await cryptoProSignatureService.signDetached({
        thumbprint: selectedThumbprint,
        message: receipt.body,
        cadesType: 'bes',
      });
      assertMarkingScope(scope);
      const result = await suzApi.sign(
        receipt.id,
        cryptoProSignatureService.normalizeDetachedSignature(proof.pkcs7),
        selectedThumbprint,
      );
      assertMarkingScope(scope);
      setReview((prev) => prev.map((x) => (x.id === result.id ? result : x)));
      if (result.state !== 'Accepted') {
        setError(result.message ?? 'Проверьте результат в журнале.');
        return;
      }
    }
    setMessage('Подписанные запросы обработаны. Обновите статусы заказов.');
    if (review.every((x) => x.kind === 'Create')) {
      setRows([]);
      pendingBatch.current = null;
    }
  };
  const filtered = (orders.data?.items ?? []).filter(
    (x) =>
      (showHidden || !hidden.includes(x.orderId)) &&
      `${x.orderId} ${x.productionOrderId ?? ''} ${x.products.map((p) => p.gtin).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const toggle = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  const exportOrders = () =>
    exportSheet(
      'ZNAQ-СУЗ-заказы.xlsx',
      [
        [
          'Заказ',
          'Производственный заказ',
          'Дата',
          'Статус',
          'GTIN',
          'Запрошено',
          'Получено',
          'Доступно',
          'Состояние буфера',
          'Причина отказа',
        ],
        ...filtered.flatMap((x) =>
          x.products.map((p) => [
            x.orderId,
            x.productionOrderId ?? '',
            date(x.createdAtUtc),
            (orderStatuses[x.status] ?? x.status) +
              (isSuzOrderExhausted(x) ? ' · Коды исчерпаны' : ''),
            p.gtin ?? '',
            String(p.totalCodes ?? ''),
            String(p.totalPassed ?? ''),
            String(p.availableCodes ?? ''),
            isSuzProductExhausted(p)
              ? bufferStatuses.EXHAUSTED
              : (bufferStatuses[p.status ?? ''] ?? p.status ?? ''),
            p.rejectionReason ?? x.declineReason ?? '',
          ]),
        ),
      ],
      'Заказы СУЗ',
    );

  return (
    <div className="crpt-suz">
      <div className="crpt-suz-intro">
        <span className="crpt-suz-icon">
          <Inventory2Outlined />
        </span>
        <div>
          <strong>Станция управления заказами</strong>
          <p>Закажите коды, получите блоки и сохраните документы для дальнейшей работы.</p>
        </div>
        <Chip
          label={environment === 'sandbox' ? 'СУЗ · песочница' : 'СУЗ · рабочий контур'}
          size="small"
          variant="outlined"
        />
      </div>
      <Tabs
        value={tab}
        onChange={(_, value: string) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Разделы СУЗ"
      >
        <Tab value="orders" label="Заказы КМ" />
        <Tab value="create" label="Создать заказ" />
        <Tab value="documents" label="Документы с кодами" />
        <Tab value="code-check" label="Проверка кодов" />
        <Tab value="merge" label="Объединение файлов" />
        <Tab value="history" label="Журнал СУЗ" />
        <Tab value="help" label="Статусы и правила" />
      </Tabs>
      {busy && <LinearProgress />}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      {tab === 'orders' && (
        <section className="crpt-panel">
          <div className="crpt-panel-heading">
            <div>
              <h2>Заказы кодов маркировки</h2>
              <p>Статус заказа и доступность кодов по каждому GTIN.</p>
            </div>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setTab('create')}>
              Заказать КМ
            </Button>
          </div>
          <div className="crpt-toolbar crpt-suz-filters">
            <TextField
              select
              label="Статус заказов"
              size="small"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
                setSelected([]);
              }}
            >
              <MenuItem value="active">В работе</MenuItem>
              <MenuItem value="all">Все, включая исчерпанные</MenuItem>
              {Object.entries(orderStatuses).map(([id, text]) => (
                <MenuItem key={id} value={id}>
                  {text}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Товарная группа"
              size="small"
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">Все группы</MenuItem>
              {(groups.data ?? []).map((x) => (
                <MenuItem key={x} value={x}>
                  {label(x)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label="Созданы с"
              size="small"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              label="Созданы по"
              size="small"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </div>
          {!datesValid && <Alert severity="warning">Проверьте начало и конец периода.</Alert>}
          <div className="crpt-toolbar">
            <TextField
              size="small"
              label="Поиск на странице: заказ или GTIN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="crpt-toolbar-spacer" />
            <Button
              startIcon={<RefreshRounded />}
              disabled={busy || orders.isFetching}
              onClick={() => void orders.refetch()}
            >
              Обновить
            </Button>
            <Button
              startIcon={<DownloadRounded />}
              disabled={!filtered.length}
              onClick={exportOrders}
            >
              Excel
            </Button>
          </div>
          {!!selected.length && (
            <div className="crpt-selection">
              <strong>Выбрано заказов: {selected.length}</strong>
              <Button
                onClick={() => {
                  setHidden((prev) => [...new Set([...prev, ...selected])]);
                  setSelected([]);
                }}
              >
                Скрыть в этом сеансе
              </Button>
              <Button onClick={() => setSelected([])}>Снять выбор</Button>
            </div>
          )}
          {!!hidden.length && (
            <FormControlLabel
              control={
                <Checkbox checked={showHidden} onChange={(_, value) => setShowHidden(value)} />
              }
              label={`Показать скрытые (${hidden.length})`}
            />
          )}
          {orders.isFetching && <LinearProgress />}
          {orders.isError && <Alert severity="error">{orders.error.message}</Alert>}
          <div className="crpt-table-wrap">
            <table className="crpt-table crpt-suz-orders">
              <thead>
                <tr>
                  <th>
                    <Checkbox
                      inputProps={{ 'aria-label': 'Выбрать заказы страницы' }}
                      checked={
                        !!filtered.length && filtered.every((x) => selected.includes(x.orderId))
                      }
                      onChange={(_, checked) =>
                        setSelected(checked ? filtered.map((x) => x.orderId) : [])
                      }
                    />
                  </th>
                  <th>Заказ / GTIN</th>
                  <th>Создан</th>
                  <th>Статус</th>
                  <th>Запрошено</th>
                  <th>Получено</th>
                  <th>Доступно</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <OrderRows
                    key={order.orderId}
                    order={order}
                    selected={selected.includes(order.orderId)}
                    expanded={expanded === order.orderId}
                    onSelect={() => setSelected((prev) => toggle(prev, order.orderId))}
                    onExpand={() => setExpanded(expanded === order.orderId ? null : order.orderId)}
                    busy={busy}
                    onCodes={() => startCodes(order)}
                    onRecover={() => startCodes(order, true)}
                    onClose={() =>
                      run(async () => {
                        const receipt = await suzApi.prepare(crypto.randomUUID(), 'Close', {
                          orderId: order.orderId,
                        });
                        setReview([receipt]);
                        setPreparationTotal(1);
                        setConfirmed(false);
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!orders.isPending && !filtered.length && (
            <div className="crpt-empty">
              <Inventory2Outlined />
              <h3>Заказов пока нет</h3>
              <p>Измените фильтры или создайте заказ кодов.</p>
            </div>
          )}
          <div className="crpt-panel-footer">
            <span>
              Найдено в СУЗ: {fmt(orders.data?.totalItems)} · страница {page}
            </span>
            <div className="crpt-pagination">
              <Button
                disabled={page === 1 || orders.isFetching}
                onClick={() => {
                  setPage(page - 1);
                  setSelected([]);
                }}
              >
                Назад
              </Button>
              <Button
                disabled={orders.isFetching || page * 20 >= (orders.data?.totalItems ?? 0)}
                onClick={() => {
                  setPage(page + 1);
                  setSelected([]);
                }}
              >
                Далее
              </Button>
            </div>
          </div>
        </section>
      )}
      {tab === 'create' && (
        <section className="crpt-panel">
          <div className="crpt-panel-heading">
            <div>
              <h2>Новый заказ КМ</h2>
              <p>Добавьте GTIN вручную или загрузите шаблон, в том числе для субаккаунта.</p>
            </div>
            <Chip label={`${rows.length} товаров`} size="small" />
          </div>
          <Alert severity="info">
            Заказ формируется по товарной группе, способу выпуска, оплате и производственному
            заказу. До 10 GTIN в заказе; один GTIN — до 2 млн кодов, несколько — до 150 000 на GTIN.
            Допустимость шаблона и способа выпуска проверяет СУЗ.
          </Alert>
          {groups.isError && (
            <Alert severity="warning">
              {groups.error.message}{' '}
              <Button onClick={() => void groups.refetch()}>Повторить загрузку групп</Button>
            </Alert>
          )}
          <div className="crpt-suz-catalog-picker">
            <div className="crpt-toolbar">
              <TextField
                size="small"
                label="Найти GTIN в НК"
                value={catalogGtin}
                onChange={(e) => {
                  setCatalogGtin(e.target.value);
                  setCatalogItem(null);
                }}
                inputProps={{ maxLength: 14 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={subaccount}
                    disabled={busy}
                    onChange={(_, checked) => {
                      setSubaccount(checked);
                      setCatalogItem(null);
                    }}
                  />
                }
                label="Карточка по доступу субаккаунта"
              />
              <Button
                disabled={busy || !/^[0-9]{14}$/.test(catalogGtin)}
                onClick={() =>
                  run(async () => {
                    setCatalogItem(await suzApi.catalogItem(catalogGtin, subaccount));
                    setIncludeContents(false);
                  })
                }
              >
                Найти карточку
              </Button>
            </div>
            {catalogItem && (
              <div className="crpt-suz-catalog-result">
                <strong>{catalogItem.name || catalogItem.gtin}</strong>
                <p>
                  {catalogItem.gtin} ·{' '}
                  {cisOptions[catalogItem.cisType as keyof typeof cisOptions] ??
                    catalogItem.cisType}{' '}
                  · {catalogItem.status}
                </p>
                <TextField
                  size="small"
                  label="Количество товара / наборов"
                  value={catalogQuantity}
                  onChange={(e) => setCatalogQuantity(e.target.value)}
                  inputProps={{ inputMode: 'numeric' }}
                />
                {catalogItem.contents.length > 0 && (
                  <>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeContents}
                          onChange={(_, checked) => setIncludeContents(checked)}
                        />
                      }
                      label="Добавить также единицы из состава набора"
                    />
                    <p>
                      {catalogItem.contents.map((x) => `${x.gtin} × ${x.quantity}`).join(' · ')}
                    </p>
                  </>
                )}
                <Button
                  disabled={
                    busy ||
                    !/^[0-9]+$/.test(catalogQuantity) ||
                    +catalogQuantity < 1 ||
                    +catalogQuantity > 2_000_000
                  }
                  onClick={() =>
                    run(async () => {
                      const base = blankSuzRow(groups.data?.[0]);
                      const added = [
                        {
                          ...base,
                          gtin: catalogItem.gtin,
                          name: catalogItem.name,
                          cis: catalogItem.cisType,
                          quantity: catalogQuantity,
                        },
                      ];
                      if (includeContents)
                        for (const item of catalogItem.contents) {
                          const qty = Number(catalogQuantity) * item.quantity;
                          if (qty > 2_000_000)
                            throw new Error(
                              'Количество единиц состава превышает 2 млн. Разделите пакет.',
                            );
                          added.push({
                            ...blankSuzRow(base.group),
                            gtin: item.gtin,
                            name: `Состав набора ${catalogItem.gtin}`,
                            quantity: String(qty),
                          });
                        }
                      setRows((prev) => [...prev, ...added]);
                      setCatalogItem(null);
                      setCatalogGtin('');
                    })
                  }
                >
                  Добавить из НК
                </Button>
              </div>
            )}
          </div>
          <div className="crpt-toolbar">
            <Button
              startIcon={<AddRounded />}
              disabled={busy}
              onClick={() => setRows((prev) => [...prev, blankSuzRow(groups.data?.[0])])}
            >
              Добавить товар
            </Button>
            <Button
              startIcon={<FileUploadOutlined />}
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              Импорт Excel / CSV
            </Button>
            <Button
              onClick={() => exportSheet('ZNAQ-СУЗ-шаблон.xlsx', suzRowsToSheet([]), 'Заказ СУЗ')}
            >
              Шаблон для субаккаунта
            </Button>
            <Button
              disabled={!rows.length}
              onClick={() => exportSheet('ZNAQ-СУЗ-пакет.xlsx', suzRowsToSheet(rows), 'Заказ СУЗ')}
            >
              Экспорт пакета
            </Button>
          </div>
          <input
            hidden
            ref={fileInput}
            aria-label="Файл заказов СУЗ"
            type="file"
            accept=".xlsx,.csv,.tsv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file)
                run(async () => {
                  const imported = importSuzRows(await readSheet(file));
                  setRows(imported);
                  pendingBatch.current = null;
                  setMessage(
                    `Загружено товаров: ${imported.length}. Проверьте параметры перед подписанием.`,
                  );
                });
            }}
          />
          <datalist id="suz-template-options">
            {ORDER_TEMPLATE_OPTIONS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.category} · {x.format}
              </option>
            ))}
          </datalist>
          <div className="crpt-suz-composer">
            {rows.map((row, index) => (
              <article className="crpt-suz-product" key={row.id}>
                <div className="crpt-suz-product-top">
                  <strong>Товар {index + 1}</strong>
                  <Button
                    color="inherit"
                    size="small"
                    disabled={busy}
                    onClick={() => setRows((prev) => prev.filter((x) => x.id !== row.id))}
                  >
                    Удалить строку
                  </Button>
                </div>
                <div className="crpt-suz-fields">
                  <TextField
                    select
                    size="small"
                    label="Группа товара"
                    value={row.group}
                    disabled={busy}
                    onChange={(e) =>
                      update(row.id, {
                        group: e.target.value,
                        ...(row.catalogProduct && {
                          catalogProduct: undefined,
                          gtin: '',
                          name: '',
                          cis: 'UNIT',
                        }),
                      })
                    }
                  >
                    <MenuItem value="">Выберите группу</MenuItem>
                    {(groups.data ?? []).map((x) => (
                      <MenuItem key={x} value={x}>
                        {label(x)}
                      </MenuItem>
                    ))}
                    {row.group && !groups.data?.includes(row.group) && (
                      <MenuItem value={row.group}>{label(row.group)} · из импорта</MenuItem>
                    )}
                  </TextField>
                  <SuzCatalogProductPicker
                    key={row.group}
                    companyId={companyId}
                    environment={environment}
                    selectedThumbprint={selectedThumbprint}
                    productGroup={row.group}
                    value={row.catalogProduct ?? null}
                    disabled={busy}
                    onChange={(product) =>
                      update(row.id, {
                        catalogProduct: product ?? undefined,
                        gtin: product?.gtin ?? '',
                        name: product?.name ?? '',
                        cis: product?.cisType ?? 'UNIT',
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="GTIN · 14 цифр"
                    value={row.gtin}
                    disabled={busy}
                    onChange={(e) =>
                      update(row.id, { gtin: e.target.value, catalogProduct: undefined })
                    }
                    inputProps={{ maxLength: 14 }}
                  />
                  <TextField
                    size="small"
                    label="Количество КМ"
                    value={row.quantity}
                    disabled={busy}
                    onChange={(e) => update(row.id, { quantity: e.target.value })}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Тип КМ"
                    value={row.cis}
                    disabled={busy}
                    onChange={(e) => update(row.id, { cis: e.target.value })}
                  >
                    {Object.entries(cisOptions).map(([key, text]) => (
                      <MenuItem key={key} value={key}>
                        {text}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Способ выпуска"
                    value={row.release}
                    disabled={busy}
                    onChange={(e) => update(row.id, { release: e.target.value })}
                  >
                    {Object.entries(releaseOptions).map(([key, text]) => (
                      <MenuItem key={key} value={key}>
                        {text}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Способ оплаты"
                    value={row.payment}
                    disabled={busy}
                    onChange={(e) => update(row.id, { payment: e.target.value })}
                  >
                    <MenuItem value="2">По нанесению</MenuItem>
                    <MenuItem value="1">По эмиссии</MenuItem>
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Формат КМ"
                    value={row.template}
                    disabled={busy}
                    onChange={(e) => update(row.id, { template: e.target.value })}
                    SelectProps={{
                      MenuProps: { PaperProps: { sx: { maxHeight: 380, maxWidth: 750 } } },
                    }}
                    helperText={
                      ORDER_TEMPLATE_OPTIONS.find((x) => String(x.id) === row.template)?.format ??
                      'Выберите формат для товарной группы'
                    }
                  >
                    <MenuItem value="">Выберите формат</MenuItem>
                    {ORDER_TEMPLATE_OPTIONS.map((x) => (
                      <MenuItem
                        key={x.id}
                        value={String(x.id)}
                        sx={{ whiteSpace: 'normal', fontSize: 12 }}
                      >
                        {x.category} · #{x.id} · {x.format}
                      </MenuItem>
                    ))}
                    {row.template &&
                      !ORDER_TEMPLATE_OPTIONS.some((x) => String(x.id) === row.template) && (
                        <MenuItem value={row.template}>Шаблон #{row.template} из импорта</MenuItem>
                      )}
                  </TextField>
                  <TextField
                    size="small"
                    label="ИНН производителя"
                    value={row.producer}
                    disabled={busy}
                    onChange={(e) => update(row.id, { producer: e.target.value })}
                    inputProps={{ maxLength: 12 }}
                    helperText="Для глобальных GTIN, когда требует СУЗ"
                  />
                  <TextField
                    size="small"
                    label="Наименование (для работы)"
                    value={row.name}
                    disabled={busy}
                    onChange={(e) => update(row.id, { name: e.target.value })}
                  />
                  <TextField
                    size="small"
                    label="Производственный заказ"
                    value={row.production}
                    disabled={busy}
                    onChange={(e) => update(row.id, { production: e.target.value })}
                    inputProps={{ maxLength: 256 }}
                  />
                </div>
                {index === 0 && rows.length > 1 && (
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() =>
                      setRows((prev) =>
                        prev.map((x) => ({ ...x, release: row.release, payment: row.payment })),
                      )
                    }
                  >
                    Применить способ выпуска и оплату ко всем
                  </Button>
                )}
              </article>
            ))}
          </div>
          <datalist id="suz-groups">
            {(groups.data ?? []).map((x) => (
              <option key={x} value={x}>
                {label(x)}
              </option>
            ))}
          </datalist>
          {!rows.length && (
            <div className="crpt-empty">
              <AddRounded />
              <h3>Добавьте товары в заказ</h3>
              <p>Все поля шаблона Excel имеют текстовый формат, чтобы сохранить GTIN и ИНН.</p>
            </div>
          )}
          <div className="crpt-panel-footer">
            <span>Сначала проверьте сформированный JSON, затем подпишите УКЭП.</span>
            <Button
              variant="contained"
              disabled={busy || !rows.length}
              onClick={() => run(prepareBatch)}
            >
              Подготовить заказы ({rows.length})
            </Button>
          </div>
        </section>
      )}
      {(tab === 'documents' || tab === 'history') && (
        <section className="crpt-panel">
          <div className="crpt-panel-heading">
            <div>
              <h2>
                {tab === 'documents' ? 'Документы с полученными кодами' : 'Журнал операций СУЗ'}
              </h2>
              <p>
                {tab === 'documents'
                  ? 'Скачивание из архива не расходует новые коды. Получение не означает нанесение или ввод в оборот.'
                  : 'Здесь сохраняются также незавершённые и неподтверждённые запросы.'}
              </p>
            </div>
            <Button
              startIcon={<RefreshRounded />}
              disabled={busy}
              onClick={() => void history.refetch()}
            >
              Обновить
            </Button>
          </div>
          {history.isError && <Alert severity="error">{history.error.message}</Alert>}
          {history.isFetching && <LinearProgress />}
          <div className="crpt-table-wrap">
            <table className="crpt-table">
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Создан</th>
                  <th>Состояние</th>
                  <th>Кодов</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {receipts
                  .filter((x) => tab === 'history' || x.codesCount > 0)
                  .map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.name}</strong>
                        <small className="crpt-mono">{x.orderId ?? x.id}</small>
                        {x.blockId && <small>Блок: {x.blockId}</small>}
                        {x.message && <small>{x.message}</small>}
                      </td>
                      <td>{date(x.createdAtUtc)}</td>
                      <td>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={operationStatuses[x.state] ?? x.state}
                          color={
                            x.state === 'Accepted'
                              ? 'success'
                              : x.state === 'Prepared'
                                ? 'default'
                                : 'warning'
                          }
                        />
                      </td>
                      <td>{fmt(x.codesCount)}</td>
                      <td>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              const data = await suzApi.get(x.id);
                              if (data.state === 'Prepared' && data.body) {
                                setReview([data]);
                                setPreparationTotal(1);
                                setConfirmed(false);
                              } else setOpenedDocument(data);
                            })
                          }
                        >
                          Открыть
                        </Button>
                        {x.codesCount > 0 && (
                          <Button
                            disabled={busy}
                            startIcon={<DownloadRounded />}
                            onClick={() => run(async () => saveCsv(await suzApi.get(x.id)))}
                          >
                            CSV
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!history.isPending && !receipts.some((x) => tab === 'history' || x.codesCount > 0) && (
            <div className="crpt-empty">
              <Inventory2Outlined />
              <h3>Документов на этой странице нет</h3>
              <p>Получите коды из заказа или импортируйте файлы.</p>
            </div>
          )}
          <HistoryPaging
            page={historyPage}
            count={receipts.length}
            busy={history.isFetching}
            onPage={setHistoryPage}
          />
        </section>
      )}
      {tab === 'merge' && (
        <section className="crpt-panel">
          <div className="crpt-panel-heading">
            <div>
              <h2>Объединение файлов с кодами</h2>
              <p>Соберите коды из CSV, TXT, JSON и сохранённых документов в один документ.</p>
            </div>
          </div>
          <Alert severity="info">
            Исходные заказы в СУЗ остаются отдельными. Точные повторы кодов удаляются при
            сохранении. До 30 000 кодов в документе.
          </Alert>
          <div className="crpt-toolbar">
            <Button
              startIcon={<FileUploadOutlined />}
              disabled={busy}
              onClick={() => codeFiles.current?.click()}
            >
              Добавить файлы кодов
            </Button>
            <TextField
              size="small"
              label="Название документа"
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value)}
              inputProps={{ maxLength: 160 }}
            />
          </div>
          <input
            hidden
            ref={codeFiles}
            type="file"
            multiple
            accept=".csv,.txt,.json"
            aria-label="Файлы кодов СУЗ"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length)
                run(async () => {
                  if (files.reduce((n, f) => n + f.size, 0) > 8 * 1024 * 1024)
                    throw new Error('Общий размер файлов — до 8 МБ.');
                  const parsed = await Promise.all(
                    files.map(async (f) => ({
                      name: f.name,
                      codes: parseSuzCodes(await f.text()),
                    })),
                  );
                  setImports((prev) => [...prev, ...parsed]);
                });
            }}
          />
          <div className="crpt-suz-imports">
            {imports.map((x, i) => (
              <div key={i}>
                <span>
                  {x.name} · {fmt(x.codes.length)} кодов
                </span>
                <Button
                  disabled={busy}
                  onClick={() => setImports((prev) => prev.filter((_, index) => index !== i))}
                >
                  Убрать
                </Button>
              </div>
            ))}
          </div>
          <h3>Добавить из архива · страница {historyPage}</h3>
          {receipts
            .filter((x) => x.codesCount > 0)
            .map((x) => (
              <FormControlLabel
                key={x.id}
                control={
                  <Checkbox
                    disabled={busy}
                    checked={documentIds.includes(x.id)}
                    onChange={() => setDocumentIds((prev) => toggle(prev, x.id))}
                  />
                }
                label={`${x.name} · ${fmt(x.codesCount)} кодов`}
              />
            ))}
          <HistoryPaging
            page={historyPage}
            count={receipts.length}
            busy={history.isFetching}
            onPage={setHistoryPage}
          />
          <div className="crpt-panel-footer">
            <span>
              Файлов: {imports.length} · документов: {documentIds.length}
            </span>
            <Button
              variant="contained"
              disabled={busy || !archiveName.trim() || (!imports.length && !documentIds.length)}
              onClick={() =>
                run(async () => {
                  const payload = {
                    name: archiveName,
                    codes: imports.flatMap((x) => x.codes),
                    fileNames: imports.map((x) => x.name),
                    documentIds,
                  };
                  if (payload.codes.length > 30000) throw new Error('Выбрано больше 30 000 кодов.');
                  const key = JSON.stringify(payload);
                  const id =
                    archiveAttempt.current?.key === key
                      ? archiveAttempt.current.id
                      : crypto.randomUUID();
                  archiveAttempt.current = { key, id };
                  const result = await suzApi.archive({ requestId: id, ...payload });
                  setOpenedDocument(result);
                  setImports([]);
                  setDocumentIds([]);
                  archiveAttempt.current = null;
                  setMessage(result.message ?? 'Документ с кодами сохранён.');
                })
              }
            >
              Объединить и сохранить
            </Button>
          </div>
        </section>
      )}
      {tab === 'code-check' && (
        <div className="crpt-panel crpt-code-check">
          {groups.isError && (
            <Alert
              severity="warning"
              action={<Button onClick={() => void groups.refetch()}>Повторить</Button>}
            >
              Не удалось загрузить товарные группы.
            </Alert>
          )}
          <CodesCheckWorkspace companyId={companyId} productGroups={groups.data ?? []} />
        </div>
      )}
      {tab === 'help' && (
        <section className="crpt-panel crpt-suz-help">
          <h2>Как читать статусы</h2>
          <p>
            Заказ и буфер GTIN имеют отдельные состояния. Готовый заказ может содержать исчерпанный
            или отклонённый буфер.
          </p>
          <div className="crpt-suz-status-grid">
            <div>
              <h3>Заказ</h3>
              {Object.entries(orderStatuses).map(([id, text]) => (
                <p key={id}>
                  <code>{id}</code>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={text}
                    color={orderStatusColors[id] ?? 'default'}
                  />
                </p>
              ))}
            </div>
            <div>
              <h3>Буфер кодов</h3>
              {Object.entries(bufferStatuses).map(([id, text]) => (
                <p key={id}>
                  <code>{id}</code>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={text}
                    color={bufferStatusColors[id] ?? 'default'}
                  />
                </p>
              ))}
            </div>
          </div>
          <Alert severity="info">
            Повторное получение доступно для ранее выданных через API блоков открытого заказа с
            учётом ограничений СУЗ. Сначала обновите список блоков. Закрытие заказа прекращает
            дальнейшее получение кодов; перед подписью проверьте архив.
          </Alert>
          <p>
            Количество «Доступно» учитывает availableCodes из ответа СУЗ. При неизвестном результате
            отправки проверьте список заказов и блоков. Автоматической повторной отправки нет.
          </p>
          <Button
            component="a"
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.crpt.ru/gismt/files/pdf/API_%D0%A1%D0%A3%D0%97_3.0.pdf"
          >
            API СУЗ 3.0 · официальная документация
          </Button>
        </section>
      )}

      <Dialog
        open={!!review.length}
        onClose={() => {
          if (!busy) setReview([]);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Проверка и подписание · {environment === 'sandbox' ? 'песочница ЧЗ' : 'рабочий контур'}
        </DialogTitle>
        <DialogContent>
          <p>
            Подготовлено: {review.length} из {preparationTotal}.
          </p>
          {error && <Alert severity="error">{error}</Alert>}
          {review.length < preparationTotal && (
            <Button disabled={busy} onClick={() => run(prepareBatch)}>
              Повторить подготовку пакета
            </Button>
          )}
          <Alert severity="warning">
            {review.some((x) => x.kind === 'Close')
              ? 'Закрытие прекращает получение кодов по заказу. Проверьте, что нужные коды сохранены.'
              : 'После подписи запросы будут отправлены в выбранный контур Честного знака.'}
          </Alert>
          {review.map((x) => (
            <div key={x.id} className="crpt-suz-review">
              <strong>
                {x.name} · {operationStatuses[x.state] ?? x.state}
              </strong>
              <small className="crpt-mono">{x.orderId ?? x.id}</small>
              {x.body && (
                <pre className="crpt-xml">{JSON.stringify(JSON.parse(x.body), null, 2)}</pre>
              )}
              {x.message && <Alert severity="warning">{x.message}</Alert>}
            </div>
          ))}
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                disabled={busy}
                onChange={(_, checked) => setConfirmed(checked)}
              />
            }
            label="Параметры и контур проверены. Подтверждаю отправку с УКЭП."
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setReview([])}>
            Закрыть окно
          </Button>
          <Button
            variant="contained"
            disabled={
              busy ||
              !confirmed ||
              review.length !== preparationTotal ||
              !review.some((x) => x.state === 'Prepared')
            }
            onClick={() => run(sign)}
          >
            Подписать и отправить
          </Button>
        </DialogActions>
      </Dialog>
      {codesOrder && codesAvailable && (
        <Dialog
          open={true}
          onClose={() => {
            if (!busy) setCodesDialog(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {recovery ? 'Восстановить выданный блок' : 'Получить коды маркировки'}
          </DialogTitle>
          <DialogContent>
            {error && <Alert severity="error">{error}</Alert>}
            <p className="crpt-mono">{codesOrder?.orderId}</p>
            <div className="crpt-suz-dialog-fields">
              <TextField
                select
                label="GTIN заказа"
                value={codeProduct ? codeGtin : ''}
                disabled={busy}
                onChange={(e) => {
                  setCodeGtin(e.target.value);
                  setCodesQuantity(
                    initialCodesQuantity(
                      codesProducts.find((product) => product.gtin === e.target.value),
                    ),
                  );
                  setBlock('');
                  setBlocks([]);
                }}
              >
                {!codeProduct && (
                  <MenuItem value="" disabled>
                    Выберите GTIN
                  </MenuItem>
                )}
                {codesProducts.map((x) => (
                  <MenuItem key={x.gtin} value={x.gtin!}>
                    {x.gtin} ·{' '}
                    {recovery
                      ? (bufferStatuses[x.status ?? ''] ?? x.status)
                      : `доступно ${fmt(x.availableCodes)}`}
                  </MenuItem>
                ))}
              </TextField>
              {!recovery && (
                <TextField
                  label="Количество кодов"
                  value={quantity}
                  disabled={busy || !!block}
                  onChange={(e) => setCodesQuantity(e.target.value)}
                  inputProps={{ inputMode: 'numeric' }}
                  helperText={`Новая порция от 1 до ${fmt(maxQuantity)} кодов`}
                />
              )}
              <Button
                disabled={busy || !codeProduct}
                onClick={() =>
                  run(async () => {
                    const value = await suzApi.blocks(codesOrder.orderId, codeGtin);
                    const list = Array.isArray(value)
                      ? value
                      : ((value as { blocks?: unknown[] }).blocks ?? []);
                    setBlocks(list as typeof blocks);
                    setMessage(`Доступно блоков: ${list.length}`);
                  })
                }
              >
                Обновить выданные блоки
              </Button>
              <TextField
                select
                label="Получение кодов"
                value={block}
                disabled={busy || !codeProduct}
                onChange={(e) => setBlock(e.target.value)}
              >
                <MenuItem value="" disabled={recovery}>
                  {recovery ? 'Выберите выданный блок' : 'Новая порция кодов'}
                </MenuItem>
                {blocks.map((x) => (
                  <MenuItem key={x.blockId} value={x.blockId}>
                    Повторить блок {x.blockId} · {fmt(x.quantity)}
                  </MenuItem>
                ))}
              </TextField>
            </div>
            <Alert severity="info">
              Полученная порция сохранится в документах с кодами. Если результат запроса неизвестен,
              восстановите блок через список выданных блоков.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setCodesDialog(null)}>
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={busy || !codeProduct || (!block && (recovery || !validQuantity))}
              onClick={() =>
                run(async () => {
                  const payload = {
                    orderId: codesOrder.orderId,
                    gtin: codeGtin,
                    quantity: block ? 1 : Number(quantity),
                    ...(block ? { blockId: block } : {}),
                  };
                  const key = JSON.stringify(payload);
                  const id =
                    downloadAttempt.current?.key === key
                      ? downloadAttempt.current.id
                      : crypto.randomUUID();
                  downloadAttempt.current = { key, id };
                  const result = await suzApi.codes({ requestId: id, ...payload });
                  if (result.state === 'Accepted') {
                    downloadAttempt.current = null;
                    saveCsv(result);
                    setCodesDialog(null);
                    setMessage(`Сохранено кодов: ${result.codesCount}.`);
                  } else setError(result.message ?? 'Проверьте журнал и список выданных блоков.');
                })
              }
            >
              {recovery || block ? 'Восстановить блок' : 'Получить и сохранить'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog
        open={!!openedDocument}
        onClose={() => setOpenedDocument(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{openedDocument?.name}</DialogTitle>
        <DialogContent>
          <p>
            Состояние: {operationStatuses[openedDocument?.state ?? ''] ?? openedDocument?.state}.
            Кодов: {fmt(openedDocument?.codesCount)}
          </p>
          {openedDocument?.message && <Alert severity="warning">{openedDocument.message}</Alert>}
          <p className="crpt-mono">
            {openedDocument?.blockId ?? openedDocument?.orderId ?? openedDocument?.id}
          </p>
          <h3>Источники</h3>
          {openedDocument?.sources.map((x, i) => (
            <p key={i} className="crpt-mono">
              {x}
            </p>
          ))}
          <pre className="crpt-xml">
            {openedDocument?.codes
              ?.slice(0, 30)
              .map((x) => x.replaceAll('\x1d', '␝'))
              .join('\n')}
          </pre>
          {!!openedDocument?.codes?.length && (
            <p>
              Предпросмотр первых 30 кодов. В CSV сохраняются все коды и исходные разделители GS.
            </p>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenedDocument(null)}>Закрыть</Button>
          <Button
            disabled={!openedDocument?.codes?.length}
            onClick={() => openedDocument && saveCsv(openedDocument)}
          >
            Скачать CSV
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function OrderRows({
  order,
  selected,
  expanded,
  onSelect,
  onExpand,
  onCodes,
  onRecover,
  onClose,
  busy,
}: {
  order: SuzOrder;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onCodes: () => void;
  onRecover: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const exhausted = isSuzOrderExhausted(order);
  const receivable = getSuzReceivingProducts(order).length > 0;
  const recoverable = getSuzRecoveryProducts(order).length > 0;
  return (
    <>
      <tr>
        <td>
          <Checkbox
            checked={selected}
            onChange={onSelect}
            inputProps={{ 'aria-label': `Выбрать заказ ${order.orderId}` }}
          />
        </td>
        <td>
          <button className="crpt-suz-order-link" onClick={onExpand} aria-expanded={expanded}>
            {order.productionOrderId ?? order.orderId.slice(0, 8)}
          </button>
          <small className="crpt-mono">{order.orderId}</small>
          <small>
            {order.products.length === 1 ? order.products[0].gtin : `${order.products.length} GTIN`}
          </small>
        </td>
        <td>{date(order.createdAtUtc)}</td>
        <td>
          <div className="crpt-suz-statuses">
            <Chip
              size="small"
              variant="outlined"
              label={orderStatuses[order.status] ?? (order.status || 'Неизвестно')}
              color={orderStatusColors[order.status] ?? 'default'}
            />
            {exhausted && <Chip size="small" variant="outlined" label="Коды исчерпаны" />}
          </div>
          {order.declineReason && <small>{order.declineReason}</small>}
        </td>
        <td>{fmt(order.totalCodes)}</td>
        <td>{fmt(order.usedCodes)}</td>
        <td>{fmt(order.remainingCodes)}</td>
        <td>
          <div className="crpt-suz-row-actions">
            <Button size="small" disabled={busy || !receivable} onClick={onCodes}>
              Получить коды
            </Button>
            {!receivable && recoverable && (
              <Button size="small" disabled={busy} onClick={onRecover}>
                Восстановить выданный блок
              </Button>
            )}
            <Button
              size="small"
              disabled={busy || ['CLOSED', 'DECLINED'].includes(order.status)}
              onClick={onClose}
            >
              Закрыть заказ
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8}>
            <div className="crpt-suz-buffers">
              {order.products.map((p, i) => {
                const status = isSuzProductExhausted(p) ? 'EXHAUSTED' : (p.status ?? '');
                return (
                  <div key={i}>
                    <strong className="crpt-mono">{p.gtin}</strong>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={bufferStatuses[status] ?? (status || 'Неизвестно')}
                      color={bufferStatusColors[status] ?? 'default'}
                    />
                    <span>
                      Запрошено: {fmt(p.totalCodes)} · получено: {fmt(p.totalPassed)} · доступно:{' '}
                      {fmt(p.availableCodes)}
                    </span>
                    {p.cisType && (
                      <span>
                        Тип: {cisOptions[p.cisType as keyof typeof cisOptions] ?? p.cisType}
                      </span>
                    )}
                    {p.expiredAtUtc && <span>Срок: {date(p.expiredAtUtc)}</span>}
                    {p.rejectionReason && <Alert severity="error">{p.rejectionReason}</Alert>}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
function HistoryPaging({
  page,
  count,
  busy,
  onPage,
}: {
  page: number;
  count: number;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="crpt-panel-footer">
      <span>Страница {page} · до 50 операций</span>
      <div>
        <Button disabled={busy || page === 1} onClick={() => onPage(page - 1)}>
          Назад
        </Button>
        <Button disabled={busy || count < 50} onClick={() => onPage(page + 1)}>
          Далее
        </Button>
      </div>
    </div>
  );
}
