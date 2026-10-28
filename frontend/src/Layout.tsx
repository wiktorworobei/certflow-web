import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Avatar, Button, Divider, Drawer, IconButton, Menu, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import { AddRounded, ArrowForwardRounded, CorporateFareOutlined, DarkModeOutlined, DescriptionOutlined, GroupOutlined, KeyboardArrowDownRounded, LightModeOutlined, LogoutRounded, MenuRounded, QrCode2Rounded, RouteOutlined, SettingsOutlined, SpaceDashboardOutlined, Inventory2Outlined } from '@mui/icons-material';
import { api, authRequest, selectFirm, signedOut } from './store';
import { useWorkspace } from './common';
import { useAppearance } from './theme';
import { ColorThemeMenu } from './ColorThemeMenu';

export function ThemeSwitch() {
  const { mode, setPreference } = useAppearance();
  const label = mode === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему';
  return <Tooltip title={label}><IconButton aria-label={label} onClick={() => setPreference(mode === 'light' ? 'dark' : 'light')} className="theme-switch">{mode === 'light' ? <DarkModeOutlined fontSize="small"/> : <LightModeOutlined fontSize="small"/>}</IconButton></Tooltip>;
}
export function Brand() { return <><div className="brand-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M22 8H11a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3V11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><path d="m13 14 4 4 9-11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div><span>CertFlow<span className="brand-dot">.</span></span></>; }

const navigation = [
  { to: '/', label: 'Обзор', icon: <SpaceDashboardOutlined/> },
  { to: '/declarations', label: 'Декларации', icon: <DescriptionOutlined/> },
  { to: '/directories', label: 'Справочники', icon: <CorporateFareOutlined/> },
  { to: '/catalog', label: 'Карточки ЧЗ', icon: <Inventory2Outlined/> },
  { to: '/marking', label: 'ЧЗ и Наша марка', icon: <QrCode2Rounded/> },
];
export function Layout() {
  const { user, firm, firmId, isAdmin, canEdit } = useWorkspace();
  const dispatch = useDispatch(); const navigate = useNavigate(); const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false); const [profileMenu, setProfileMenu] = useState<HTMLElement | null>(null);
  async function logout() { try { await authRequest('logout'); } finally { dispatch(signedOut()); dispatch(api.util.resetApiState()); } }
  const links = [...navigation, ...(isAdmin ? [{ to: '/team', label: 'Команда', icon: <GroupOutlined/> }] : [])];
  const page = location.pathname.startsWith('/development-plan') ? 'План разработки' : location.pathname === '/settings' ? 'Настройки' : links.find(l => l.to !== '/' && location.pathname.startsWith(l.to))?.label ?? 'Обзор';
  useEffect(() => { document.title = `${page} — CertFlow`; }, [page]);
  const navClass = ({ isActive }: { isActive: boolean }) => isActive ? 'nav-item active' : 'nav-item';
  const sidebar = <aside className="sidebar-inner">
    <NavLink className="brand" to="/" onClick={() => setMobileOpen(false)}><Brand/></NavLink>
    <div className="workspace-label"><span className="workspace-label-icon"><CorporateFareOutlined/></span><div><strong>{firm?.name || 'Рабочее пространство'}</strong><span>Управление сертификацией</span></div></div>
    {canEdit && <Button className="sidebar-create" variant="contained" startIcon={<AddRounded/>} onClick={() => { navigate('/declarations/new'); setMobileOpen(false); }}>Создать декларацию</Button>}
    <div className="sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
    <nav className="sidebar-nav" aria-label="Основное меню">{links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={() => setMobileOpen(false)} className={navClass}>{link.icon}<span>{link.label}</span><span className="nav-active-mark"/></NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-caption">ПРОЕКТ</div><nav aria-label="Меню проекта"><NavLink to="/development-plan" className={navClass} onClick={() => setMobileOpen(false)}><RouteOutlined/><span>План разработки</span></NavLink><NavLink to="/settings" className={navClass} onClick={() => setMobileOpen(false)}><SettingsOutlined/><span>Настройки</span></NavLink></nav>
      <div className="sidebar-workspace"><span className="sidebar-workspace-logo">CF</span><div><strong>Ваши документы. В порядке.</strong><span>Единое рабочее пространство</span></div></div>
    </div>
  </aside>;
  return <div className="app-layout"><a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView({ block: 'start' }); }}>К содержимому</a><div className="desktop-sidebar">{sidebar}</div><Drawer id="mobile-navigation" open={mobileOpen} onClose={() => setMobileOpen(false)} PaperProps={{ sx: { width: 264, bgcolor: 'var(--sidebar)' } }}>{sidebar}</Drawer>
    <div className="workspace"><header className="topbar"><div className="topbar-left"><IconButton className="mobile-menu" aria-label="Открыть меню" aria-expanded={mobileOpen} aria-controls={mobileOpen ? 'mobile-navigation' : undefined} onClick={() => setMobileOpen(true)}><MenuRounded/></IconButton><span className="breadcrumb-home">Пространство</span><span className="breadcrumb-divider">/</span><span className="breadcrumb-page">{page}</span></div>
      <div className="topbar-right">{user && user.firms.length > 0 && <Select native value={firmId} size="small" inputProps={{ 'aria-label': 'Компания' }} className="firm-select" onChange={e => { dispatch(selectFirm(e.target.value)); dispatch(api.util.resetApiState()); navigate('/'); }}>{user.firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>}<ColorThemeMenu/><ThemeSwitch/><div className="topbar-separator"/><Button color="inherit" aria-label="Меню профиля" aria-haspopup="menu" aria-expanded={!!profileMenu} onClick={e => setProfileMenu(e.currentTarget)} className="profile-button"><Avatar className="profile-avatar">{(user?.displayName || user?.userName)?.slice(0, 1).toUpperCase()}</Avatar><div><strong>{user?.displayName || user?.userName}</strong><span>{isAdmin ? 'Администратор' : firm?.role === 'Manager' ? 'Специалист' : 'Наблюдатель'}</span></div><KeyboardArrowDownRounded fontSize="small"/></Button></div>
    </header><Menu anchorEl={profileMenu} open={!!profileMenu} onClose={() => setProfileMenu(null)}><MenuItem onClick={() => { setProfileMenu(null); navigate('/settings?tab=profile'); }}><SettingsOutlined fontSize="small" sx={{ mr: 1.5 }}/>Настройки профиля</MenuItem><Divider/><MenuItem onClick={() => { setProfileMenu(null); void logout(); }}><LogoutRounded fontSize="small" sx={{ mr: 1.5 }}/>Выйти</MenuItem></Menu>
      <main tabIndex={-1} id="main-content" className="page-content">{firm ? <Outlet key={firmId}/> : <div className="empty-state"><Typography variant="h5">Нет доступных компаний</Typography><Typography color="text.secondary">Администратор должен предоставить доступ к рабочему пространству.</Typography><Button sx={{ mt: 2 }} onClick={() => void logout()}>Выйти <ArrowForwardRounded/></Button></div>}</main>
      <footer className="workspace-footer"><span>CertFlow</span><span>Управление декларациями о соответствии</span><span className="footer-label">Всё важное — в одном месте</span></footer>
    </div></div>;
}
