import { useEffect, useMemo, useState } from 'react';
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from '@mui/material';
import { AddRounded, RefreshRounded } from '@mui/icons-material';
import { DocumentsWorkspace } from '../marking/components/honest-sign/DocumentsWorkspace';
import { HonestSignDocumentsRegistry } from '../marking/components/honest-sign/HonestSignDocumentsRegistry';
import { UtilisationBatchesHistory } from '../marking/components/honest-sign/UtilisationBatchesHistory';
import { documentsApiService } from '../marking/lib/honest-sign/documentsApiService';
import { participantsApiService } from '../marking/lib/honest-sign/participantsApiService';
import type { SubmittedUtilisationReport } from '../marking/lib/honest-sign/utilisationReport';
import { CrptSuzReceipts } from './CrptSuzReceipts';
import { CrptSuzSpecialReports } from './CrptSuzSpecialReports';
import { CrptTurnoverWorkspace } from './CrptTurnoverWorkspace';
import type { CrptEnvironment } from './environment';

type Section = 'utilisation' | 'introduction' | 'withdrawal' | 'receipts' | 'registry' | 'special';

type Props = {
  companyId: string;
  environment: CrptEnvironment;
  selectedThumbprint: string;
  onUnsavedChange: (value: boolean) => void;
  onBusyChange: (value: boolean) => void;
};

const noGroups: string[] = [];
const automaticUtilisationGroups = new Set(['lp', 'shoes', 'perfumery', 'tires', 'electronics']);
const specialUtilisationGroups = new Set(['beer', 'radio', 'chemistry', 'toys']);

