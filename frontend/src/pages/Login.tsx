import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Alert, Button, IconButton, InputAdornment, Tab, Tabs, TextField, Typography } from '@mui/material';
import { ArrowForwardRounded } from '@mui/icons-material';
import { VisibilityOutlined } from '@mui/icons-material';
import { VisibilityOffOutlined } from '@mui/icons-material';
import { BrandMark } from '../Brand';
import { useEffect } from 'react';
import { authenticated, authRequest } from '../store';
import { errorMessage } from '../types';
import { Brand, ThemeSwitch } from '../Layout';
import { ColorThemeMenu } from '../ColorThemeMenu';
import { API_IS_CROSS_ORIGIN, SERVER_APP_URL } from '../apiUrl';
import { CertificateLoginForm } from '../CertificateLoginForm';
import type { AuthResponse } from '../types';

export function Login() {
  useEffect(() => { document.title = 'Вход — ZNAQ'; }, []);
  const dispatch = useDispatch();
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [method, setMethod] = useState<'password' | 'certificate'>('password');
  async function finishLogin(auth: AuthResponse) {
    setCookieBlocked(false);
    if (API_IS_CROSS_ORIGIN) {
      try { auth = await authRequest('refresh'); }
      catch (refreshError) {
        if ((refreshError as { status?: number }).status === 401) {
          setCookieBlocked(true);
          setError('Браузер не сохранил защищённую сессию между сайтами. Обновите браузер или откройте серверную версию.');
          return;
        }
        throw refreshError;
      }
    }
    dispatch(authenticated(auth));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setCookieBlocked(false);
    try {
      await finishLogin(await authRequest('login', { userName: username, password }));
    }
    catch (e) {
      const status = (e as { status?: number }).status;
      setError(status !== undefined && status >= 500 || e instanceof TypeError
        ? 'Сервис входа сейчас недоступен. Повторите попытку после запуска сервера.'
        : errorMessage(e));
    } finally { setBusy(false); }
  }
  return <div className="login-page">
    <aside className="login-story"><div className="login-story-brand"><div className="brand"><Brand/></div><span>COMPLIANCE PLATFORM</span></div>
      <div className="login-story-content"><div className="login-kicker"><i/>ТОЧНОСТЬ ИМЕЕТ ЗНАК</div><h1>Сложные процессы.<br/><span>Ясные решения.</span></h1><p>Декларации, сертификация и маркировка.<br/>Одна платформа для тех, кто отвечает за результат.</p>
        <div className="login-brand-visual" aria-hidden="true"><div className="brand-visual-grid"/><div className="brand-visual-orbit"/><BrandMark className="brand-visual-symbol"/><span className="brand-visual-coordinate">Z / 01</span><span className="brand-visual-label">BUILT FOR CLARITY</span><div className="brand-visual-node node-documents"><i/>Документы</div><div className="brand-visual-node node-marking"><i/>Маркировка</div></div>
      </div><div className="login-story-footer"><span>От данных — к допуску на рынок.</span><span>ZNAQ © {new Date().getFullYear()}</span></div>
    </aside>
    <main className="login-main"><div className="login-toolbar"><span>ZNAQ WORKSPACE</span><div className="login-theme-controls"><ColorThemeMenu/><ThemeSwitch/></div></div>
      <div className="login-branding"><div className="brand"><Brand/></div><span className="login-access-label">ДОСТУП К ПЛАТФОРМЕ</span></div>
      <div className="login-form"><Typography variant="h4" component="h2" sx={{ fontSize: 32 }}>С возвращением</Typography><Typography color="text.secondary" sx={{ mt: 1.5, mb: 4 }}>Войдите, чтобы продолжить работу.</Typography>
      <Tabs value={method} onChange={(_, value) => { setMethod(value); setError(''); setCookieBlocked(false); }} variant="fullWidth" aria-label="Способ входа" sx={{ mb: 3 }}><Tab label="По паролю" value="password" disabled={busy}/><Tab label="По ЭЦП" value="certificate" disabled={busy}/></Tabs>
      {method === 'certificate' ? <CertificateLoginForm busy={busy} setBusy={setBusy} onLogin={finishLogin} onError={setError}/> : <form onSubmit={submit}><label htmlFor="login-username" className="field-label">Логин</label><TextField id="login-username" autoComplete="username" required placeholder="Введите логин" inputProps={{ 'aria-label': 'Логин', maxLength: 100, autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }} value={username} onChange={e => setUsername(e.target.value)}/>
        <label htmlFor="login-password" className="field-label" style={{ marginTop: 23 }}>Пароль</label><TextField id="login-password" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Введите пароль" inputProps={{ 'aria-label': 'Пароль', maxLength: 200 }} value={password} onChange={e => setPassword(e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end"><IconButton aria-pressed={show} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShow(!show)} edge="end">{show ? <VisibilityOffOutlined fontSize="small"/> : <VisibilityOutlined fontSize="small"/>}</IconButton></InputAdornment> }}/>
        <Button fullWidth variant="contained" type="submit" disabled={busy} aria-busy={busy} endIcon={<ArrowForwardRounded/>} sx={{ mt: 4, py: 1.7 }}>{busy ? 'Входим…' : 'Войти в ZNAQ'}</Button>
      </form>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {cookieBlocked && <Button href={SERVER_APP_URL} fullWidth variant="outlined" sx={{ mt: 2 }}>Открыть серверную версию</Button>}
      <p className="login-help">Нет доступа? Обратитесь к администратору вашей компании.</p>
    </div><div className="login-main-footer">ZNAQ © {new Date().getFullYear()}<span>Точность имеет знак.</span></div></main>
  </div>;
}

