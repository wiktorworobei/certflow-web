import { useRef, useState } from 'react';
import { Alert, Button, Chip, LinearProgress } from '@mui/material';
import {
  AddRounded,
  DownloadRounded,
  UploadFileRounded,
  DeleteOutlineRounded,
  SendRounded,
  SaveOutlined,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CatalogCardRequest } from '../marking/lib/honest-sign/catalogTypes';
import { catalogApiService } from '../marking/lib/honest-sign/catalogApiService';
import { catalogKeys } from '../marking/hooks/use-honest-sign-catalog';
import { captureCrptEnvironment, assertCrptEnvironment } from './environment';
import { crptApi, type BulkResult } from './api';
import { cardColumns, cardsToRows, exportSheet, importCards, readSheet } from './spreadsheet';

export function CrptBatchPanel({
  companyId,
  cards,
  onChange,
  onAdd,
  onBusyChange,
}: {
  companyId: string;
  cards: CatalogCardRequest[];
  onChange: (cards: CatalogCardRequest[]) => void;
  onAdd: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, BulkResult>>({});
  const [delivery, setDelivery] = useState<Record<string, string>>({});
  const [processed, setProcessed] = useState(0);
  const save = useMutation({
    mutationFn: async () => {
      const scope = captureCrptEnvironment();
      onBusyChange(true);
      try {
        const pending = cards.filter((card) => !results[card.requestId]?.submission);
        const receipt = await crptApi.bulkDrafts(pending);
        assertCrptEnvironment(scope);
        setResults((current) => ({
          ...current,
          ...Object.fromEntries(receipt.map((result, i) => [pending[i].requestId, result])),
        }));
        await client.invalidateQueries({ queryKey: catalogKeys.all(companyId) });
      } finally {
        onBusyChange(false);
      }
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      const scope = captureCrptEnvironment();
      onBusyChange(true);
      setProcessed(0);
      try {
        for (const card of cards) {
          assertCrptEnvironment(scope);
          const saved = results[card.requestId]?.submission;
          if (!saved || delivery[card.requestId]) continue;
          try {
            const receipt = await catalogApiService.sendDraft(saved.id, saved.draftVersion);
            assertCrptEnvironment(scope);
            setDelivery((current) => ({
              ...current,
              [card.requestId]:
                receipt.state === 'Accepted'
                  ? 'Принят НК · ожидает обработки'
                  : receipt.state === 'Rejected'
                    ? 'Отклонён НК'
                    : 'Результат требует сверки в журнале',
            }));
          } catch (e) {
            assertCrptEnvironment(scope);
            setDelivery((current) => ({
              ...current,
              [card.requestId]: `${e instanceof Error ? e.message : 'Ошибка отправки'}. Проверьте журнал перед повторной отправкой.`,
            }));
          }
          setProcessed((value) => value + 1);
        }
        await client.invalidateQueries({ queryKey: catalogKeys.all(companyId) });
      } finally {
        onBusyChange(false);
      }
    },
  });
  const busy = save.isPending || send.isPending;
  const remaining = cards.filter((card) => !results[card.requestId]?.submission).length;
  const toSend = cards.filter(
    (card) => results[card.requestId]?.submission && !delivery[card.requestId],
  ).length;
  return (
    <section className="crpt-panel">
      <div className="crpt-panel-heading">
        <div>
          <h2>Массовое создание карточек</h2>
          <p>
            До 500 карточек в пакете. Подготовьте данные, сохраните черновики и отправьте их в НК.
          </p>
        </div>
        <Chip label={`${cards.length} / 500`} size="small" />
      </div>
      <div className="crpt-toolbar">
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={onAdd}
          disabled={busy || cards.length >= 500}
        >
          Добавить карточку
        </Button>
        <Button
          startIcon={<DownloadRounded />}
          onClick={() => exportSheet('ZNAQ-CRPT-шаблон.xlsx', [cardColumns])}
        >
          Шаблон XLSX
        </Button>
        <Button
          startIcon={<UploadFileRounded />}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Импорт XLSX / CSV
        </Button>
        <Button
          disabled={!cards.length || busy}
          onClick={() => exportSheet('ZNAQ-CRPT-пакет.xlsx', cardsToRows(cards))}
        >
          Экспорт пакета
        </Button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".xlsx,.csv,.tsv"
          aria-label="Файл карточек НК"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setError('');
            try {
              const imported = importCards(await readSheet(file));
              if (cards.length + imported.length > 500)
                throw new Error('В пакете может быть не более 500 карточек.');
              const gtins = new Set(
                cards.filter((x) => x.gtin).map((x) => x.gtin.padStart(14, '0')),
              );
              if (imported.some((x) => x.gtin && gtins.has(x.gtin.padStart(14, '0'))))
                throw new Error('В пакете уже есть один из импортируемых GTIN.');
              onChange([...cards, ...imported]);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Не удалось прочитать файл.');
            }
          }}
        />
      </div>
      <Alert severity="info">
        Типы карточек: Единица, Комплект, Техническая, Индустриальная, Набор. Для набора повторяйте
        его GTIN в строках вложений; название и бренд заполните в первой строке. Для технической
        карточки оставьте GTIN пустым. Характеристики можно перенести из экспорта подготовленной
        карточки.
      </Alert>
      {(error || save.isError || send.isError) && (
        <Alert severity="error">{error || save.error?.message || send.error?.message}</Alert>
      )}
      {busy && (
        <LinearProgress
          variant={send.isPending ? 'determinate' : 'indeterminate'}
          value={cards.length ? (processed / cards.length) * 100 : 0}
        />
      )}
      {!cards.length ? (
        <div className="crpt-empty">
          <UploadFileRounded />
          <h3>Подготовьте первый пакет</h3>
          <p>Добавьте карточки через редактор или загрузите заполненный шаблон из Excel.</p>
        </div>
      ) : (
        <div className="crpt-table-wrap">
          <table className="crpt-table">
            <thead>
              <tr>
                <th>GTIN</th>
                <th>Наименование</th>
                <th>Тип</th>
                <th>Результат</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {cards.map((card, i) => (
                <tr key={card.requestId}>
                  <td className="crpt-mono">{card.gtin || 'Назначит НК'}</td>
                  <td>{card.name}</td>
                  <td>
                    {card.isSet
                      ? 'Набор'
                      : card.isKit
                        ? 'Комплект'
                        : card.isTechGtin
                          ? 'Техническая'
                          : card.isSim
                            ? 'Индустриальная'
                            : 'Единица'}
                  </td>
                  <td>
                    <span className={results[card.requestId]?.error ? 'crpt-error-text' : ''}>
                      {delivery[card.requestId] ||
                        (results[card.requestId]?.submission
                          ? 'Черновик сохранён'
                          : results[card.requestId]?.error || 'Готов к сохранению')}
                    </span>
                  </td>
                  <td>
                    <Button
                      aria-label={`Убрать строку ${i + 1}`}
                      disabled={busy || !!results[card.requestId]?.submission}
                      onClick={() => onChange(cards.filter((x) => x.requestId !== card.requestId))}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="crpt-toolbar crpt-panel-footer">
        <Button
          variant="outlined"
          startIcon={<SaveOutlined />}
          disabled={!remaining || busy}
          onClick={() => save.mutate()}
        >
          Сохранить черновики{remaining ? ` (${remaining})` : ''}
        </Button>
        <Button
          variant="contained"
          startIcon={<SendRounded />}
          disabled={!toSend || busy}
          onClick={() => send.mutate()}
        >
          Отправить в НК{toSend ? ` (${toSend})` : ''}
        </Button>
        <span>Модерация и публикация выполняются отдельными действиями в реестре.</span>
      </div>
    </section>
  );
}