export function CrptDocumentsWorkspace({
  companyId,
  environment,
  selectedThumbprint,
  onUnsavedChange,
  onBusyChange,
}: Props) {
  const client = useQueryClient();
  const [section, setSection] = useState<Section>('utilisation');
  const [formOpen, setFormOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Section | null>(null);
  const [report, setReport] = useState<SubmittedUtilisationReport | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const mutating = useIsMutating() > 0;
  const groups = useQuery({
    queryKey: ['suz-groups', companyId, environment],
    queryFn: () => participantsApiService.getParticipantProductGroups(),
    enabled: section === 'utilisation' || section === 'registry' || section === 'special',
  });
  const manualReportGroups = useMemo(
    () => groups.data?.filter((group) => !automaticUtilisationGroups.has(group)),
    [groups.data],
  );
  const hasSpecialReports = groups.data?.some((group) => specialUtilisationGroups.has(group));
  const status = useQuery({
    queryKey: ['crpt-utilisation-status', companyId, environment, report?.reportId],
    queryFn: () => documentsApiService.getUtilisationReportStatus(report!.reportId),
    enabled: section === 'utilisation' && !formOpen && !!report,
  });

  useEffect(() => {
    onUnsavedChange(dirty);
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirty && !busy && !mutating) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      onUnsavedChange(false);
      window.removeEventListener('beforeunload', guard);
    };
  }, [dirty, busy, mutating, onUnsavedChange]);
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  const go = (next: Section) => {
    setSection(next);
    setDirty(false);
    setBusy(false);
    setFormOpen(false);
    setPending(null);
  };
  const request = (next: Section) => {
    if (busy || mutating || (next === section && !formOpen)) return;
    if (dirty) setPending(next);
    else go(next);
  };

  return (
    <div className="crpt-suz crpt-documents">
      <Tabs
        value={section === 'special' ? 'utilisation' : section}
        onChange={(_, next: Section) => request(next)}
        aria-label="Разделы документов"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab value="utilisation" label="Отчёты о нанесении" disabled={busy || mutating} />
        <Tab value="introduction" label="Ввод в оборот" disabled={busy || mutating} />
        <Tab value="withdrawal" label="Вывод из оборота" disabled={busy || mutating} />
        <Tab value="receipts" label="Квитанции СУЗ" disabled={busy || mutating} />
        <Tab value="registry" label="Обработанные в ГИС МТ" disabled={busy || mutating} />
      </Tabs>

      {groups.isError &&
        (section === 'utilisation' || section === 'registry' || section === 'special') && (
          <Alert
            severity="error"
            action={<Button onClick={() => void groups.refetch()}>Повторить</Button>}
          >
            {groups.error.message}
          </Alert>
        )}
      {section === 'utilisation' &&
        (formOpen ? (
          <DocumentsWorkspace
            companyId={companyId}
            productGroups={manualReportGroups ?? noGroups}
            selectedThumbprint={selectedThumbprint}
            allowSuzArchive
            onCancel={() => request('utilisation')}
            onBusyChange={setBusy}
            onDirtyChange={setDirty}
            onSubmitted={(nextReport) => {
              setReport(nextReport);
              void client.invalidateQueries({
                queryKey: ['crpt-suz-receipts', companyId, environment],
              });
              go('utilisation');
            }}
          />
        ) : (
          <section className="crpt-panel">
            <div className="crpt-panel-heading">
              <div>
                <h2>Отчёты о нанесении кодов</h2>
                <p>Создайте отчёт по полным кодам маркировки или загрузите пакет файлов.</p>
              </div>
              <div className="crpt-toolbar">
                <Button
                  variant="outlined"
                  disabled={!hasSpecialReports}
                  onClick={() => request('special')}
                >
                  Особое нанесение
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddRounded />}
                  disabled={!manualReportGroups?.length}
                  onClick={() => setFormOpen(true)}
                >
                  Создать отчёт
                </Button>
              </div>
            </div>
            {groups.isSuccess && !!groups.data.length && !manualReportGroups?.length && (
              <Alert severity="info">
                Для подключённых товарных групп СУЗ формирует отчёты о нанесении автоматически.
              </Alert>
            )}
            {report && (
              <div className="crpt-document-report">
                <Alert severity={status.data?.status === 'SUCCESS' ? 'success' : 'info'}>
                  Отчёт {report.reportId} · кодов {report.codesCount} ·{' '}
                  {status.data?.status ?? report.status ?? 'Получен СУЗ'}
                  {status.data?.errorReason && <p>{status.data.errorReason}</p>}
                </Alert>
                {status.isError && <Alert severity="warning">{status.error.message}</Alert>}
                <div className="crpt-toolbar">
                  <Button
                    startIcon={<RefreshRounded />}
                    disabled={status.isFetching}
                    onClick={() => void status.refetch()}
                  >
                    Обновить статус отчёта
                  </Button>
                  <Button
                    onClick={() => {
                      setReceiptId(report.reportId);
                      go('receipts');
                    }}
                  >
                    Открыть квитанцию
                  </Button>
                </div>
              </div>
            )}
            <UtilisationBatchesHistory companyId={companyId} />
          </section>
        ))}

      {section === 'special' && (
        <>
          <Button disabled={mutating} onClick={() => request('utilisation')}>
            К отчётам о нанесении
          </Button>
          <CrptSuzSpecialReports
            companyId={companyId}
            environment={environment}
            productGroups={groups.data ?? noGroups}
            selectedThumbprint={selectedThumbprint}
            onUnsavedChange={setDirty}
          />
        </>
      )}
      {(section === 'introduction' || section === 'withdrawal') && (
        <CrptTurnoverWorkspace
          key={section}
          operation={section === 'introduction' ? 'Introduction' : 'Withdrawal'}
          companyId={companyId}
          environment={environment}
          selectedThumbprint={selectedThumbprint}
          onUnsavedChange={setDirty}
        />
      )}
      {section === 'receipts' && (
        <CrptSuzReceipts
          companyId={companyId}
          environment={environment}
          initialReceiptId={receiptId}
        />
      )}
      {section === 'registry' && (
        <HonestSignDocumentsRegistry
          companyId={companyId}
          productGroups={groups.data ?? noGroups}
          view="processed"
          allowExport
          paginated
        />
      )}

      <Dialog open={pending !== null} onClose={() => setPending(null)}>
        <DialogTitle>Закрыть форму?</DialogTitle>
        <DialogContent>Введённые данные текущей формы будут сброшены.</DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Продолжить работу</Button>
          <Button onClick={() => pending && go(pending)}>Закрыть форму</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
