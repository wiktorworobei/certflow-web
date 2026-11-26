import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import { RefreshRounded } from '@mui/icons-material';
import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import type { CrptEnvironment } from './environment';

type Operation = {
  operationId: string;
  operationType: string;
  operationDate: number;
  docId: string | null;
  state: string | null;
  description: string | null;
  processed: number | null;
  total: number | null;
};
type Receipt = {
  resultDocId: string;
  resultDocDate: number;
  sourceDocId: string;
  state: string;
  description: string | null;
  workflow: string | null;
  details: { orderId: string | null; utilisationType: string | null } | null;
  operations: Operation[];
};
type ReceiptPage = { results: Receipt[]; totalCount: number; hasNextPage: boolean };
type CodeResult = { cis: string; code: number; description: string | null };
type Props = { companyId: string; environment: CrptEnvironment; initialReceiptId: string | null };

const base = '/api/honest-sign/reports/receipts';
const workflows = {
  REPORT_UTILIZE: 'Отчёты о нанесении',
  CREATE_ORDER: 'Создание заказов',
  GET_CODES: 'Получение кодов',
  CLOSE_ORDER: 'Закрытие заказов',
  REPORT_DROPOUT: 'Вывод из оборота в СУЗ',
  REPORT_AGGREGATION: 'Агрегация',
  REPORT_QUALITY: 'Контроль качества',
  ANNULMENT_CODES: 'Аннулирование кодов',
};
const states: Record<string, string> = {
  SUCCESS: 'Выполнено',
  FAILED: 'Ошибка обработки',
  IN_PROGRESS: 'В обработке',
  PARTIALLY: 'Частично выполнено',
};
const operations: Record<string, string> = {
  RNMS_GIS_ROUTED: 'Передано в ГИС МТ',
  RNMS_GIS_PROCESSED: 'Обработано ГИС МТ',
};
const date = (value: number) =>
  value > 0 && Number.isFinite(value) ? new Date(value).toLocaleString('ru-RU') : '—';
const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
const validId = (value: string) =>
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && /[1-9a-f]/i.test(value);

async function read<T>(
  path: string,
  signal: AbortSignal,
  params?: Record<string, string | number>,
) {
  try {
    return (await apiClient.get<T>(path, { params, signal })).data;
  } catch (error) {
    throw toHttpError('Не удалось получить квитанции СУЗ.', error);
  }
}

