import { createContext, useContext, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Snackbar, Typography, useTheme } from '@mui/material';
import { DescriptionOutlined } from '@mui/icons-material';
import { ReplayRounded } from '@mui/icons-material';
import type { RootState } from './store';
import type { Status } from './types';
import { statusLabels, errorMessage } from './types';

export function useWorkspace() {
  const session = useSelector((s: RootState) => s.session);
  const firm = session.user?.firms.find(f => f.id === session.firmId);
  return { ...session, firm, canEdit: firm?.role === 'Admin' || firm?.role === 'Manager', isAdmin: firm?.role === 'Admin' };
}
const colors: Record<Status, [string, string]> = { Draft: ['#eff2f5', '#596779'], InReview: ['#edf3ff', '#315eaa'], Ready: ['#fff5e2', '#865d17'], Registered: ['#e7f6ee', '#207348'], Suspended: ['#fff1e8', '#995022'], Revoked: ['#fff0f0', '#b13c50'], Archived: ['#eef0f2', '#596779'] };
export function StatusChip({ status }: { status: Status }) {
  const dark = useTheme().palette.mode === 'dark';
  const darkColors: Record<Status, [string, string]> = { Draft: ['#263247', '#b7c5db'], InReview: ['#203557', '#9dc2ff'], Ready: ['#3b3120', '#f0cf8b'], Registered: ['#1b3a33', '#87dec1'], Suspended: ['#412f25', '#f0b888'], Revoked: ['#402831', '#ffadb4'], Archived: ['#29313e', '#b4bece'] };
  const [bg, color] = dark ? darkColors[status] : colors[status];
  return <Chip size="small" label={<span className="status-label"><i style={{ background: color }}/>{statusLabels[status]}</span>} sx={{ bgcolor: bg, color, fontSize: 12, fontWeight: 500, height: 28, borderRadius: '6px', '& .MuiChip-label': { px: 1 } }}/>;
}
export function PageTitle({ title, subtitle, children, eyebrow }: { title: string; subtitle?: string; children?: ReactNode; eyebrow?: string }) {
  return <div className="page-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<Typography variant="h4" component="h1">{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ mt: 1 }}>{subtitle}</Typography>}</div>{children && <div className="page-actions">{children}</div>}</div>;
}
export function Loading() { return <Box role="status" aria-label="Загрузка" sx={{ minHeight: 200, display: 'grid', placeItems: 'center' }}><CircularProgress size={27}/></Box>; }
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) { return <Alert severity="error" action={retry && <Button size="small" startIcon={<ReplayRounded/>} onClick={retry}>Повторить</Button>}>{errorMessage(error)}</Alert>; }
export function EmptyState({ title = 'Пока ничего нет', text, children }: { title?: string; text?: string; children?: ReactNode }) { return <div className="empty-state"><div className="empty-icon"><DescriptionOutlined/></div><Typography variant="h6" component="h2">{title}</Typography>{text && <Typography color="text.secondary" sx={{ maxWidth: 390, mt: 1, mb: 2 }}>{text}</Typography>}{children}</div>; }
export function Section({ title, subtitle, children, actions }: { title?: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) { return <Paper className="section-card">{title && <div className="section-heading"><div><Typography variant="h6" component="h2">{title}</Typography>{subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{subtitle}</Typography>}</div>{actions}</div>}<div className="section-content">{children}</div></Paper>; }
const NotifyContext = createContext<(text: string, severity?: 'success' | 'error') => void>(() => {});
export const useNotify = () => useContext(NotifyContext);
export function Notifications({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  return <NotifyContext.Provider value={(text, severity = 'success') => setNotice({ text, severity })}>{children}<Snackbar open={!!notice} autoHideDuration={5500} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} onClose={() => setNotice(null)}><Alert variant="filled" severity={notice?.severity ?? 'success'} onClose={() => setNotice(null)} sx={{ maxWidth: 520 }}>{notice?.text}</Alert></Snackbar></NotifyContext.Provider>;
}

