import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CatalogCardWorkflow } from '../marking/components/honest-sign/CatalogCardWorkflow';
import { CatalogErrorDetails } from '../marking/components/honest-sign/CatalogErrorDetails';
import { CatalogSubmissionAttempts } from '../marking/components/honest-sign/CatalogSubmissionAttempts';
import { CatalogSubmissionHistory } from '../marking/components/honest-sign/CatalogSubmissionHistory';
import { Notice } from '../marking/components/honest-sign/ui/notice';
import { Select } from '../marking/components/honest-sign/ui/select';
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
import { Badge } from '../marking/components/ui/badge';
import { Button } from '../marking/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../marking/components/ui/dialog';
import { Skeleton } from '../marking/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../marking/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../marking/components/ui/tabs';
import {
  useCatalogProductGroups,
  useCatalogSubmissionHistorySession,
} from '../marking/hooks/use-honest-sign-catalog';
import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import { useAuthStore } from '../marking/src/store/auth';

const groups = {
  all: 'Все события',
  'catalog-cards': 'Карточки товаров',
  orders: 'Заказы СУЗ',
  codes: 'Коды маркировки',
  gtin: 'GTIN',
  utilisation: 'Отчёты о нанесении',
  documents: 'Документы ЧЗ',
  'catalog-reference': 'Справочники НК',
  permits: 'Разрешительные документы',
  access: 'Доступ к карточкам',
  connection: 'Подключение',
  other: 'Другие операции',
} as const;

const operations: Record<string, string> = {
  'auth.challenge': 'Запрос для входа',
  'auth.sign-in.client': 'Вход в СУЗ',
  'auth.sign-in.bearer': 'Вход в ГИС МТ',
  'connectivity.ping': 'Проверка соединения',
  'participants.product-groups': 'Товарные группы участника',
  'catalog.products': 'Список карточек',
  'catalog.products.search': 'Поиск карточек',
  'catalog.product': 'Сведения о карточке',
  'catalog.product.public': 'Проверка публичных карточек',
  'catalog.feed.create': 'Создание карточки',
  'catalog.feed.update': 'Изменение карточки',
  'catalog.feed.status': 'Статус заявки по карточке',
  'catalog.feed.status.summary': 'Краткий статус заявки по карточке',
  'catalog.moderation': 'Отправка карточки на модерацию',
  'catalog.signing-data': 'Подготовка карточки к подписанию',
  'catalog.sign': 'Подписание карточки',
  'catalog.suz-product': 'Сведения о товаре для заказа',
  'catalog.gtin.generate': 'Создание GTIN',
  'catalog.gtin.existing': 'Список присвоенных GTIN',
  'catalog.categories': 'Категории товаров',
  'catalog.attributes': 'Характеристики категории',
  'catalog.brands': 'Список товарных знаков',
  'catalog.countries': 'Справочник стран',
  'catalog.dictionary': 'Значения справочника',
  'catalog.permits': 'Поиск разрешительных документов',
  'catalog.product-permits': 'Разрешительные документы по GTIN',
  'catalog.linked-accounts': 'Список субаккаунтов',
  'catalog.linked-accounts.prepare': 'Подготовка изменения доступа',
  'catalog.linked-accounts.sign': 'Изменение доступа к карточкам',
  'orders.create': 'Создание заказа',
  'orders.search': 'Поиск заказов',
  'orders.status': 'Статус заказа',
  'orders.codes': 'Получение кодов',
  'orders.codes.retry': 'Повторное получение блока',
  'orders.blocks': 'Список блоков заказа',
  'orders.close': 'Закрытие заказа',
  'codes.check': 'Проверка кодов',
  'codes.info': 'Сведения о кодах',
  'documents.create': 'Отправка документа',
  'documents.search': 'Поиск документов',
  'documents.details': 'Сведения о документе',
  'documents.reconcile': 'Сверка документа',
  'reports.utilisation.submit': 'Отправка отчёта о нанесении',
  'reports.utilisation.status': 'Статус отчёта о нанесении',
};

const providerLabels: Record<string, string> = {
  'national-catalog': 'Национальный каталог',
  markirovka: 'ГИС МТ',
  suz: 'СУЗ',
};
const outcomeLabels = {
  Pending: 'Обращение начато',
  Received: 'Ответ получен',
  Rejected: 'Запрос отклонён',
  Unknown: 'Исход неизвестен',
};

