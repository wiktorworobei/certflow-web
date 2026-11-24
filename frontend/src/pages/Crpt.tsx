import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  QueryClient,
  QueryClientProvider,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
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
import { api } from '../store';
import type { MarkingSettings } from '../types';
import '../marking/marking.css';
import '../crpt/crpt.css';

export function Crpt() {
  const [params, setParams] = useSearchParams();
  const environment: CrptEnvironment =
    params.get('environment') === 'production' ? 'production' : 'sandbox';
  const service = params.get('service') === 'suz' ? 'suz' : 'catalog';
  const connection = params.get('view') === 'connection';
  const { firmId, canEdit, isAdmin } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [pending, setPending] = useState<CrptEnvironment | 'connection' | 'suz' | 'catalog' | null>(
    null,
  );
  const navigate = (target: CrptEnvironment | 'connection' | 'suz' | 'catalog') => {
    const next = new URLSearchParams(params);
    if (target === 'connection') {
      if (connection) next.delete('view');
      else next.set('view', 'connection');
    } else {
      next.set(target === 'suz' || target === 'catalog' ? 'service' : 'environment', target);
    }
    setParams(next);
    setPending(null);
    setUnsaved(false);
  };
  const requestNavigation = (target: CrptEnvironment | 'connection' | 'suz' | 'catalog') => {
    if (busy) return;
    if (unsaved) setPending(target);
    else navigate(target);
  };
  return (
    <div className="crpt-page">
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
          disabled={busy || !canEdit}
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
            <CrptConnection
              environment={environment}
              onBack={() => requestNavigation('connection')}
              onUnsavedChange={setUnsaved}
            />
          ) : (
            <HonestSignApp
              companyId={firmId}
              catalogOnly
              onConfigureConnection={isAdmin ? () => requestNavigation('connection') : undefined}
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
        <DialogTitle>
          {connection ? 'Закрыть настройки подключения?' : 'Закрыть подготовленные данные?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {connection
              ? 'Введённые реквизиты ещё не сохранены.'
              : 'Несохранённые изменения и текущий список пакетного импорта будут закрыты. Сохранённые на сервере черновики доступны в журнале выбранного контура.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Продолжить работу</Button>
          <Button onClick={() => pending && navigate(pending)}>Перейти</Button>
        </DialogActions>
      </Dialog>
    </div>
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

const connectionFields = {
  omsId: 'OMS ID',
  connectionId: 'Connection ID',
  participantInn: 'ИНН участника',
};
type ConnectionFields = Pick<MarkingSettings, keyof typeof connectionFields>;
const connectionKeys = Object.keys(connectionFields) as (keyof ConnectionFields)[];

function CrptConnection({
  environment,
  onBack,
  onUnsavedChange,
}: {
  environment: CrptEnvironment;
  onBack: () => void;
  onUnsavedChange: (unsaved: boolean) => void;
}) {
  const { firmId, firm, isAdmin } = useWorkspace();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const url = `/api/firms/${firmId}/crpt/${environment}/settings`;
  const queryKey = ['crpt-connection', firmId, environment];
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => (await apiClient.get<MarkingSettings>(url, { signal })).data,
  });
  const [draft, setDraft] = useState<ConnectionFields | null>(null);
  const fields = draft ?? query.data;
  const unsaved = !!draft && connectionKeys.some((key) => draft[key] !== query.data?.[key]);
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    onUnsavedChange(unsaved);
    return () => onUnsavedChange(false);
  }, [onUnsavedChange, unsaved]);
  const save = useMutation({
    mutationFn: async ({ omsId, connectionId, participantInn }: ConnectionFields) => {
      try {
        const body = {
          omsId: omsId.trim(),
          connectionId: connectionId.trim(),
          participantInn: participantInn.trim(),
        };
        return (await apiClient.put<MarkingSettings>(url, body)).data;
      } catch (e) {
        throw toHttpError('Не удалось сохранить подключение.', e);
      }
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKey, settings);
      dispatch(api.util.invalidateTags(['Marking', 'Integrations']));
      setDraft(null);
    },
  });
  return (
    <Paper className="crpt-connection">
      <Button startIcon={<ArrowBackRounded />} onClick={onBack} disabled={save.isPending}>
        Назад
      </Button>
      <h2 ref={heading} tabIndex={-1}>
        Подключение · {environment === 'sandbox' ? 'песочница ЧЗ' : 'рабочий контур'}
      </h2>
      <p>
        Реквизиты сохраняются для компании «{firm?.name}» в выбранном контуре. OMS ID и Connection
        ID доступны в разделе «Устройства» СУЗ.
      </p>
      {fields ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isAdmin && unsaved && !save.isPending) save.mutate(fields);
          }}
        >
          {connectionKeys.map((key) => (
            <TextField
              key={key}
              required
              fullWidth
              size="small"
              label={connectionFields[key]}
              value={fields[key]}
              disabled={!isAdmin || save.isPending}
              onChange={(e) => {
                save.reset();
                setDraft({ ...fields, [key]: e.target.value });
              }}
              inputProps={
                key === 'participantInn'
                  ? { inputMode: 'numeric', maxLength: 16 }
                  : { maxLength: 64 }
              }
            />
          ))}
          {save.isError && <Alert severity="error">{save.error.message}</Alert>}
          {save.isSuccess && (
            <Alert severity="success">
              Подключение сохранено. Вернитесь к работе и войдите по УКЭП.
            </Alert>
          )}
          {isAdmin ? (
            <Button type="submit" variant="contained" disabled={!unsaved || save.isPending}>
              {save.isPending ? 'Сохраняем…' : 'Сохранить подключение'}
            </Button>
          ) : (
            <Alert severity="info">Реквизиты подключения изменяет администратор компании.</Alert>
          )}
        </form>
      ) : query.isError ? (
        <Alert severity="error">
          Не удалось загрузить подключение.{' '}
          <Button onClick={() => void query.refetch()}>Повторить</Button>
        </Alert>
      ) : (
        <Loading />
      )}
    </Paper>
  );
}
