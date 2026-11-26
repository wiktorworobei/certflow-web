import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import { PRODUCT_GROUP_LABELS } from '../marking/components/honest-sign/constants';
import { normalizeDataMatrixCode } from '../marking/lib/honest-sign/codeNormalization';
import { cryptoProSignatureService } from '../marking/lib/honest-sign/cryptoProSignatureService';
import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import { assertMarkingScope, captureMarkingScope } from '../marking/lib/workspace-scope';
import type { CrptEnvironment } from './environment';
import { turnoverApi } from './turnoverApi';
import type { TurnoverReceipt } from './turnover';

const kinds = {
  RESORT: { label: 'Пересорт', groups: ['beer'] },
  DIVISIONMARK: { label: 'Нанесение после разделения', groups: ['radio'] },
  REMARK: { label: 'Перемаркировка', groups: ['chemistry'] },
  SPLITMARK: {
    label: 'Нанесение после расформирования набора',
    groups: ['chemistry', 'radio', 'toys'],
  },
};
type Kind = keyof typeof kinds;
type SpecialReceipt = Omit<TurnoverReceipt, 'operation'> & { operation: 'SuzReport' };
type Props = {
  companyId: string;
  environment: CrptEnvironment;
  productGroups: string[];
  selectedThumbprint: string;
  onUnsavedChange: (dirty: boolean) => void;
};
const labels: Record<string, string> = {
  Prepared: 'Подготовлен',
  Sending: 'Отправляется',
  Submitted: 'Передан в СУЗ',
  Accepted: 'Обработан',
  Rejected: 'Отклонён',
  OutcomeUnknown: 'Результат отправки неизвестен',
};
const allowed = (kind: Kind, productGroups: string[]) =>
  kinds[kind].groups.filter((group) => productGroups.includes(group));
function readCodes(text: string) {
  const codes = text
    .trim()
    .split(/\r\n|\r|\n/)
    .map(normalizeDataMatrixCode);
  if (codes.some((code) => !code)) throw new Error('Уберите пустые строки между кодами.');
  return codes;
}

function requireSpecial(receipt: TurnoverReceipt): SpecialReceipt {
  if (receipt.operation !== 'SuzReport') throw new Error('Документ принадлежит другой операции.');
  return { ...receipt, operation: 'SuzReport' };
}

async function read<T>(
  path: string,
  signal?: AbortSignal,
  params?: Record<string, string | number>,
) {
  try {
    return (await apiClient.get<T>(path, { signal, params })).data;
  } catch (error) {
    throw toHttpError('Не удалось получить отчёты СУЗ.', error);
  }
}

