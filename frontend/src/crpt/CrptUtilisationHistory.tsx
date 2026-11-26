import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Chip, LinearProgress, MenuItem, TextField } from '@mui/material';
import { RefreshRounded } from '@mui/icons-material';
import { PRODUCT_GROUP_LABELS } from '../marking/components/honest-sign/constants';
import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import { isSuzReceiptId } from './CrptSuzReceipts';
import type { CrptEnvironment } from './environment';

type HistoryRow = {
  id: string;
  reportId: string | null;
  source: string;
  kind: string;
  productGroup: string | null;
  codesCount: number | null;
  providerStatus: string | null;
  status: string;
  errorReason: string | null;
  fileName: string | null;
  createdAtUtc: string;
  lastCheckedAtUtc: string | null;
  statusCheckError: string | null;
};

type HistoryPage = {
  items: HistoryRow[];
  totalCount: number;
  hasNextPage: boolean;
};
type Props = {
  companyId: string;
  environment: CrptEnvironment;
  productGroups: string[];
  onOpenReceipt: (reportId: string) => void;
};

const endpoint = '/api/honest-sign/reports/utilisation/history';
const sourceLabels: Record<string, string> = {
  Single: 'Одиночный',
  Batch: 'Из пакета',
  Special: 'Особый',
};
const kindLabels: Record<string, string> = {
  UTILISATION: 'Нанесение',
  RESORT: 'Пересорт',
  DIVISIONMARK: 'Нанесение после разделения',
  REMARK: 'Перемаркировка',
  SPLITMARK: 'Нанесение после расформирования набора',
};
const statusLabels: Record<string, string> = {
  SUCCESS: 'Выполнен',
  FAILED: 'Ошибка обработки',
  PARTIALLY: 'Частично выполнен',
  DRAFT: 'Черновик в СУЗ',
  PENDING: 'Ожидает обработки',
  READY_TO_SEND: 'Готов к отправке',
  SENT: 'Передан на обработку',
  CHECK: 'Проверяются данные',
  IN_PROGRESS: 'В обработке',
  SUBMITTED: 'Отправлен в СУЗ',
  PREPARED: 'Подготовлен',
  QUEUED: 'В очереди',
  SENDING: 'Отправляется',
  REJECTED: 'Отклонён',
  SKIPPED_REJECTED: 'Пропущен после отклонения',
  SKIPPED_UNKNOWN: 'Пропущен из-за неопределённого результата',
  UNKNOWN: 'Статус не подтверждён',
};
const sorting = {
  newest: 'Сначала новые',
  oldest: 'Сначала старые',
  groupAsc: 'По названию группы (А–Я)',
  groupDesc: 'По названию группы (Я–А)',
};
const initialFilters = {
  reportId: '',
  productGroup: '',
  source: '',
  kind: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  sort: 'newest',
  limit: 20,
};
const formatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const dateLabel = (value: string) => formatter.format(new Date(value));

export const utilisationHistoryKey = (companyId: string, environment: CrptEnvironment) =>
  ['crpt-utilisation-history', companyId, environment] as const;

export const utilisationStatusKey = (
  companyId: string,
  environment: CrptEnvironment,
  reportId?: string,
) => ['crpt-utilisation-status', companyId, environment, reportId] as const;

export const utilisationStatusLabel = (status: string) =>
  statusLabels[status.toUpperCase()] ?? status;

function statusColor(status: string) {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return 'success';
    case 'FAILED':
    case 'REJECTED':
      return 'error';
    case 'PARTIALLY':
    case 'SKIPPED_REJECTED':
    case 'SKIPPED_UNKNOWN':
    case 'UNKNOWN':
      return 'warning';
    case 'SUBMITTED':
    case 'PENDING':
    case 'READY_TO_SEND':
    case 'SENT':
    case 'CHECK':
    case 'IN_PROGRESS':
    case 'SENDING':
      return 'info';
    default:
      return 'default';
  }
}

