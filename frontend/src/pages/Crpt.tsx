import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  QueryClient,
  QueryClientProvider,
  useIsMutating,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'sonner';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Tab,
  Tabs,
  TextField,
  ThemeProvider,
  createTheme,
  useTheme,
} from '@mui/material';
import {
  ArrowBackRounded,
  OpenInNewRounded,
  SettingsOutlined,
  VerifiedOutlined,
} from '@mui/icons-material';
import { PageTitle, Loading, useWorkspace } from '../common';
import { useAppearance } from '../theme';
import { HonestSignApp } from '../marking/components/honest-sign/honest-sign-app';
import { MarkingDeclarationContext } from '../marking/DeclarationContext';
import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import i18n from '../marking/src/i18n';
import { activateCrptEnvironment, type CrptEnvironment } from '../crpt/environment';
import { CrptCatalogWorkspace } from '../crpt/CrptCatalogWorkspace';
import { CrptSuzWorkspace } from '../crpt/CrptSuzWorkspace';
import '../marking/marking.css';
import '../crpt/crpt.css';

export function Crpt() {
  const [params, setParams] = useSearchParams();
  const environment: CrptEnvironment =
    params.get('environment') === 'production' ? 'production' : 'sandbox';
  const service = params.get('service') === 'suz' ? 'suz' : 'catalog';
  const { firmId, canEdit } = useWorkspace();
  const { mode } = useAppearance();
  const parent = useTheme();
  const theme = createTheme(parent, {
    palette: {
      primary: {
        main: mode === 'dark' ? '#c3b4ff' : '#6b4cce',
        contrastText: mode === 'dark' ? '#21143b' : '#fff',
      },
    },
  });
  const [connection, setConnection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [pending, setPending] = useState<CrptEnvironment | 'connection' | 'suz' | 'catalog' | null>(
    null,
  );
  const navigate = (target: CrptEnvironment | 'connection' | 'suz' | 'catalog') => {
    if (target === 'connection') setConnection((value) => !value);
    else {
      const next = new URLSearchParams(params);
      next.set(target === 'suz' || target === 'catalog' ? 'service' : 'environment', target);
      setParams(next);
    }
    setPending(null);
    setUnsaved(false);
  };
  const requestNavigation = (target: CrptEnvironment | 'connection' | 'suz' | 'catalog') => {
    if (busy) return;
    if (unsaved) setPending(target);
    else navigate(target);
  };
  return (
    <ThemeProvider theme={theme}>
      <div className={`crpt-page ${mode === 'dark' ? 'crpt-dark' : ''}`}>
        <PageTitle
          eyebrow="ЭКОСИСТЕМА ZNAQ / МАРКИРОВКА"
          title="ZNAQ.CRPT"
          subtitle={
            service === 'suz'
              ? 'Станция управления заказами. От заказа КМ до сохранённых кодов.'
              : 'Национальный каталог. От первой карточки до публикации в Честном знаке.'
          }
        >
          <Button
            variant="outlined"
            startIcon={<SettingsOutlined />}
            disabled={busy}
            onClick={() => requestNavigation('connection')}
          >
            {connection ? 'Вернуться к работе' : 'Подключение'}
          </Button>
          <Button
            component="a"
            href={
              service === 'suz'
                ? 'https://docs.crpt.ru/gismt/files/pdf/API_%D0%A1%D0%A3%D0%97_3.0.pdf'
                : 'https://docs.crpt.ru/gismt/API_%D0%9D%D0%9A/'
            }
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewRounded />}
          >
            Документация
          </Button>
        </PageTitle>
        <div className="crpt-banner">
          <span className="crpt-banner-symbol">
            <VerifiedOutlined />
          </span>
          <div>
            <strong>
              {service === 'suz'
                ? 'От товара — к коду маркировки.'
                : 'Один каталог. Весь путь товара.'}
            </strong>
            <p>
              {service === 'suz'
                ? 'Заказы, блоки кодов и документы — под контролем в каждом контуре.'
                : 'Единицы, комплекты, наборы и технические карточки — в одном рабочем пространстве.'}
            </p>
          </div>
          <span className="crpt-version">
            {service === 'suz' ? 'API СУЗ · 3.0.40' : 'API НК · v5.69'}
          </span>
        </div>
        <Paper className="crpt-services">
          <Tabs
            value={service}
            onChange={(_, value: 'catalog' | 'suz') => requestNavigation(value)}
            aria-label="Сервисы ZNAQ.CRPT"
          >
            <Tab value="catalog" label="Национальный каталог" disabled={busy} />
            <Tab value="suz" label="СУЗ · Заказы кодов" disabled={busy} />
          </Tabs>
        </Paper>
        <Paper className="crpt-environments">
          <Tabs
            value={environment}
            onChange={(_, value: CrptEnvironment) => requestNavigation(value)}
            aria-label="Контур Честного знака"
          >
            <Tab value="production" label="Рабочий контур" disabled={busy} />
            <Tab value="sandbox" label="Песочница ЧЗ" disabled={busy} />
          </Tabs>
          <Chip
            size="small"
            label={environment === 'sandbox' ? 'Тестовая среда' : 'Промышленная среда'}
            variant="outlined"
          />
        </Paper>
        <p className="crpt-environment-note">
          {environment === 'sandbox'
            ? 'Песочница Честного знака: отдельные подключение, сессия, карточки и история операций.'
            : 'Рабочий контур Честного знака: отправленные и подписанные сведения поступают в промышленную систему.'}
        </p>
        {!canEdit ? (
          <Alert severity="info">
            Работа с Честным знаком доступна специалисту и администратору компании.
          </Alert>
        ) : (
          <CrptScope
            key={`${firmId}:${environment}:${service}`}
            environment={environment}
            onActivityChange={setBusy}
          >
            {connection ? (
              <CrptConnection environment={environment} onBack={() => setConnection(false)} />
            ) : (
              <HonestSignApp
                companyId={firmId}
                catalogOnly
                workspaceTitle={service === 'suz' ? 'СУЗ · управление заказами' : undefined}
                workspaceDescription={
                  service === 'suz' ? 'Заказ, получение и архив кодов маркировки.' : undefined
                }
                catalogWorkspace={(thumbprint) =>
                  service === 'suz' ? (
                    <CrptSuzWorkspace
                      companyId={firmId}
                      environment={environment}
                      selectedThumbprint={thumbprint}
                      onUnsavedChange={setUnsaved}
                    />
                  ) : (
                    <CrptCatalogWorkspace
                      companyId={firmId}
                      environment={environment}
                      selectedThumbprint={thumbprint}
                      onUnsavedChange={setUnsaved}
                    />
                  )
                }
              />
            )}
          </CrptScope>
        )}
        <Dialog open={!!pending} onClose={() => setPending(null)}>
          <DialogTitle>Закрыть подготовленные данные?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Несохранённые изменения и текущий список пакетного импорта будут закрыты. Сохранённые
              на сервере черновики доступны в журнале выбранного контура.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPending(null)}>Продолжить работу</Button>
            <Button onClick={() => pending && navigate(pending)}>Перейти</Button>
          </DialogActions>
        </Dialog>
      </div>
    </ThemeProvider>
  );
}

