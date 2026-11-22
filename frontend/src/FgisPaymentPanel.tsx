import { OpenInNewRounded } from '@mui/icons-material';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { requestFgis, type FgisBridgeResponse, type FgisTab } from './fgisTransfer';
import { dateTime, type Party } from './types';

const portalUrl = 'https://pay.niakk.ru/';
const invoiceUrl = 'https://pay.niakk.ru/ru/main/documents/new';
const guideUrl =
  'https://niakk.ru/it-deyatelnost/publikatsiya-sertifikatov-i-deklaratsiy/voprosy-i-otvety/';
const rubles = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });

type PaymentAction = 'payment-status' | 'payment-balance' | 'payment-invoice';
type Balance = NonNullable<FgisBridgeResponse['paymentBalance']> & { readAt: string };

export function FgisPaymentPanel({ applicant }: { applicant: Pick<Party, 'name' | 'inn'> }) {
  const name = applicant.name?.trim();
  const inn = applicant.inn?.trim();
  const [tabs, setTabs] = useState<FgisTab[] | null>(null);
  const [tabId, setTabId] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [pending, setPending] = useState<PaymentAction>();
  const [balance, setBalance] = useState<Balance>();
  const [error, setError] = useState('');
  const [invoiceFilled, setInvoiceFilled] = useState(false);
  const quantity = Number(quantityText);
  const validQuantity =
    /^\d+$/.test(quantityText) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10000;
  const payerInn = balance?.payerInn?.trim();
  const busy = pending != null;

  async function run(action: PaymentAction) {
    if (busy || (action !== 'payment-status' && !tabId)) return;
    if (action === 'payment-invoice' && !validQuantity) return;

    setPending(action);
    setError('');
    setInvoiceFilled(false);
    if (action !== 'payment-invoice') setBalance(undefined);
    if (action === 'payment-status') {
      setTabs(null);
      setTabId('');
    }

    try {
      if (action === 'payment-status') {
        const response = await requestFgis(action);
        setTabs(response.paymentTabs ?? []);
      } else if (action === 'payment-balance') {
        const { paymentBalance } = await requestFgis(action, { tabId: Number(tabId) });
        if (
          !paymentBalance?.organizationName ||
          !Number.isSafeInteger(paymentBalance.balanceKopeks)
        ) {
          throw new Error(
            'Откройте кабинет «Платежи» и выберите организацию, чтобы прочитать баланс.',
          );
        }
        setBalance({ ...paymentBalance, readAt: new Date().toISOString() });
      } else {
        const response = await requestFgis(action, { tabId: Number(tabId), quantity });
        if (!response.invoiceFilled) {
          throw new Error(
            'Откройте форму «Создать счёт» в кабинете «Платежи» и повторите заполнение.',
          );
        }
        setInvoiceFilled(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось получить ответ от кабинета.');
    } finally {
      setPending(undefined);
    }
  }

  return (
    <Box component="section" sx={{ my: 3 }}>
      <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
        Оплата регистрации декларации
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Если для регистрации требуется оплата, войдите в кабинет «Платежи» через Госуслуги в том же
        профиле браузера и выберите организацию плательщика. Если платит заявитель, выберите роль
        «Заявитель» и сверьте его реквизиты.
      </Typography>
      {(name || inn) && (
        <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
          <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
            Заявитель
          </Box>
          {[name, inn && `ИНН ${inn}`].filter(Boolean).join(' · ')}
        </Typography>
      )}
      <Box component="ol" sx={{ my: 1.5, pl: 2.5, display: 'grid', gap: 0.75 }}>
        <Typography component="li" variant="body2">
          Проверьте баланс в верхней части кабинета и поступления в разделе «История операций».
        </Typography>
        <Typography component="li" variant="body2">
          Для счёта откройте «Документы» → «Создать счёт» и проверьте, что указана услуга регистрации декларации.
        </Typography>
        <Typography component="li" variant="body2">
          Скачайте сформированный счёт в PDF и оплатите его через банк или казначейство.
        </Typography>
      </Box>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Button
          component="a"
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          endIcon={<OpenInNewRounded />}
        >
          Открыть кабинет «Платежи»
        </Button>
        <Button
          component="a"
          href={guideUrl}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewRounded />}
        >
          Порядок оплаты на сайте НИА
        </Button>
        <Button disabled={busy} onClick={() => void run('payment-status')}>
          {pending === 'payment-status'
            ? 'Ищем вкладки…'
            : tabs
              ? 'Обновить вкладки'
              : 'Найти вкладки «Платежи»'}
        </Button>
      </Stack>
      {tabs?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Откройте кабинет «Платежи» в этом профиле браузера и обновите список вкладок.
        </Alert>
      )}
      {!!tabs?.length && (
        <Stack gap={2} sx={{ mt: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <TextField
              select
              fullWidth
              label="Вкладка кабинета «Платежи»"
              value={tabId}
              disabled={busy}
              onChange={(event) => {
                setTabId(event.target.value);
                setBalance(undefined);
                setInvoiceFilled(false);
                setError('');
              }}
            >
              {tabs.map((tab) => (
                <MenuItem key={tab.id} value={String(tab.id)}>
                  {tab.title} · вкладка {tab.id}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              sx={{ flexShrink: 0 }}
              disabled={busy || !tabId}
              onClick={() => void run('payment-balance')}
            >
              {pending === 'payment-balance' ? 'Читаем баланс…' : 'Прочитать баланс'}
            </Button>
          </Stack>
          {balance && (
            <Box
              role="status"
              sx={{ px: 2, py: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}
            >
              <Typography variant="h6" component="p">
                {rubles.format(balance.balanceKopeks / 100)}
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {balance.organizationName}
                {payerInn && ` · ИНН ${payerInn}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Баланс считан из кабинета {dateTime(balance.readAt)}
              </Typography>
              {inn && payerInn && inn === payerInn ? (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  ИНН плательщика совпадает с ИНН заявителя.
                </Typography>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {inn && payerInn
                    ? 'ИНН плательщика отличается от ИНН заявителя. Проверьте, какая организация оплачивает регистрацию.'
                    : 'ИНН плательщика или заявителя недоступен для сверки. Проверьте организацию в кабинете.'}
                </Alert>
              )}
            </Box>
          )}
        </Stack>
      )}
      <Box sx={{ mt: 2 }}>
        {!!tabs?.length && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            Для заполнения выберите вкладку с открытой формой счёта. После открытия новой вкладки
            обновите список.
          </Typography>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          flexWrap="wrap"
          sx={{ alignItems: { sm: 'flex-start' } }}
        >
          <Button
            component="a"
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewRounded />}
          >
            Открыть форму счёта
          </Button>
          {!!tabs?.length && (
            <>
              <TextField
                label="Количество деклараций"
                value={quantityText}
                disabled={busy || !tabId}
                inputProps={{ inputMode: 'numeric' }}
                error={!validQuantity}
                helperText={!validQuantity ? 'Укажите целое число от 1 до 10 000.' : undefined}
                onChange={(event) => {
                  setQuantityText(event.target.value);
                  setInvoiceFilled(false);
                  setError('');
                }}
              />
              <Button
                variant="outlined"
                disabled={busy || !tabId || !validQuantity}
                onClick={() => void run('payment-invoice')}
              >
                {pending === 'payment-invoice' ? 'Заполняем…' : 'Заполнить счёт в кабинете'}
              </Button>
            </>
          )}
        </Stack>
      </Box>
      {invoiceFilled && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Количество заполнено. Проверьте плательщика, услугу и сумму в кабинете, подтвердите
          создание счёта и скачайте PDF.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
