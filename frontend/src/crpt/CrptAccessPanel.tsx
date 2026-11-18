import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { RefreshRounded, VerifiedOutlined } from '@mui/icons-material';
import { cryptoProSignatureService } from '../marking/lib/honest-sign/cryptoProSignatureService';
import { crptApi, type AccessPreparation } from './api';
import { captureCrptEnvironment, assertCrptEnvironment } from './environment';

export function CrptAccessPanel({
  selectedGtins,
  selectedThumbprint,
  onBusyChange,
}: {
  selectedGtins: string[];
  selectedThumbprint: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [received, setReceived] = useState(false);
  const [filter, setFilter] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);
  const [inn, setInn] = useState('');
  const [allow, setAllow] = useState(true);
  const [partial, setPartial] = useState(true);
  const [codes, setCodes] = useState(selectedGtins.join('\n'));
  const [preparation, setPreparation] = useState<AccessPreparation | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const accounts = useQuery({
    queryKey: ['crpt-access', received, applied, page],
    queryFn: ({ signal }) => crptApi.accounts(received, applied, page, signal),
  });
  const gtins = codes.split(/[\s,;]+/).filter(Boolean);
  const prepare = useMutation({
    mutationFn: async () => {
      onBusyChange(true);
      const scope = captureCrptEnvironment();
      try {
        const result = await crptApi.prepareAccess(
          requestId.current,
          inn.trim(),
          allow,
          partial ? gtins : null,
        );
        assertCrptEnvironment(scope);
        setPreparation(result);
      } finally {
        onBusyChange(false);
      }
    },
  });
  const sign = useMutation({
    mutationFn: async () => {
      if (!preparation || !confirmed || !selectedThumbprint)
        throw new Error('Подтвердите предоставление или отзыв доступа и выберите сертификат.');
      onBusyChange(true);
      const scope = captureCrptEnvironment();
      try {
        const proof = await cryptoProSignatureService.signDetached({
          thumbprint: selectedThumbprint,
          message: preparation.xml,
          cadesType: 'bes',
        });
        assertCrptEnvironment(scope);
        const result = await crptApi.signAccess(
          preparation,
          cryptoProSignatureService.normalizeDetachedSignature(proof.pkcs7),
          selectedThumbprint,
        );
        assertCrptEnvironment(scope);
        setPreparation(result);
        void accounts.refetch();
      } catch (e) {
        assertCrptEnvironment(scope);
        const result = await crptApi.accessReceipt(preparation.id).catch(() => null);
        if (result) setPreparation(result);
        throw e;
      } finally {
        onBusyChange(false);
      }
    },
  });
  const reset = () => {
    setPreparation(null);
    setConfirmed(false);
    requestId.current = crypto.randomUUID();
    prepare.reset();
    sign.reset();
  };
  const busy = prepare.isPending || sign.isPending;
  const list = received
    ? (accounts.data?.linked_gtins ?? [])
    : (accounts.data?.linked_accounts ?? []);
  return (
    <div className="crpt-access-grid">
      <section className="crpt-panel">
        <div className="crpt-panel-heading">
          <div>
            <h2>Доступ к карточкам</h2>
            <p>Полный доступ или выбранные коды товаров для другой компании.</p>
          </div>
        </div>
        <Alert severity="info">
          Субаккаунт сможет использовать коды товаров для заказа маркировки и ввода в оборот.
          Поддерживаются российские GTIN 046 и коды индустриальной маркировки 004.
        </Alert>
        <div className="crpt-access-form">
          <TextField
            size="small"
            label="ИНН субаккаунта"
            value={inn}
            disabled={busy || !!preparation}
            onChange={(e) => {
              setInn(e.target.value.replace(/\D/g, '').slice(0, 12));
              requestId.current = crypto.randomUUID();
            }}
            inputProps={{ inputMode: 'numeric' }}
          />
          <TextField
            select
            size="small"
            label="Действие с доступом"
            value={allow ? 'allow' : 'revoke'}
            disabled={busy || !!preparation}
            onChange={(e) => {
              setAllow(e.target.value === 'allow');
              requestId.current = crypto.randomUUID();
            }}
          >
            <MenuItem value="allow">Предоставить доступ</MenuItem>
            <MenuItem value="revoke">Отозвать доступ</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Объём доступа"
            value={partial ? 'partial' : 'full'}
            disabled={busy || !!preparation}
            onChange={(e) => {
              setPartial(e.target.value === 'partial');
              requestId.current = crypto.randomUUID();
            }}
          >
            <MenuItem value="partial">К выбранным GTIN</MenuItem>
            <MenuItem value="full">Ко всем товарам</MenuItem>
          </TextField>
          {partial && (
            <TextField
              multiline
              minRows={4}
              label="GTIN для доступа"
              value={codes}
              disabled={busy || !!preparation}
              onChange={(e) => {
                setCodes(e.target.value);
                requestId.current = crypto.randomUUID();
              }}
              helperText="До 1000 кодов, по одному в строке"
            />
          )}
          {!partial && (
            <Alert severity="warning">
              {allow
                ? 'Будет предоставлен доступ ко всем кодам товаров компании.'
                : 'Отзыв полного доступа сохраняет ранее выданный частичный доступ. При необходимости отзовите его отдельно.'}
            </Alert>
          )}
          {(prepare.isError || sign.isError) && (
            <Alert severity="error">{prepare.error?.message || sign.error?.message}</Alert>
          )}
          {!preparation ? (
            <Button
              variant="contained"
              disabled={
                busy ||
                !/^\d{10}(\d{2})?$/.test(inn) ||
                (partial && (!gtins.length || gtins.length > 1000))
              }
              onClick={() => prepare.mutate()}
            >
              Сформировать документ доступа
            </Button>
          ) : (
            <>
              {preparation.state === 'Prepared' ? (
                <>
                  <p>
                    Документ для ИНН {preparation.inn} подготовлен. Срок подписи: до{' '}
                    {new Date(preparation.expiresAtUtc).toLocaleTimeString('ru-RU', {
                      timeZone: 'Europe/Moscow',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    МСК.
                  </p>
                  <details>
                    <summary>Просмотреть XML документа</summary>
                    <pre className="crpt-xml">{preparation.xml}</pre>
                  </details>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={confirmed}
                        disabled={busy}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                    }
                    label={`Подтверждаю ${allow ? 'предоставление' : 'отзыв'} ${partial ? 'частичного' : 'полного'} доступа для ИНН ${preparation.inn}`}
                  />
                  <Button
                    variant="contained"
                    startIcon={<VerifiedOutlined />}
                    disabled={!confirmed || busy || !selectedThumbprint}
                    onClick={() => sign.mutate()}
                  >
                    Подписать и применить доступ
                  </Button>
                </>
              ) : (
                <Alert
                  severity={
                    preparation.state === 'Accepted'
                      ? 'success'
                      : preparation.state === 'Rejected'
                        ? 'error'
                        : 'warning'
                  }
                >
                  {preparation.state === 'Accepted'
                    ? 'НК подтвердил изменение доступа.'
                    : preparation.state === 'Rejected'
                      ? 'НК отклонил изменение доступа. Проверьте результат.'
                      : 'Результат отправки неизвестен. Сверьте доступ в списке субаккаунтов перед новым запросом.'}
                </Alert>
              )}
              {preparation.result && (
                <pre className="crpt-xml">{JSON.stringify(preparation.result, null, 2)}</pre>
              )}
              <Button
                disabled={busy || ['Sending', 'Unknown'].includes(preparation.state)}
                onClick={reset}
              >
                Новый документ
              </Button>
            </>
          )}
        </div>
      </section>
      <section className="crpt-panel">
        <div className="crpt-panel-heading">
          <div>
            <h2>{received ? 'Мне предоставили доступ' : 'Субаккаунты компании'}</h2>
            <p>Актуальные сведения Национального каталога.</p>
          </div>
          <Button
            aria-label="Обновить доступы"
            disabled={accounts.isFetching}
            onClick={() => void accounts.refetch()}
          >
            <RefreshRounded />
          </Button>
        </div>
        <div className="crpt-toolbar">
          <TextField
            select
            size="small"
            label="Направление доступа"
            value={received ? 'received' : 'granted'}
            onChange={(e) => {
              setReceived(e.target.value === 'received');
              setPage(1);
            }}
          >
            <MenuItem value="granted">Выданные доступы</MenuItem>
            <MenuItem value="received">Полученные доступы</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Поиск по ИНН"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            inputProps={{ maxLength: 12 }}
          />
          <Button
            onClick={() => {
              setApplied(filter);
              setPage(1);
            }}
          >
            Найти
          </Button>
        </div>
        {accounts.isError && <Alert severity="error">{accounts.error.message}</Alert>}
        {accounts.data?.errors?.map((e, i) => (
          <Alert key={i} severity="error">
            {e.message}
          </Alert>
        ))}
        {!list.length ? (
          <div className="crpt-empty">
            <h3>{accounts.isFetching ? 'Загружаем доступы…' : 'Доступов не найдено'}</h3>
            <p>Здесь появятся компании и доступные им коды товаров.</p>
          </div>
        ) : (
          <div className="crpt-account-list">
            {list.map((account, index) => (
              <article key={index}>
                <strong>{account.account_name || account.producer_name || 'Компания'}</strong>
                <span>ИНН {account.account_inn || account.producer_inn}</span>
                <small>
                  {received
                    ? account.gtin || 'Все доступные товары'
                    : account.full_access
                      ? 'Полный доступ'
                      : 'Частичный доступ'}
                </small>
                {account.access_allowed && (
                  <details>
                    <summary>Коды товаров ({account.access_allowed.length})</summary>
                    <p className="crpt-mono">
                      {account.access_allowed.map((x) => x.gtin).join(', ')}
                    </p>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="crpt-toolbar crpt-panel-footer">
          <Button
            disabled={page === 1 || accounts.isFetching}
            onClick={() => setPage((x) => x - 1)}
          >
            Назад
          </Button>
          <span>Страница {page}</span>
          <Button
            disabled={list.length < 100 || accounts.isFetching || page >= 100}
            onClick={() => setPage((x) => x + 1)}
          >
            Далее
          </Button>
        </div>
      </section>
    </div>
  );
}