type ProviderEvent = {
  id: string;
  group: string;
  provider: string;
  operation: string;
  method: string;
  outcome: keyof typeof outcomeLabels;
  httpStatus: number | null;
  providerStatus: string | null;
  errorCode: string | null;
  reference: string | null;
  createdAtUtc: string;
  completedAtUtc: string | null;
};
type EventPage = { items: ProviderEvent[]; operations?: string[]; hasNextPage: boolean };

const eventTime = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Moscow',
});
const operationLabel = (code: string) => operations[code] ?? code;
const cardReadOperations = new Set([
  'catalog.products',
  'catalog.products.search',
  'catalog.product',
  'catalog.product.public',
]);
const cardStatuses = new Set([
  'draft',
  'errors',
  'moderation',
  'notsigned',
  'published',
  'archived',
]);

function translatedCardStatus(item: ProviderEvent, t: TFunction) {
  if (!item.providerStatus || !cardReadOperations.has(item.operation)) return null;
  const statuses = item.providerStatus.split(',').map((status) => status.trim());
  const labels = statuses.map((status) => {
    const key = status.toLowerCase();
    return cardStatuses.has(key) ? t(`honestSign.catalog.workflow.cardStates.${key}`) : status;
  });
  return labels.some((label, index) => label !== statuses[index]) ? labels.join(', ') : null;
}