function CrptScope({
  environment,
  children,
  onActivityChange,
}: {
  environment: CrptEnvironment;
  children: ReactNode;
  onActivityChange: (busy: boolean) => void;
}) {
  const { mode } = useAppearance();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const release = activateCrptEnvironment(environment);
    setReady(true);
    return () => {
      void client.cancelQueries();
      client.clear();
      release();
    };
  }, [client, environment]);
  return (
    <div className={`marking-surface crpt-surface ${mode === 'dark' ? 'dark' : ''}`}>
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>
          <MarkingDeclarationContext.Provider value={null}>
            <CrptActivity onChange={onActivityChange} />
            {ready ? children : <Loading />}
            <div id="marking-portals" />
            <Toaster theme={mode} position="bottom-right" richColors />
          </MarkingDeclarationContext.Provider>
        </I18nextProvider>
      </QueryClientProvider>
    </div>
  );
}
function CrptActivity({ onChange }: { onChange: (busy: boolean) => void }) {
  const count = useIsMutating();
  useEffect(() => {
    onChange(count > 0);
    return () => onChange(false);
  }, [count, onChange]);
  return null;
}

type Connection = { profile: string; omsId: string; connectionId: string; participantInn: string };
function CrptConnection({
  environment,
  onBack,
}: {
  environment: CrptEnvironment;
  onBack: () => void;
}) {
  const { firmId, isAdmin } = useWorkspace();
  const url = `/api/firms/${firmId}/crpt/${environment}/settings`;
  const query = useQuery({
    queryKey: ['crpt-connection', firmId, environment],
    queryFn: async ({ signal }) => (await apiClient.get<Connection>(url, { signal })).data,
  });
  const [fields, setFields] = useState({ omsId: '', connectionId: '', participantInn: '' });
  useEffect(() => {
    if (query.data)
      setFields({
        omsId: query.data.omsId,
        connectionId: query.data.connectionId,
        participantInn: query.data.participantInn,
      });
  }, [query.data]);
  const save = useMutation({
    mutationFn: async () => {
      try {
        return (await apiClient.put<Connection>(url, fields)).data;
      } catch (e) {
        throw toHttpError('Не удалось сохранить подключение.', e);
      }
    },
    onSuccess: () => {
      void query.refetch();
    },
  });
  return (
    <Paper className="crpt-connection">
      <Button startIcon={<ArrowBackRounded />} onClick={onBack}>
        В каталог
      </Button>
      <h2>Подключение · {environment === 'sandbox' ? 'песочница ЧЗ' : 'рабочий контур'}</h2>
      <p>
        Укажите реквизиты станции управления заказами этого контура, затем подключитесь с помощью
        сертификата УКЭП.
      </p>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Alert severity="error">
          Не удалось загрузить подключение.{' '}
          <Button onClick={() => void query.refetch()}>Повторить</Button>
        </Alert>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {(['omsId', 'connectionId', 'participantInn'] as const).map((key) => (
            <TextField
              key={key}
              required
              fullWidth
              size="small"
              label={
                { omsId: 'OMS ID', connectionId: 'Connection ID', participantInn: 'ИНН участника' }[
                  key
                ]
              }
              value={fields[key]}
              disabled={!isAdmin || save.isPending}
              onChange={(e) => setFields((value) => ({ ...value, [key]: e.target.value }))}
              inputProps={{ maxLength: key === 'participantInn' ? 12 : 36 }}
            />
          ))}
          {save.isError && <Alert severity="error">{save.error.message}</Alert>}
          {save.isSuccess && (
            <Alert severity="success">
              Подключение сохранено. Выполните вход по УКЭП в каталоге.
            </Alert>
          )}
          {isAdmin ? (
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Сохранить подключение
            </Button>
          ) : (
            <Alert severity="info">Реквизиты подключения изменяет администратор компании.</Alert>
          )}
        </form>
      )}
    </Paper>
  );
}
