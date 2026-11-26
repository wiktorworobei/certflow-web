import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { CatalogErrorDetails } from '../marking/components/honest-sign/CatalogErrorDetails';
import { PRODUCT_GROUP_LABELS } from '../marking/components/honest-sign/constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../marking/components/ui/dialog';
import { cryptoProSignatureService } from '../marking/lib/honest-sign/cryptoProSignatureService';
import { participantsApiService } from '../marking/lib/honest-sign/participantsApiService';
import { assertMarkingScope, captureMarkingScope } from '../marking/lib/workspace-scope';
import { useAuthStore } from '../marking/src/store/auth';
import type { CrptEnvironment } from './environment';
import {
  allowedTurnoverTypes,
  hasStructuredTurnover,
  makeTurnoverDocument,
  needsTurnoverMetadata,
  parseTurnoverCodes,
  turnoverFields,
  turnoverNames,
  type TurnoverCodeInfo,
  type TurnoverFields,
  type TurnoverOperation,
  type TurnoverReceipt,
  type TurnoverState,
} from './turnover';
import { turnoverApi, type TurnoverJournalFilters, type TurnoverJournalSort } from './turnoverApi';

type Props = {
  companyId: string;
  environment: CrptEnvironment;
  selectedThumbprint: string;
  operation: TurnoverOperation;
  onUnsavedChange: (dirty: boolean) => void;
};
type ReceiptAction =
  | {
      kind: 'Submit';
      receipt: TurnoverReceipt;
    }
  | {
      kind: 'Refresh' | 'Read';
      id: string;
    }
  | {
      kind: 'Reconcile';
      id: string;
      externalId: string;
    };
const stateLabels: Record<TurnoverState, string> = {
  Prepared: 'Подготовлен',
  Sending: 'Отправляется',
  Submitted: 'На обработке в ЧЗ',
  Accepted: 'Обработан успешно',
  Rejected: 'Отклонён',
  OutcomeUnknown: 'Исход неизвестен',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
const journalDateFormat = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const defaultJournalFilters: TurnoverJournalFilters = { sort: 'newest' };
const journalSortOptions: Record<TurnoverJournalSort, string> = {
  newest: 'Сначала новые',
  oldest: 'Сначала старые',
  groupAsc: 'По коду группы (А–Я)',
  groupDesc: 'По коду группы (Я–А)',
};
const titleOf = (type: string) => turnoverNames[type] ?? type;
const groupName = (group: string) => PRODUCT_GROUP_LABELS[group] ?? group;
const normaliseThumbprint = (value: string) => value.replace(/[^a-f0-9]/gi, '').toUpperCase();
const receiptErrors: Record<string, string> = {
  'error.honest_sign_turnover_outcome_unknown':
    'Честный знак не подтвердил результат отправки. Сверьте документ по его идентификатору.',
  'error.honest_sign_upstream_rejected': 'Честный знак отклонил запрос.',
  'error.honest_sign_upstream_unavailable':
    'Не удалось получить ответ Честного знака. Проверьте статус позже.',
};
const receiptErrorText = (error: string) => receiptErrors[error] ?? error;

function TurnoverError({ error }: { error: Error | null }) {
  return (
    error && (
      <Alert severity="error">
        {error.message}
        <CatalogErrorDetails error={error} />
      </Alert>
    )
  );
}

function TurnoverStateBadge({ receipt }: { receipt: TurnoverReceipt }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={stateLabels[receipt.state] ?? receipt.state}
      color={
        receipt.state === 'Accepted'
          ? 'success'
          : receipt.state === 'Rejected'
            ? 'error'
            : 'default'
      }
    />
  );
}