export function CrptUtilisationHistory({
  companyId,
  environment,
  productGroups,
  onOpenReceipt,
}: Props) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const scope = utilisationHistoryKey(companyId, environment);
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: [...scope, filters, page],
    queryFn: async ({ signal }) => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== ''),
      );
      try {
        return (await apiClient.get<HistoryPage>(endpoint, { params: { ...params, page }, signal }))
          .data;
      } catch (error) {
        throw toHttpError('Не удалось загрузить историю отчётов.', error);
      }
    },
  });
  const refresh = useMutation({
    mutationFn: async (id: string) => {
      try {
        return (await apiClient.post<HistoryRow>(`${endpoint}/${encodeURIComponent(id)}/refresh`))
          .data;
      } catch (error) {
        throw toHttpError('Не удалось проверить статус отчёта в СУЗ.', error);
      }
    },
    onSuccess: async (item) => {
      if (
        item.source === 'Single' &&
        item.reportId &&
        item.providerStatus &&
        !item.statusCheckError
      ) {
        client.setQueryData(utilisationStatusKey(companyId, environment, item.reportId), {
          reportId: item.reportId,
          status: item.providerStatus,
          errorReason: item.errorReason,
        });
      }
      await client.invalidateQueries({ queryKey: scope });
    },
  });
  const items = list.data?.items ?? [];
  const total = list.data?.totalCount ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / filters.limit));
  const groupLabel = (group: string) =>
    t(`honestSign.productGroups.${group}`, {
      defaultValue: PRODUCT_GROUP_LABELS[group] ?? group,
    });
  const groupOptions = Array.from(
    new Set([
      ...productGroups,
      ...items.flatMap((item) => item.productGroup ?? []),
      draft.productGroup,
    ]),
  )
    .filter(Boolean)
    .map((group) => ({ value: group, label: groupLabel(group) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'ru'));
  const invalidDates = !!draft.dateFrom && !!draft.dateTo && draft.dateFrom > draft.dateTo;
  const setFilter = (name: keyof Omit<typeof initialFilters, 'limit'>, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }));

  return (
    <section
      className="crpt-document-report crpt-utilisation-history"
      aria-labelledby="crpt-utilisation-history-title"
    >
      <div className="crpt-history-heading">
        <h3 id="crpt-utilisation-history-title">История отчётов о нанесении</h3>
        <Button
          startIcon={<RefreshRounded />}
          disabled={list.isFetching}
          onClick={() => void list.refetch()}
        >
          Обновить историю
        </Button>
      </div>
      <form
        className="crpt-filters"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidDates) return;
          setPage(1);
          setFilters({ ...draft, reportId: draft.reportId.trim() });
        }}
      >
        <TextField
          className="crpt-search"
          size="small"
          label="ID отчёта"
          value={draft.reportId}
          onChange={(event) => setFilter('reportId', event.target.value)}
          inputProps={{ maxLength: 100 }}
        />
        <TextField
          size="small"
          select
          label="Товарная группа"
          value={draft.productGroup}
          onChange={(event) => setFilter('productGroup', event.target.value)}
        >
          <MenuItem value="">Все группы</MenuItem>
          {groupOptions.map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Источник"
          value={draft.source}
          onChange={(event) => setFilter('source', event.target.value)}
        >
          <MenuItem value="">Все источники</MenuItem>
          {Object.entries(sourceLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Тип отчёта"
          value={draft.kind}
          onChange={(event) => setFilter('kind', event.target.value)}
        >
          <MenuItem value="">Все типы</MenuItem>
          {Object.entries(kindLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Статус"
          value={draft.status}
          onChange={(event) => setFilter('status', event.target.value)}
        >
          <MenuItem value="">Все статусы</MenuItem>
          {Object.entries(statusLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="date"
          label="Создан с (UTC)"
          value={draft.dateFrom}
          onChange={(event) => setFilter('dateFrom', event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="Создан по (UTC)"
          value={draft.dateTo}
          error={invalidDates}
          onChange={(event) => setFilter('dateTo', event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          select
          label="Сортировка"
          value={draft.sort}
          onChange={(event) => setFilter('sort', event.target.value)}
        >
          {Object.entries(sorting).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <div className="crpt-toolbar">
          <Button type="submit" variant="outlined" disabled={invalidDates}>
            Применить
          </Button>
          <Button
            onClick={() => {
              setDraft(initialFilters);
              setFilters(initialFilters);
              setPage(1);
            }}
          >
            Сбросить
          </Button>
        </div>
      </form>
      {invalidDates && (
        <Alert severity="warning">Дата окончания должна быть не раньше даты начала.</Alert>
      )}
      {list.isFetching && <LinearProgress aria-label="Загрузка истории отчётов" />}
      {list.isError && <Alert severity="error">{list.error.message}</Alert>}
      {refresh.isError && <Alert severity="error">{refresh.error.message}</Alert>}
      {refresh.data?.statusCheckError && (
        <Alert severity="warning">{refresh.data.statusCheckError}</Alert>
      )}
      {list.data && items.length === 0 && (
        <p role="status">
          {page > lastPage
            ? 'Эта страница больше недоступна.'
            : 'Отчёты по выбранным условиям не найдены.'}
        </p>
      )}
      {items.length > 0 && (
        <div className="crpt-table-wrap">
          <table className="crpt-table" aria-label="Поданные отчёты о нанесении">
            <thead>
              <tr>
                <th scope="col">Отчёт / ID</th>
                <th scope="col">Товарная группа</th>
                <th scope="col">Создан (UTC)</th>
                <th scope="col">Кодов</th>
                <th scope="col">Статус</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ reportId, ...item }) => (
                <tr key={item.id}>
                  <td>
                    {kindLabels[item.kind] ?? item.kind} ·{' '}
                    {sourceLabels[item.source] ?? item.source}
                    <small className="crpt-mono" title={reportId ? 'ID в СУЗ' : 'ID записи'}>
                      {reportId ?? item.id}
                    </small>
                    {item.fileName && <small>{item.fileName}</small>}
                  </td>
                  <td>{item.productGroup ? groupLabel(item.productGroup) : '—'}</td>
                  <td className="crpt-date">{dateLabel(item.createdAtUtc)}</td>
                  <td>{item.codesCount ?? '—'}</td>
                  <td>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={statusColor(item.status)}
                      label={utilisationStatusLabel(item.status)}
                      title={item.providerStatus ?? undefined}
                    />
                    {item.errorReason && <small>{item.errorReason}</small>}
                    {item.lastCheckedAtUtc && (
                      <small>Проверено {dateLabel(item.lastCheckedAtUtc)}</small>
                    )}
                    {item.statusCheckError && <small>{item.statusCheckError}</small>}
                  </td>
                  <td>
                    {reportId && (
                      <div className="crpt-toolbar">
                        <Button
                          size="small"
                          disabled={refresh.isPending}
                          onClick={() => refresh.mutate(item.id)}
                        >
                          Проверить статус
                        </Button>
                        {isSuzReceiptId(reportId) && (
                          <Button size="small" onClick={() => onOpenReceipt(reportId)}>
                            Квитанция СУЗ
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="crpt-pagination">
        <span aria-live="polite">{list.data && `Найдено отчётов: ${total}`}</span>
        <div>
          <TextField
            size="small"
            select
            label="На странице"
            value={filters.limit}
            onChange={(event) => {
              const limit = Number(event.target.value);
              setDraft((current) => ({ ...current, limit }));
              setFilters((current) => ({ ...current, limit }));
              setPage(1);
            }}
          >
            {[10, 20, 50, 100].map((limit) => (
              <MenuItem key={limit} value={limit}>
                {limit}
              </MenuItem>
            ))}
          </TextField>
          <Button
            disabled={page <= 1 || list.isFetching}
            onClick={() => setPage(Math.min(page - 1, lastPage))}
          >
            Назад
          </Button>
          <span>
            Страница {page}
            {list.data ? ` из ${lastPage}` : ''}
          </span>
          <Button
            disabled={!list.data?.hasNextPage || list.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </Button>
        </div>
      </div>
    </section>
  );
}