export function CrptSuzReceipts({ companyId, environment, initialReceiptId }: Props) {
  const scope = ['crpt-suz-receipts', companyId, environment];
  const [workflow, setWorkflow] = useState('REPORT_UTILIZE');
  const [state, setState] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [lookupId, setLookupId] = useState(initialReceiptId ?? '');
  const [receiptId, setReceiptId] = useState(
    initialReceiptId && validId(initialReceiptId) ? initialReceiptId : '',
  );
  const [operationId, setOperationId] = useState('');
  const [codePage, setCodePage] = useState(0);
  const datesValid =
    (!dateFrom && !dateTo) ||
    (!!dateFrom &&
      !!dateTo &&
      day(dateTo) >= day(dateFrom) &&
      day(dateTo) - day(dateFrom) <= 6 * 86400000);
  const list = useQuery({
    queryKey: [...scope, 'list', workflow, state, dateFrom, dateTo, page],
    queryFn: ({ signal }) =>
      read<ReceiptPage>(base, signal, {
        workflow,
        ...(state && { state }),
        ...(dateFrom && { dateFrom, dateTo }),
        limit: 20,
        page,
      }),
    enabled: datesValid,
  });
  const receiptPath = `${base}/${encodeURIComponent(receiptId)}`;
  const detail = useQuery({
    queryKey: [...scope, 'receipt', receiptId],
    queryFn: ({ signal }) => read<Receipt[]>(receiptPath, signal),
    enabled: !!receiptId,
  });
  const codes = useQuery({
    queryKey: [...scope, 'codes', receiptId, operationId],
    queryFn: ({ signal }) =>
      read<CodeResult[]>(
        `${receiptPath}/operations/${encodeURIComponent(operationId)}/codes`,
        signal,
      ),
    enabled: !!receiptId && !!operationId,
  });
  function open(id: string) {
    setOperationId('');
    setCodePage(0);
    setReceiptId(id);
  }
  const receiptRows = list.data?.results ?? [];
  const codeRows = codes.data ?? [];

  return (
    <section className="crpt-panel">
      <div className="crpt-panel-heading">
        <div>
          <h2>Квитанции СУЗ</h2>
          <p>История обработки отчётов и заказов из СУЗ, включая документы из других приложений.</p>
        </div>
        <Button
          startIcon={<RefreshRounded />}
          disabled={list.isFetching || !datesValid}
          onClick={() => void list.refetch()}
        >
          Обновить
        </Button>
      </div>
      <div className="crpt-toolbar crpt-suz-filters">
        <TextField
          select
          size="small"
          label="Операция"
          value={workflow}
          onChange={(event) => {
            setWorkflow(event.target.value);
            setPage(1);
          }}
        >
          {Object.entries(workflows).map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Результат"
          value={state}
          onChange={(event) => {
            setState(event.target.value);
            setPage(1);
          }}
        >
          <MenuItem value="">Все результаты</MenuItem>
          {Object.entries(states).map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="date"
          label="С даты"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="По дату"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
        />
      </div>
      <form
        className="crpt-toolbar crpt-document-lookup"
        onSubmit={(event) => {
          event.preventDefault();
          if (validId(lookupId.trim())) open(lookupId.trim());
        }}
      >
        <TextField
          size="small"
          label="Идентификатор квитанции"
          value={lookupId}
          onChange={(event) => setLookupId(event.target.value)}
          inputProps={{ maxLength: 40 }}
        />
        <Button type="submit" variant="outlined" disabled={!validId(lookupId.trim())}>
          Найти квитанцию
        </Button>
      </form>
      {!datesValid && (
        <Alert severity="warning">
          Укажите обе даты. Можно выбрать период до семи календарных дней.
        </Alert>
      )}
      {list.isFetching && <LinearProgress />}
      {list.isError && <Alert severity="error">{list.error.message}</Alert>}
      {list.isSuccess && !receiptRows.length && (
        <Alert severity="info">По выбранным условиям квитанций нет.</Alert>
      )}
      {receiptRows.length > 0 && (
        <div className="crpt-table-wrap">
          <table className="crpt-table">
            <thead>
              <tr>
                <th>Квитанция</th>
                <th>Получена</th>
                <th>Результат</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {receiptRows.map((item) => (
                <tr key={item.resultDocId}>
                  <td>
                    <div className="crpt-mono">{item.resultDocId}</div>
                    <small>{item.details?.orderId ?? item.sourceDocId}</small>
                  </td>
                  <td>{date(item.resultDocDate)}</td>
                  <td>
                    <ReceiptState state={item.state} />
                    {item.description && <small>{item.description}</small>}
                  </td>
                  <td>
                    <Button onClick={() => open(item.resultDocId)}>Открыть</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(list.data || page > 1) && (
        <div className="crpt-pagination">
          <span>
            Страница {page}
            {list.data && ` · найдено около ${list.data.totalCount}`}
          </span>
          <div>
            <Button disabled={page === 1 || list.isFetching} onClick={() => setPage(page - 1)}>
              Назад
            </Button>
            <Button
              disabled={!list.data?.hasNextPage || list.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Далее
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!receiptId} onClose={() => open('')} fullWidth maxWidth="md">
        <DialogTitle>Квитанция СУЗ</DialogTitle>
        <DialogContent>
          <p className="crpt-mono">{receiptId}</p>
          {detail.isFetching && <LinearProgress />}
          {detail.isError && <Alert severity="error">{detail.error.message}</Alert>}
          {detail.isSuccess && !detail.data.length && (
            <Alert severity="info">СУЗ ещё не вернула события этой квитанции.</Alert>
          )}
          {detail.data?.map((item, index) => (
            <section className="crpt-document-report" key={`${item.resultDocId}:${index}`}>
              <div className="crpt-toolbar">
                <ReceiptState state={item.state} />
                <span>{date(item.resultDocDate)}</span>
              </div>
              {item.description && <p>{item.description}</p>}
              {item.operations.length > 0 && (
                <div className="crpt-table-wrap">
                  <table className="crpt-table">
                    <thead>
                      <tr>
                        <th>Событие</th>
                        <th>Дата</th>
                        <th>Результат</th>
                        <th>Коды</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.operations.map((operation) => (
                        <tr key={operation.operationId}>
                          <td>{operations[operation.operationType] ?? operation.operationType}</td>
                          <td>{date(operation.operationDate)}</td>
                          <td>
                            {operation.state && (states[operation.state] ?? operation.state)}
                            {operation.description && <small>{operation.description}</small>}
                          </td>
                          <td>
                            {operation.total !== null && (
                              <span>
                                {operation.processed ?? 0} / {operation.total}
                              </span>
                            )}
                            {operation.docId && operation.operationType in operations && (
                              <Button
                                onClick={() => {
                                  setOperationId(operation.operationId);
                                  setCodePage(0);
                                }}
                              >
                                Результаты по КИ
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
          {operationId && (
            <section className="crpt-document-report">
              <h3>Результаты обработки кодов идентификации</h3>
              {codes.isFetching && <LinearProgress />}
              {codes.isError && (
                <Alert
                  severity="error"
                  action={<Button onClick={() => void codes.refetch()}>Повторить</Button>}
                >
                  {codes.error.message}
                </Alert>
              )}
              {codes.isSuccess && !codeRows.length && (
                <p>В связанном документе нет результатов по кодам.</p>
              )}
              {!!codeRows.length && (
                <div className="crpt-table-wrap">
                  <table className="crpt-table">
                    <thead>
                      <tr>
                        <th>КИ</th>
                        <th>Код результата</th>
                        <th>Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codeRows.slice(codePage * 50, (codePage + 1) * 50).map((item, index) => (
                        <tr key={`${item.cis}:${index}`}>
                          <td className="crpt-mono">{item.cis}</td>
                          <td>{item.code}</td>
                          <td>{item.description ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="crpt-pagination">
                    <span>
                      Кодов {codeRows.length} · страница {codePage + 1}
                    </span>
                    <div>
                      <Button disabled={!codePage} onClick={() => setCodePage(codePage - 1)}>
                        Назад
                      </Button>
                      <Button
                        disabled={(codePage + 1) * 50 >= codeRows.length}
                        onClick={() => setCodePage(codePage + 1)}
                      >
                        Далее
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={detail.isFetching} onClick={() => void detail.refetch()}>
            Обновить квитанцию
          </Button>
          <Button onClick={() => open('')}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}

function ReceiptState({ state }: { state: string }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={states[state] ?? state}
      color={
        state === 'SUCCESS'
          ? 'success'
          : state === 'FAILED'
            ? 'error'
            : state === 'PARTIALLY'
              ? 'warning'
              : 'default'
      }
    />
  );
}