export function CrptTurnoverWorkspace({
  companyId,
  environment,
  selectedThumbprint,
  operation,
  onUnsavedChange,
}: Props) {
  const client = useQueryClient();
  const authVersion = useAuthStore((state) => state.version);
  const [view, setView] = useState<'compose' | 'journal'>('compose');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [journalDraft, setJournalDraft] = useState(defaultJournalFilters);
  const [journalFilters, setJournalFilters] = useState(defaultJournalFilters);
  const [group, setGroup] = useState('');
  const [type, setType] = useState('');
  const [fields, setFields] = useState<TurnoverFields>({});
  const [codesText, setCodesText] = useState('');
  const [manualJson, setManualJson] = useState('');
  const [useJson, setUseJson] = useState(false);
  const [metadata, setMetadata] = useState<Map<string, TurnoverCodeInfo>>(new Map());
  const [staged, setStaged] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [externalId, setExternalId] = useState('');
  const [uncertainIds, setUncertainIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState(false);
  const attempt = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const autoChecks = useRef(new Map<string, number>());
  const submitting = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const assertScope = (scope: ReturnType<typeof captureMarkingScope>) => {
    assertMarkingScope(scope);
    if (!mounted.current || useAuthStore.getState().version !== authVersion)
      throw new Error('Сессия изменилась. Операция остановлена.');
  };

  const scopeKey = [
    'crpt-turnover',
    companyId,
    environment,
    authVersion,
    selectedThumbprint,
  ] as const;
  const ledgerKey = [...scopeKey, 'journal', operation] as const;
  const detailKey = (id: string | null) => [...scopeKey, 'detail', id] as const;
  const capabilities = useQuery({
    queryKey: [...scopeKey, 'capabilities'],
    queryFn: ({ signal }) => turnoverApi.capabilities(signal),
  });
  const groups = useQuery({
    queryKey: ['suz-groups', companyId, environment],
    queryFn: () => participantsApiService.getParticipantProductGroups(),
  });
  const ledger = useQuery({
    queryKey: [...ledgerKey, journalFilters, pageSize, page],
    queryFn: ({ signal }) =>
      turnoverApi.page(operation, page, signal, { ...journalFilters, pageSize }),
    enabled: view === 'journal',
  });
  const total = ledger.data?.total;
  const lastPage =
    total === undefined
      ? undefined
      : Math.max(1, Math.ceil(total / (ledger.data?.pageSize ?? pageSize)));
  useEffect(() => {
    if (lastPage !== undefined && page > lastPage) setPage(lastPage);
  }, [lastPage, page]);
  const details = useQuery({
    queryKey: detailKey(selectedId),
    queryFn: ({ signal }) => turnoverApi.get(selectedId!, signal),
    enabled: selectedId !== null,
    staleTime: 5_000,
  });
  const receipt = details.data;
  const caps = capabilities.data;
  const journalGroups = [
    ...new Set([
      ...Object.keys(PRODUCT_GROUP_LABELS),
      ...(groups.data ?? []),
      ...(caps?.productGroupRules?.map((rule) => rule.productGroup) ?? []),
      ...(ledger.data?.items.map((item) => item.productGroup) ?? []),
      ...(journalDraft.productGroup ? [journalDraft.productGroup] : []),
    ]),
  ].sort((left, right) => groupName(left).localeCompare(groupName(right), 'ru'));
  const journalTypes = caps
    ? caps.documentTypes
        .filter((item) => item.operation === operation)
        .map((item) => item.documentType)
    : Object.keys(turnoverNames).filter(
        (documentType) =>
          (operation === 'Withdrawal') === ['LK_RECEIPT', 'LK_GTIN_RECEIPT'].includes(documentType),
      );
  const invalidJournalDates = Boolean(
    journalDraft.dateFrom && journalDraft.dateTo && journalDraft.dateFrom > journalDraft.dateTo,
  );
  const journalFiltered = Object.entries(journalFilters).some(
    ([key, value]) => key !== 'sort' && Boolean(value),
  );
  const eligibleTypes = allowedTurnoverTypes(caps, group, operation);
  const selectedType = eligibleTypes.some((item) => item.documentType === type) ? type : '';
  const structured = hasStructuredTurnover(selectedType, group);
  const jsonMode = useJson || !structured;
  const metadataNeeded = needsTurnoverMetadata(selectedType, group) && !jsonMode;
  const dirty =
    !staged &&
    Boolean(codesText.trim() || manualJson.trim() || Object.values(fields).some(Boolean));
  useEffect(() => {
    onUnsavedChange(dirty);
    return () => onUnsavedChange(false);
  }, [dirty, onUnsavedChange]);

  const openReceipt = (id: string) => {
    setConfirmed(false);
    setExternalId('');
    setPreview(false);
    setSelectedId(id);
  };
  const storeReceipt = (next: TurnoverReceipt) => {
    client.setQueryData(detailKey(next.id), next);
    void client.invalidateQueries({ queryKey: ledgerKey });
  };
  const fileRead = useMutation({
    mutationFn: async ({
      file,
      maxBytes,
      json,
    }: {
      file: File;
      maxBytes: number;
      json: boolean;
    }) => {
      if (file.size > maxBytes) throw new Error('Файл превышает допустимый размер.');
      const scope = captureMarkingScope();
      let text: string;
      try {
        text = json
          ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
              await file.arrayBuffer(),
            )
          : await file.text();
      } catch {
        throw new Error('Не удалось прочитать файл в кодировке UTF-8.');
      }
      assertScope(scope);
      return { text, json };
    },
    onSuccess: ({ text, json }) => {
      if (json) {
        setManualJson(text);
        changed();
      } else {
        changeCodes(text);
      }
    },
  });
  const codeLookup = useMutation({
    mutationFn: async () => {
      const scope = captureMarkingScope();
      const codes = parseTurnoverCodes(codesText, caps!.maxCodes);
      const results = new Map<string, TurnoverCodeInfo>();
      for (let start = 0; start < codes.length; start += 1000) {
        const chunk = codes.slice(start, start + 1000);
        const expected = new Set(chunk);
        const response = await turnoverApi.metadata(chunk, group);
        assertScope(scope);
        for (const item of response) {
          if (!expected.has(item.requestedCode) || results.has(item.requestedCode))
            throw new Error('Честный знак вернул несопоставимые или повторяющиеся сведения о КИ.');
          if (
            (item.errorCode && item.errorCode !== '0') ||
            item.errorMessage ||
            item.cis !== item.requestedCode ||
            (item.productGroup && item.productGroup !== group)
          )
            throw new Error(
              item.errorMessage || 'Честный знак не подтвердил код в выбранной товарной группе.',
            );
          results.set(item.requestedCode, item);
        }
        if (chunk.some((code) => !results.has(code)))
          throw new Error('Честный знак вернул сведения не для всех КИ.');
      }
      return results;
    },
    onSuccess: setMetadata,
  });
  const prepare = useMutation({
    mutationFn: async () => {
      const scope = captureMarkingScope();
      if (!caps || !group || !selectedType)
        throw new Error('Выберите товарную группу и вид документа.');
      const documentJson = makeTurnoverDocument(
        caps,
        group,
        selectedType,
        fields,
        codesText,
        jsonMode ? manualJson : null,
        metadata,
      );
      if (new TextEncoder().encode(documentJson).length > caps.maxDocumentBytes)
        throw new Error('Документ превышает допустимый размер.');
      const fingerprint = JSON.stringify([group, selectedType, documentJson]);
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, requestId: crypto.randomUUID() };
      const result = await turnoverApi.prepare({
        requestId: attempt.current.requestId,
        productGroup: group,
        documentType: selectedType,
        documentJson,
      });
      assertScope(scope);
      return result;
    },
    onSuccess: (next) => {
      setStaged(true);
      storeReceipt(next);
      openReceipt(next.id);
    },
  });
  const receiptAction = useMutation({
    mutationFn: async (action: ReceiptAction) => {
      const scope = captureMarkingScope();
      let next: TurnoverReceipt;
      if (action.kind === 'Submit') {
        const prepared = action.receipt;
        if (
          prepared.state !== 'Prepared' ||
          !prepared.documentJson ||
          !confirmed ||
          !selectedThumbprint
        )
          throw new Error('Для подписи нужен подготовленный документ, подтверждение и сертификат.');
        if (
          prepared.certificateThumbprint &&
          normaliseThumbprint(prepared.certificateThumbprint) !==
            normaliseThumbprint(selectedThumbprint)
        )
          throw new Error(
            'Документ подготовлен с другим сертификатом. Подготовьте новый документ с текущим сертификатом.',
          );
        const signature = await cryptoProSignatureService.signDetached({
          thumbprint: selectedThumbprint,
          message: prepared.documentJson,
          cadesType: 'bes',
        });
        assertScope(scope);
        setUncertainIds((current) => new Set(current).add(prepared.id));
        next = await turnoverApi.submit(prepared.id, {
          payloadHash: prepared.payloadHash,
          signature: cryptoProSignatureService.normalizeDetachedSignature(signature.pkcs7),
          certificateThumbprint: selectedThumbprint,
        });
      } else if (action.kind === 'Reconcile') {
        next = await turnoverApi.reconcile(action.id, action.externalId);
      } else if (action.kind === 'Refresh') {
        next = await turnoverApi.refresh(action.id);
      } else {
        next = await turnoverApi.get(action.id);
      }
      assertScope(scope);
      return next;
    },
    onSuccess: (next) => {
      storeReceipt(next);
      setUncertainIds((current) => {
        if (!current.has(next.id)) return current;
        const remaining = new Set(current);
        remaining.delete(next.id);
        return remaining;
      });
      setConfirmed(false);
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const busy =
    fileRead.isPending || prepare.isPending || codeLookup.isPending || receiptAction.isPending;
  const runReceiptAction = (action: ReceiptAction) => {
    if (submitting.current || busy) return;
    submitting.current = true;
    receiptAction.mutate(action);
  };
  const canAutoRefresh = Boolean(
    receipt?.externalDocumentId &&
    !receipt.statusCheckError &&
    ['Submitted', 'Sending', 'OutcomeUnknown'].includes(receipt.state),
  );
  const refreshReceipt = receiptAction.mutate;
  useEffect(() => {
    if (!canAutoRefresh || !selectedId || busy || receiptAction.isError) return;
    const checks = autoChecks.current.get(selectedId) ?? 0;
    if (checks >= 6) return;
    const timer = window.setInterval(() => {
      if (document.hidden || submitting.current) return;
      autoChecks.current.set(selectedId, checks + 1);
      submitting.current = true;
      refreshReceipt({ kind: 'Refresh', id: selectedId });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [busy, canAutoRefresh, receiptAction.isError, refreshReceipt, selectedId]);

  const changed = () => {
    setStaged(false);
    if (fileRead.isError) fileRead.reset();
    if (prepare.isError) prepare.reset();
  };
  const setDocumentType = (next: string) => {
    setType(next);
    setFields({});
    setManualJson('');
    setUseJson(false);
    setMetadata(new Map());
    codeLookup.reset();
    changed();
  };
  const changeCodes = (text: string) => {
    setCodesText(text);
    setMetadata(new Map());
    codeLookup.reset();
    changed();
  };
  const canPrepare = Boolean(
    caps && group && selectedType && (jsonMode ? manualJson.trim() : codesText.trim()),
  );
  const editJournalFilter = <Key extends keyof TurnoverJournalFilters>(
    key: Key,
    value: TurnoverJournalFilters[Key],
  ) => setJournalDraft((previous) => ({ ...previous, [key]: value || undefined }));

  return (
    <section className="crpt-panel">
      <div className="crpt-panel-heading">
        <div>
          <h2>{operation === 'Introduction' ? 'Ввод в оборот' : 'Вывод из оборота'}</h2>
          {caps && <p>ИНН участника {caps.participantInn}</p>}
        </div>
      </div>
      <Tabs
        value={view}
        onChange={(_, value: 'compose' | 'journal') => setView(value)}
        aria-label="Документы оборота"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab value="compose" label="Подготовить документ" disabled={busy} />
        <Tab value="journal" label="Журнал документов" disabled={busy} />
      </Tabs>
      {view === 'compose' ? (
        <form
          className="space-y-4 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canPrepare && !busy) prepare.mutate();
          }}
        >
          {(capabilities.isPending || groups.isPending) && <LinearProgress />}
          <TurnoverError error={capabilities.error ?? groups.error} />
          {(capabilities.isError || groups.isError) && (
            <Button
              onClick={() => {
                if (capabilities.isError) void capabilities.refetch();
                if (groups.isError) void groups.refetch();
              }}
            >
              Повторить загрузку
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              select
              size="small"
              label="Товарная группа"
              value={group}
              disabled={busy || !caps}
              onChange={(event) => {
                const next = event.target.value;
                setGroup(next);
                const types = allowedTurnoverTypes(caps, next, operation);
                setDocumentType(types.length === 1 ? types[0].documentType : '');
              }}
            >
              <MenuItem value="">Выберите группу</MenuItem>
              {(groups.data ?? []).map((item) => (
                <MenuItem key={item} value={item}>
                  {groupName(item)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Вид документа"
              value={selectedType}
              disabled={busy || !group}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              <MenuItem value="">Выберите документ</MenuItem>
              {eligibleTypes.map((item) => (
                <MenuItem key={item.documentType} value={item.documentType}>
                  {titleOf(item.documentType)}
                </MenuItem>
              ))}
            </TextField>
          </div>
          {group && caps && !eligibleTypes.length && (
            <Alert severity="info">Для выбранной группы нет доступных видов документов.</Alert>
          )}
          {selectedType && caps && (
            <>
              {structured && (
                <FormControlLabel
                  label="Указать официальный JSON"
                  control={
                    <Checkbox
                      checked={useJson}
                      disabled={busy}
                      onChange={(_, value) => {
                        setUseJson(value);
                        changed();
                      }}
                    />
                  }
                />
              )}
              {jsonMode ? (
                <TextField
                  label="JSON документа"
                  value={manualJson}
                  onChange={(event) => {
                    setManualJson(event.target.value);
                    changed();
                  }}
                  disabled={busy}
                  fullWidth
                  multiline
                  minRows={8}
                  helperText="Передайте тело выбранного документа. Для вложенных упаковок укажите состав в JSON."
                />
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {turnoverFields(selectedType, group, caps, fields).map((spec) => (
                      <TextField
                        key={spec.key}
                        select={Boolean(spec.options)}
                        size="small"
                        label={spec.label}
                        value={fields[spec.key] ?? ''}
                        disabled={busy}
                        type={spec.type}
                        required={spec.required}
                        InputLabelProps={spec.type === 'date' ? { shrink: true } : undefined}
                        inputProps={{ maxLength: spec.maxLength }}
                        onChange={(event) => {
                          const value = event.target.value;
                          setFields((current) =>
                            spec.key === 'action'
                              ? { action: value, action_date: current.action_date ?? '' }
                              : { ...current, [spec.key]: value },
                          );
                          changed();
                        }}
                      >
                        {spec.options && [
                          <MenuItem key="" value="">
                            Выберите значение
                          </MenuItem>,
                          ...spec.options.map(([key, label]) => (
                            <MenuItem key={key} value={key}>
                              {label}
                            </MenuItem>
                          )),
                        ]}
                      </TextField>
                    ))}
                  </div>
                  <TextField
                    label={
                      selectedType === 'LK_GTIN_RECEIPT'
                        ? 'GTIN и количество'
                        : 'Коды идентификации'
                    }
                    value={codesText}
                    onChange={(event) => changeCodes(event.target.value)}
                    disabled={busy}
                    fullWidth
                    multiline
                    minRows={5}
                    helperText={
                      selectedType === 'LK_GTIN_RECEIPT'
                        ? 'Одна позиция на строку в формате GTIN;количество.'
                        : 'Один КИ на строку. У полного КМ часть после разделителя GS будет отброшена.'
                    }
                  />
                </>
              )}
              <div className="crpt-toolbar">
                <Button component="label" variant="outlined" disabled={busy}>
                  {jsonMode ? 'Загрузить JSON' : 'Загрузить CSV или TXT'}
                  <input
                    type="file"
                    accept={jsonMode ? '.json,application/json' : '.csv,.txt,text/csv,text/plain'}
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file && !busy)
                        fileRead.mutate({ file, maxBytes: caps.maxDocumentBytes, json: jsonMode });
                    }}
                  />
                </Button>
                {metadataNeeded && (
                  <Button
                    variant="outlined"
                    disabled={busy || !codesText.trim()}
                    onClick={() => codeLookup.mutate()}
                  >
                    Получить сведения о КИ
                  </Button>
                )}
              </div>
              <TurnoverError error={fileRead.error} />
              {metadataNeeded && (
                <>
                  <TurnoverError error={codeLookup.error} />
                  {metadata.size > 0 && (
                    <Alert severity="info">Получены сведения о КИ: {metadata.size}.</Alert>
                  )}
                </>
              )}
              <div className="crpt-toolbar">
                <Button type="submit" variant="contained" disabled={busy || !canPrepare}>
                  Подготовить к подписи
                </Button>
              </div>
            </>
          )}
          {busy && <LinearProgress />}
          <TurnoverError error={prepare.error} />
        </form>
      ) : (
        <section
          className="space-y-3 pt-4"
          aria-label={
            operation === 'Introduction' ? 'Журнал ввода в оборот' : 'Журнал вывода из оборота'
          }
        >
          <form
            className="space-y-3"
            aria-label="Фильтры журнала"
            onSubmit={(event) => {
              event.preventDefault();
              if (invalidJournalDates) return;
              setJournalFilters({
                ...journalDraft,
                externalStatus: journalDraft.externalStatus?.trim() || undefined,
                search: journalDraft.search?.trim() || undefined,
              });
              setPage(1);
            }}
          >
            <div className="crpt-filters">
              <TextField
                select
                size="small"
                label="Товарная группа"
                value={journalDraft.productGroup ?? ''}
                onChange={(event) => editJournalFilter('productGroup', event.target.value)}
              >
                <MenuItem value="">Все группы</MenuItem>
                {journalGroups.map((value) => (
                  <MenuItem key={value} value={value}>
                    {groupName(value)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Вид документа"
                value={journalDraft.documentType ?? ''}
                onChange={(event) => editJournalFilter('documentType', event.target.value)}
              >
                <MenuItem value="">Все виды</MenuItem>
                {journalTypes.map((value) => (
                  <MenuItem key={value} value={value}>
                    {titleOf(value)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Состояние документа"
                value={journalDraft.state ?? ''}
                onChange={(event) =>
                  editJournalFilter('state', event.target.value as TurnoverState)
                }
              >
                <MenuItem value="">Все состояния</MenuItem>
                {Object.entries(stateLabels).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Статус ЧЗ"
                value={journalDraft.externalStatus ?? ''}
                onChange={(event) => editJournalFilter('externalStatus', event.target.value)}
              />
              <TextField
                size="small"
                label="Идентификатор"
                placeholder="ID документа, операции или запроса"
                value={journalDraft.search ?? ''}
                onChange={(event) => editJournalFilter('search', event.target.value)}
              />
              <TextField
                type="date"
                size="small"
                label="Создан с (UTC)"
                InputLabelProps={{ shrink: true }}
                value={journalDraft.dateFrom ?? ''}
                onChange={(event) => editJournalFilter('dateFrom', event.target.value)}
                error={invalidJournalDates}
              />
              <TextField
                type="date"
                size="small"
                label="Создан по (UTC)"
                InputLabelProps={{ shrink: true }}
                value={journalDraft.dateTo ?? ''}
                onChange={(event) => editJournalFilter('dateTo', event.target.value)}
                error={invalidJournalDates}
              />
              <TextField
                select
                size="small"
                label="Сортировка"
                value={journalDraft.sort ?? 'newest'}
                onChange={(event) =>
                  editJournalFilter('sort', event.target.value as TurnoverJournalSort)
                }
              >
                {Object.entries(journalSortOptions).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </div>
            {invalidJournalDates && <Alert severity="error">Начальная дата позже конечной.</Alert>}
            <div className="crpt-toolbar">
              <Button type="submit" variant="contained" disabled={invalidJournalDates || busy}>
                Применить фильтры
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setJournalDraft(defaultJournalFilters);
                  setJournalFilters(defaultJournalFilters);
                  setPage(1);
                }}
              >
                Сбросить фильтры
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={busy || ledger.isFetching}
                onClick={() => void ledger.refetch()}
              >
                Обновить журнал
              </Button>
            </div>
          </form>
          {ledger.isFetching && <LinearProgress aria-label="Загрузка журнала" />}
          <TurnoverError error={ledger.error} />
          {ledger.isSuccess && ledger.data.items.length === 0 && (
            <p>
              {journalFiltered
                ? 'По выбранным фильтрам документов нет.'
                : 'В журнале пока нет документов.'}
            </p>
          )}
          {!!ledger.data?.items.length && (
            <div className="crpt-table-wrap">
              <table className="crpt-table">
                <thead>
                  <tr>
                    <th>Создан (UTC)</th>
                    <th>Вид документа</th>
                    <th>Товарная группа</th>
                    <th>Строки</th>
                    <th>Состояние</th>
                    <th>Статус ЧЗ</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="crpt-date">
                        {journalDateFormat.format(new Date(item.createdAtUtc))}
                      </td>
                      <td>{titleOf(item.documentType)}</td>
                      <td>{groupName(item.productGroup)}</td>
                      <td>{item.codesCount}</td>
                      <td>
                        <TurnoverStateBadge receipt={item} />
                      </td>
                      <td>{item.externalStatus || '—'}</td>
                      <td>
                        <Button
                          size="small"
                          disabled={busy}
                          onClick={() => {
                            receiptAction.reset();
                            openReceipt(item.id);
                          }}
                        >
                          {item.state === 'Prepared' ? 'Продолжить' : 'Открыть'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="crpt-pagination">
            <span aria-live="polite">
              {total === undefined ? '' : `Документов: ${total} · `}
              Страница {ledger.data?.page ?? page}
              {lastPage !== undefined ? ` из ${lastPage}` : ''}
            </span>
            <div>
              <TextField
                select
                size="small"
                label="На странице"
                value={pageSize}
                disabled={busy}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[20, 50, 100].map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                aria-label="Предыдущая страница журнала"
                disabled={busy || page === 1 || ledger.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                Назад
              </Button>
              <Button
                aria-label="Следующая страница журнала"
                disabled={busy || !ledger.data?.hasNextPage || ledger.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Далее
              </Button>
            </div>
          </div>
        </section>
      )}
      <Dialog
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelectedId(null);
        }}
      >
        <DialogContent className="crpt-editor-dialog sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {receipt ? titleOf(receipt.documentType) : 'Документ оборота'}
            </DialogTitle>
            <DialogDescription>
              {receipt
                ? `${groupName(receipt.productGroup)} · ИНН ${receipt.participantInn}`
                : 'Квитанция документа Честного знака'}
            </DialogDescription>
          </DialogHeader>
          {(details.isFetching || receiptAction.isPending) && <LinearProgress />}
          <TurnoverError error={details.error ?? receiptAction.error} />
          {details.isError && (
            <Button onClick={() => void details.refetch()}>Повторить загрузку</Button>
          )}
          {receipt && (
            <div className="space-y-3">
              <div className="crpt-toolbar">
                <TurnoverStateBadge receipt={receipt} />
                <span>Строк: {receipt.codesCount}</span>
              </div>
              <p className="break-all">ID операции: {receipt.id}</p>
              {receipt.requestId && <p className="break-all">ID запроса: {receipt.requestId}</p>}
              {receipt.externalDocumentId && (
                <p className="break-all">ID документа ЧЗ: {receipt.externalDocumentId}</p>
              )}
              {receipt.externalStatus && <p>Статус ЧЗ: {receipt.externalStatus}</p>}
              {receipt.lastCheckedAtUtc && (
                <p>Проверено: {dateFormat.format(new Date(receipt.lastCheckedAtUtc))}</p>
              )}
              {receipt.error && <Alert severity="error">{receiptErrorText(receipt.error)}</Alert>}
              {receipt.statusCheckError && (
                <Alert severity="warning">{receiptErrorText(receipt.statusCheckError)}</Alert>
              )}
              {uncertainIds.has(receipt.id) && (
                <Alert severity="warning">
                  Не удалось получить ответ об отправке. Перечитайте квитанцию.
                  <Button
                    disabled={busy}
                    onClick={() => runReceiptAction({ kind: 'Read', id: receipt.id })}
                  >
                    Перечитать квитанцию
                  </Button>
                </Alert>
              )}
              {receipt.state === 'Prepared' &&
                receipt.documentJson &&
                !uncertainIds.has(receipt.id) && (
                  <>
                    <Button
                      variant="outlined"
                      onClick={() => setPreview((value) => !value)}
                      aria-expanded={preview}
                    >
                      {preview ? 'Скрыть JSON' : 'Показать JSON для подписи'}
                    </Button>
                    {preview && (
                      <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs">
                        {receipt.documentJson}
                      </pre>
                    )}
                    <FormControlLabel
                      label="Проверил документ. Подтверждаю подписание и отправку в Честный знак."
                      control={
                        <Checkbox
                          checked={confirmed}
                          disabled={busy || details.isFetching || details.isError}
                          onChange={(_, value) => setConfirmed(value)}
                        />
                      }
                    />
                    {!selectedThumbprint && (
                      <Alert severity="info">Подключите сертификат для подписи.</Alert>
                    )}
                    <div>
                      <Button
                        variant="contained"
                        disabled={
                          !confirmed ||
                          !selectedThumbprint ||
                          busy ||
                          details.isFetching ||
                          details.isError
                        }
                        onClick={() => runReceiptAction({ kind: 'Submit', receipt })}
                      >
                        Подписать и отправить
                      </Button>
                    </div>
                  </>
                )}
              {receipt.externalDocumentId && (
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={() => {
                    autoChecks.current.delete(receipt.id);
                    runReceiptAction({ kind: 'Refresh', id: receipt.id });
                  }}
                >
                  Проверить статус в ЧЗ
                </Button>
              )}
              {!receipt.externalDocumentId &&
                ['Sending', 'OutcomeUnknown'].includes(receipt.state) && (
                  <div className="space-y-2">
                    <TextField
                      size="small"
                      fullWidth
                      label="ID документа из Честного знака"
                      value={externalId}
                      disabled={busy}
                      onChange={(event) => setExternalId(event.target.value)}
                    />
                    <Button
                      variant="outlined"
                      disabled={busy || !externalId.trim()}
                      onClick={() =>
                        runReceiptAction({
                          kind: 'Reconcile',
                          id: receipt.id,
                          externalId: externalId.trim(),
                        })
                      }
                    >
                      Сверить документ
                    </Button>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