export function CrptSuzSpecialReports({
  companyId,
  environment,
  productGroups,
  selectedThumbprint,
  onUnsavedChange,
}: Props) {
  const client = useQueryClient();
  const [kind, setKind] = useState<Kind>(
    () =>
      (Object.keys(kinds) as Kind[]).find((x) => allowed(x, productGroups).length) ?? 'SPLITMARK',
  );
  const eligibleGroups = allowed(kind, productGroups);
  const [groupValue, setGroup] = useState('');
  const group = eligibleGroups.includes(groupValue) ? groupValue : (eligibleGroups[0] ?? '');
  const [newCodes, setNewCodes] = useState('');
  const [oldCodes, setOldCodes] = useState('');
  const [inn, setInn] = useState('');
  const [locationValue, setLocation] = useState('');
  const [page, setPage] = useState(1);
  const [receipt, setReceipt] = useState<SpecialReceipt | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const prepareAttempt = useRef<{ body: string; requestId: string } | null>(null);
  const journalKey = ['crpt-suz-special', companyId, environment];
  const journal = useQuery({
    queryKey: [...journalKey, page],
    queryFn: ({ signal }) =>
      read<{ items: SpecialReceipt[]; hasNextPage: boolean }>('/api/honest-sign/turnover', signal, {
        operation: 'SuzReport',
        page,
      }),
  });
  const capabilities = useQuery({
    queryKey: ['crpt-turnover-capabilities', companyId, environment],
    queryFn: ({ signal }) => turnoverApi.capabilities(signal),
  });
  const effectiveInn = inn || capabilities.data?.participantInn || '';
  const dirty = Boolean(newCodes || oldCodes || locationValue || inn);
  useEffect(() => onUnsavedChange(dirty), [onUnsavedChange, dirty]);

  const task = useMutation({
    mutationFn: async (
      action: { type: 'prepare' } | { type: 'open' | 'sign' | 'refresh'; id: string },
    ) => {
      const scope = captureMarkingScope();
      if (action.type === 'prepare') {
        const newRows = readCodes(newCodes);
        const oldRows = readCodes(oldCodes);
        if (
          !group ||
          !newRows.length ||
          newRows.length > 30_000 ||
          newRows.length !== oldRows.length
        )
          throw new Error(
            'Укажите товарную группу и одинаковое количество новых и исходных кодов. В отчёте допустимо до 30 000 пар.',
          );
        if ([...newRows, ...oldRows].some((code) => code.includes('\x1e')))
          throw new Error('Введите исходные и новые коды в отдельные поля.');
        const participantRequired = kind === 'RESORT' || kind === 'SPLITMARK';
        if (participantRequired && !/^(?:\d{10}|\d{12})$/.test(effectiveInn.trim()))
          throw new Error('Укажите ИНН участника.');
        if (kind === 'RESORT' && !locationValue.trim())
          throw new Error('Укажите КПП или идентификатор ФИАС.');
        const attributes = participantRequired
          ? {
              participantId: effectiveInn.trim(),
              ...(kind === 'RESORT'
                ? effectiveInn.trim().length === 10
                  ? { kpp: locationValue.trim() }
                  : { fiasId: locationValue.trim() }
                : {}),
            }
          : undefined;
        const documentJson = JSON.stringify({
          productGroup: group,
          utilisationType: kind,
          sntins: newRows.map((code, index) => `${code}\x1e${oldRows[index]}`),
          ...(attributes && { attributes }),
        });
        if (prepareAttempt.current?.body !== documentJson)
          prepareAttempt.current = { body: documentJson, requestId: crypto.randomUUID() };
        try {
          return (
            await apiClient.post<SpecialReceipt>(
              '/api/honest-sign/suz/reports/prepare',
              {
                requestId: prepareAttempt.current.requestId,
                productGroup: group,
                kind,
                documentJson,
              },
              { timeout: 120_000 },
            )
          ).data;
        } catch (error) {
          throw toHttpError('Не удалось подготовить отчёт СУЗ.', error);
        }
      }
      if (action.type === 'refresh') return requireSpecial(await turnoverApi.refresh(action.id));
      const current = requireSpecial(await turnoverApi.get(action.id));
      assertMarkingScope(scope);
      if (action.type === 'open' || current.state !== 'Prepared') return current;
      if (
        !confirmed ||
        !receipt ||
        current.payloadHash !== receipt.payloadHash ||
        current.documentJson !== receipt.documentJson ||
        !current.documentJson ||
        !selectedThumbprint ||
        current.certificateThumbprint?.toUpperCase() !== selectedThumbprint.toUpperCase()
      ) {
        throw new Error(
          'Отчёт или сертификат изменился. Откройте отчёт заново и подтвердите подпись.',
        );
      }
      const signature = await cryptoProSignatureService.signDetached({
        thumbprint: selectedThumbprint,
        message: current.documentJson,
        cadesType: 'bes',
      });
      assertMarkingScope(scope);
      return requireSpecial(
        await turnoverApi.submit(current.id, {
          payloadHash: current.payloadHash,
          signature: cryptoProSignatureService.normalizeDetachedSignature(signature.pkcs7),
          certificateThumbprint: selectedThumbprint,
        }),
      );
    },
    onSuccess: (result, action) => {
      setReceipt(result);
      setConfirmed(false);
      if (action.type === 'prepare') {
        setNewCodes('');
        setOldCodes('');
        setLocation('');
        setInn('');
      }
      void client.invalidateQueries({ queryKey: journalKey });
      void client.invalidateQueries({ queryKey: ['crpt-suz-receipts', companyId, environment] });
    },
  });
  const busy = task.isPending;

  return (
    <section className="crpt-panel">
      <div className="crpt-panel-heading">
        <div>
          <h2>Особые отчёты о нанесении</h2>
          <p>Вставьте по одному коду на строку. Строки с одинаковыми номерами образуют пару.</p>
        </div>
      </div>
      <div className="crpt-suz-fields">
        <TextField
          size="small"
          select
          label="Вид отчёта"
          value={kind}
          disabled={busy}
          onChange={(event) => {
            setKind(event.target.value as Kind);
            setGroup('');
            setLocation('');
            task.reset();
          }}
        >
          {Object.entries(kinds).map(([key, value]) => (
            <MenuItem key={key} value={key} disabled={!allowed(key as Kind, productGroups).length}>
              {value.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Товарная группа"
          value={group}
          disabled={busy || !eligibleGroups.length}
          onChange={(event) => setGroup(event.target.value)}
        >
          <MenuItem value="" disabled>
            Выберите группу
          </MenuItem>
          {eligibleGroups.map((item) => (
            <MenuItem key={item} value={item}>
              {PRODUCT_GROUP_LABELS[item] ?? item}
            </MenuItem>
          ))}
        </TextField>
        {(kind === 'RESORT' || kind === 'SPLITMARK') && (
          <TextField
            size="small"
            label="ИНН участника"
            value={effectiveInn}
            disabled={busy}
            onChange={(event) => setInn(event.target.value)}
          />
        )}
        {kind === 'RESORT' && (
          <TextField
            size="small"
            label={effectiveInn.length === 12 ? 'Идентификатор ФИАС' : 'КПП'}
            value={locationValue}
            disabled={busy}
            onChange={(event) => setLocation(event.target.value)}
          />
        )}
      </div>
      <div className="crpt-suz-dialog-fields">
        <TextField
          multiline
          minRows={3}
          maxRows={8}
          label="Новые полные коды маркировки"
          value={newCodes}
          disabled={busy}
          onChange={(event) => setNewCodes(event.target.value)}
        />
        <TextField
          multiline
          minRows={3}
          maxRows={8}
          label={
            kind === 'RESORT' || kind === 'DIVISIONMARK'
              ? 'Исходные полные коды маркировки'
              : 'Исходные коды идентификации'
          }
          value={oldCodes}
          disabled={busy}
          onChange={(event) => setOldCodes(event.target.value)}
        />
      </div>
      {!group && (
        <Alert severity="info">Для подключённых товарных групп этот вид отчёта недоступен.</Alert>
      )}
      {task.isError && !receipt && <Alert severity="error">{task.error.message}</Alert>}
      <Button
        variant="contained"
        disabled={busy || !group || !newCodes.trim() || !oldCodes.trim()}
        onClick={() => task.mutate({ type: 'prepare' })}
      >
        Подготовить отчёт
      </Button>
      {journal.isFetching && <LinearProgress />}
      {journal.isError && (
        <Alert
          severity="error"
          action={<Button onClick={() => void journal.refetch()}>Повторить</Button>}
        >
          {journal.error.message}
        </Alert>
      )}
      {!!journal.data?.items.length && (
        <div className="crpt-document-report">
          <h3>Журнал специальных отчётов</h3>
          <div className="crpt-table-wrap">
            <table className="crpt-table">
              <thead>
                <tr>
                  <th>Отчёт</th>
                  <th>Группа</th>
                  <th>Пар кодов</th>
                  <th>Состояние</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {journal.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{kinds[item.documentType as Kind]?.label ?? item.documentType}</td>
                    <td>{PRODUCT_GROUP_LABELS[item.productGroup] ?? item.productGroup}</td>
                    <td>{item.codesCount}</td>
                    <td>{labels[item.state] ?? item.state}</td>
                    <td>
                      <Button
                        disabled={busy}
                        onClick={() => task.mutate({ type: 'open', id: item.id })}
                      >
                        Открыть
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {(page > 1 || journal.data?.hasNextPage) && (
        <div className="crpt-pagination">
          <span>Страница {page}</span>
          <div>
            <Button disabled={page <= 1 || journal.isFetching} onClick={() => setPage(page - 1)}>
              Назад
            </Button>
            <Button
              disabled={!journal.data?.hasNextPage || journal.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Далее
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!receipt}
        onClose={
          busy
            ? undefined
            : () => {
                setReceipt(null);
                task.reset();
              }
        }
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {receipt?.state === 'Prepared'
            ? 'Проверка и подписание отчёта СУЗ'
            : 'Состояние отчёта СУЗ'}
        </DialogTitle>
        {receipt && (
          <DialogContent>
            <p>
              {labels[receipt.state] ?? receipt.state}
              {receipt.externalStatus && ` · ${receipt.externalStatus}`}
            </p>
            {receipt.externalDocumentId && (
              <p className="crpt-mono">{receipt.externalDocumentId}</p>
            )}
            {receipt.error && <Alert severity="warning">{receipt.error}</Alert>}
            {receipt.statusCheckError && (
              <Alert severity="warning">{receipt.statusCheckError}</Alert>
            )}
            {receipt.state === 'OutcomeUnknown' && (
              <Alert severity="warning">
                Проверьте результат в разделе «Квитанции СУЗ» по типу операции и датам.
              </Alert>
            )}
            {task.isError && <Alert severity="error">{task.error.message}</Alert>}
            {receipt.state === 'Prepared' && receipt.documentJson && (
              <>
                <pre className="crpt-document-json">{receipt.documentJson}</pre>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={confirmed}
                      disabled={busy}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                  }
                  label="Проверил отчёт и подтверждаю подписание и отправку в СУЗ"
                />
              </>
            )}
            {busy && <LinearProgress />}
          </DialogContent>
        )}
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setReceipt(null);
              task.reset();
            }}
          >
            Закрыть
          </Button>
          {receipt?.state === 'Prepared' && (
            <Button
              variant="contained"
              disabled={busy || !confirmed}
              onClick={() => task.mutate({ type: 'sign', id: receipt.id })}
            >
              Подписать и отправить
            </Button>
          )}
          {receipt?.externalDocumentId && (
            <Button
              disabled={busy}
              onClick={() => task.mutate({ type: 'refresh', id: receipt.id })}
            >
              Обновить статус
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </section>
  );
}
