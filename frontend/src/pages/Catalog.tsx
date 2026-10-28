import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'sonner';
import { Alert, Button } from '@mui/material';
import { SettingsOutlined } from '@mui/icons-material';
import { api } from '../store';
import { ErrorState, Loading, PageTitle, useWorkspace } from '../common';
import { useAppearance } from '../theme';
import { HonestSignApp } from '../marking/components/honest-sign/honest-sign-app';
import { MarkingDeclarationContext } from '../marking/DeclarationContext';
import i18n from '../marking/src/i18n';
import '../marking/marking.css';

export function Catalog() {
  const { firmId, canEdit } = useWorkspace(); const { mode } = useAppearance();
  const settings = api.useMarkingSettingsQuery(firmId);
  const [query] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } }));
  useEffect(() => () => query.clear(), [query, firmId]);
  return <>
    <PageTitle eyebrow="НАЦИОНАЛЬНЫЙ КАТАЛОГ" title="Карточки ЧЗ" subtitle="Создавайте карточки моторных масел, заполняйте характеристики и отслеживайте обработку в Честном знаке.">
      <Button component={RouterLink} to="/settings" variant="outlined" startIcon={<SettingsOutlined/>}>Настройки подключения</Button>
    </PageTitle>
    {!canEdit ? <Alert severity="info">Создание и изменение карточек ЧЗ доступны специалисту или администратору компании.</Alert>
      : settings.isLoading ? <Loading/>
      : settings.error ? <ErrorState error={settings.error} retry={settings.refetch}/>
      : <>
        <Alert severity={settings.data?.profile === 'Production' ? 'warning' : 'info'} sx={{ mb: 2 }}>Честный знак · {settings.data?.profile === 'Production' ? 'рабочий контур' : 'песочница'}. Для новой карточки нужны GTIN, описание товара и характеристики выбранной категории. Создание черновика, модерация и публикация выполняются отдельными действиями.</Alert>
        <div className={`marking-surface ${mode === 'dark' ? 'dark' : ''}`}>
          <QueryClientProvider client={query}><I18nextProvider i18n={i18n}><MarkingDeclarationContext.Provider value={null}>
            <HonestSignApp companyId={firmId} catalogOnly/>
            <div id="marking-portals"/><Toaster theme={mode} position="bottom-right" richColors/>
          </MarkingDeclarationContext.Provider></I18nextProvider></QueryClientProvider>
        </div>
      </>}
  </>;
}