export function CrptCatalogJournal({
  companyId,
  selectedThumbprint = '',
  onUnsavedChange,
}: {
  companyId: string;
  selectedThumbprint?: string;
  onUnsavedChange?: (dirty: boolean) => void;
}) {
  const actorVersion = useAuthStore((state) => state.version);
  const { t } = useTranslation();
  const operationFilterId = useId();
  const [group, setGroup] = useState('all');
  const [operation, setOperation] = useState('');
  const [page, setPage] = useState(1);
  const journal = useQuery({
    queryKey: ['honest-sign', companyId, actorVersion, 'events', group, operation, page],
    queryFn: async ({ signal }) => {
      try {
        return (
          await apiClient.get<EventPage>('/api/honest-sign/events', {
            signal,
            params: {
              group: group === 'all' ? undefined : group,
              operation: operation || undefined,
              page,
            },
          })
        ).data;
      } catch (error) {
        throw toHttpError('Не удалось загрузить историю событий.', error);
      }
    },
    enabled: Boolean(companyId),
    retry: false,
    refetchOnMount: 'always',
  });
  const items = journal.data?.items ?? [];
  const choices = [
    ...new Set([...(journal.data?.operations ?? items.map((item) => item.operation)), operation]),
  ]
    .filter(Boolean)
    .sort((a, b) => operationLabel(a).localeCompare(operationLabel(b), 'ru'));

  return (
    <section className="min-w-0 space-y-4 p-4 md:p-6" aria-label="История событий Честного знака">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">История событий</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={journal.isFetching}
          onClick={() => void journal.refetch()}
        >
          <RefreshCw className="size-4" aria-hidden="true" /> Обновить события
        </Button>
      </div>
      <Tabs
        value={group}
        onValueChange={(value) => {
          setGroup(value);
          setOperation('');
          setPage(1);
        }}
      >
        <TabsList
          aria-label="Группы событий"
          className="w-full flex-wrap justify-start gap-1 group-data-[orientation=horizontal]/tabs:h-auto"
        >
          {Object.entries(groups).map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="min-h-9 flex-none">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={group} className="min-w-0 space-y-4 pt-2">
          {(choices.length > 0 || operation) && (
            <div className="max-w-sm space-y-1 text-sm">
              <label className="font-medium" htmlFor={operationFilterId}>
                Операция
              </label>
              <Select
                id={operationFilterId}
                value={operation}
                onChange={(event) => {
                  setOperation(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Все операции группы</option>
                {choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {operationLabel(choice)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {journal.isError ? (
            <Notice variant="error" role="alert">
              {journal.error.message}
            </Notice>
          ) : journal.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">В выбранной группе пока нет событий.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время (МСК)</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead>Результат запроса</TableHead>
                  <TableHead>Статус ЧЗ</TableHead>
                  <TableHead>Идентификатор</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const statusLabel = translatedCardStatus(item, t);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <time dateTime={item.createdAtUtc}>
                          {eventTime.format(new Date(item.createdAtUtc))}
                        </time>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{operationLabel(item.operation)}</div>
                        <div className="text-xs text-muted-foreground">
                          {group === 'all' &&
                            `${groups[item.group as keyof typeof groups] ?? groups.other} · `}
                          {providerLabels[item.provider] ?? item.provider}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.outcome === 'Rejected' ? 'destructive' : 'outline'}>
                          {outcomeLabels[item.outcome]}
                        </Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.method}
                          {item.httpStatus !== null && ` · HTTP ${item.httpStatus}`}
                        </div>
                        {item.errorCode && (
                          <div className="text-xs text-muted-foreground">{item.errorCode}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-56 break-words whitespace-normal">
                        {statusLabel && <div>{statusLabel}</div>}
                        <span className={statusLabel ? 'text-xs text-muted-foreground' : undefined}>
                          {item.providerStatus ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.reference ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {(page > 1 || journal.data?.hasNextPage) && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || journal.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">Страница {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!journal.data?.hasNextPage || journal.isFetching}
                onClick={() => setPage(page + 1)}
              >
                Далее
              </Button>
            </div>
          )}
          {group === 'catalog-cards' && (
            <SavedCardSubmissions
              companyId={companyId}
              selectedThumbprint={selectedThumbprint}
              onUnsavedChange={onUnsavedChange}
              onSubmitted={() => void journal.refetch()}
            />
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function SavedCardSubmissions({
  companyId,
  selectedThumbprint,
  onUnsavedChange,
  onSubmitted,
}: {
  companyId: string;
  selectedThumbprint: string;
  onUnsavedChange?: (dirty: boolean) => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{
    id: string;
    mode: 'card' | 'retry' | 'attempts';
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const workflow = selected && selected.mode !== 'attempts' ? selected : null;
  const groups = useCatalogProductGroups(companyId, Boolean(workflow));
  const session = useCatalogSubmissionHistorySession(
    companyId,
    Boolean(workflow && !selectedThumbprint),
  );
  const expiry = session.data?.honestSignSessionExpiresAtUtc;
  const sessionThumbprint =
    session.isSuccess &&
    session.data.hasHonestSignSession &&
    (!expiry || Date.parse(expiry) > Date.now())
      ? session.data.certificateThumbprint
      : null;
  useEffect(() => {
    onUnsavedChange?.(dirty);
    if (!dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      onUnsavedChange?.(false);
    };
  }, [dirty, onUnsavedChange]);

  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else setSelected(null);
  };

  return (
    <div>
      <CatalogSubmissionHistory
        companyId={companyId}
        onOpen={(id, retry) => setSelected({ id, mode: retry ? 'retry' : 'card' })}
        onOpenAttempts={(id) => setSelected({ id, mode: 'attempts' })}
      />
      <Dialog open={selected !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent
          className={`max-h-[90dvh] overflow-y-auto ${workflow ? 'sm:max-w-5xl' : 'sm:max-w-4xl'}`}
        >
          <DialogHeader>
            <DialogTitle>{workflow ? 'Карточка товара' : 'Отправки карточки'}</DialogTitle>
            <DialogDescription>
              {workflow
                ? t('honestSign.catalog.title')
                : 'Сохранённые результаты обработки в выбранном контуре.'}
            </DialogDescription>
          </DialogHeader>
          {workflow && groups.isError && (
            <Notice variant="error" role="alert">
              <p>{groups.error.message}</p>
              <CatalogErrorDetails error={groups.error} />
              <Button variant="outline" size="sm" onClick={() => void groups.refetch()}>
                {t('honestSign.catalog.retry')}
              </Button>
            </Notice>
          )}
          {workflow ? (
            <CatalogCardWorkflow
              key={workflow.id}
              companyId={companyId}
              submissionId={workflow.id}
              selectedThumbprint={selectedThumbprint || sessionThumbprint || ''}
              productGroups={groups.data}
              showTitle={false}
              initialEditorOpen={workflow.mode === 'retry'}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              onSubmitted={onSubmitted}
            />
          ) : (
            selected && (
              <CatalogSubmissionAttempts
                key={selected.id}
                companyId={companyId}
                submissionId={selected.id}
              />
            )
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            keepEditing.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('honestSign.catalog.products.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('honestSign.catalog.products.discardDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={keepEditing}>
              {t('honestSign.catalog.products.keepEditing')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDirty(false);
                setSelected(null);
                setDiscard(false);
              }}
            >
              {t('honestSign.catalog.products.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
