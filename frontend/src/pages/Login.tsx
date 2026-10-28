import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Alert, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { ArrowForwardRounded } from '@mui/icons-material';
import { VisibilityOutlined } from '@mui/icons-material';
import { VisibilityOffOutlined } from '@mui/icons-material';
import { CheckRounded } from '@mui/icons-material';
import { authenticated, authRequest } from '../store';
import { errorMessage } from '../types';
import { Brand, ThemeSwitch } from '../Layout';
import { ColorThemeMenu } from '../ColorThemeMenu';
import { API_IS_CROSS_ORIGIN, SERVER_APP_URL } from '../apiUrl';

export function Login() {
  const dispatch = useDispatch();
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setCookieBlocked(false);
    try {
      let auth = await authRequest('login', { userName: username, password });
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
    catch (e) {
      const status = (e as { status?: number }).status;
      setError(status !== undefined && status >= 500 || e instanceof TypeError
        ? 'Сервис входа сейчас недоступен. Повторите попытку после запуска сервера.'
        : errorMessage(e));
    } finally { setBusy(false); }
  }
  return <div className="login-page">
    <aside className="login-story"><div className="brand"><Brand/></div>
      <div className="login-story-content"><div className="login-kicker">ДОКУМЕНТЫ. ПОРЯДОК. КОНТРОЛЬ.</div><h1>От первого поля<br/>до готовой<br/><span>декларации.</span></h1><p>Рабочее пространство для документов,<br/>компаний и специалистов по сертификации.</p>
        <div className="login-document"><div className="login-doc-head"><div className="mini-doc-icon">CF</div><div><strong>Декларация о соответствии</strong><span>Все сведения в одном месте</span></div><div className="login-check"><CheckRounded fontSize="small"/></div></div><div className="doc-line long"/><div className="doc-line"/><div className="doc-line medium"/><div className="doc-divider"/><div className="doc-bottom"><span>Заявитель · Продукция · Испытания</span><span>↗</span></div></div>
      </div><div className="login-story-footer">Меньше рутины. Больше уверенности в данных.</div>
    </aside>
    <main className="login-main"><div className="login-toolbar"><span>ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</span><div className="login-theme-controls"><ColorThemeMenu/><ThemeSwitch/></div></div>
      <div className="login-branding"><div className="login-company"><strong>Tom <span>Incorporation</span></strong></div></div>
      <div className="login-form"><Typography variant="h4" component="h2" sx={{ fontSize: 32 }}>С возвращением</Typography><Typography color="text.secondary" sx={{ mt: 1.5, mb: 4 }}>Войдите в своё рабочее пространство</Typography>
      <form onSubmit={submit}><label htmlFor="login-username" className="field-label">Логин</label><TextField id="login-username" autoComplete="username" required placeholder="Введите логин" inputProps={{ 'aria-label': 'Логин', maxLength: 100, autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }} value={username} onChange={e => setUsername(e.target.value)}/>
        <label htmlFor="login-password" className="field-label" style={{ marginTop: 23 }}>Пароль</label><TextField id="login-password" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Введите пароль" inputProps={{ 'aria-label': 'Пароль', maxLength: 200 }} value={password} onChange={e => setPassword(e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end"><IconButton aria-pressed={show} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShow(!show)} edge="end">{show ? <VisibilityOffOutlined fontSize="small"/> : <VisibilityOutlined fontSize="small"/>}</IconButton></InputAdornment> }}/>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {cookieBlocked && <Button href={SERVER_APP_URL} fullWidth variant="outlined" sx={{ mt: 2 }}>Открыть серверную версию</Button>}
        <Button fullWidth variant="contained" type="submit" disabled={busy} aria-busy={busy} endIcon={<ArrowForwardRounded/>} sx={{ mt: 4, py: 1.7 }}>{busy ? 'Входим…' : 'Войти в CertFlow'}</Button>
      </form><p className="login-help">Нет доступа? Обратитесь к администратору вашей компании.</p>
    </div><div className="login-main-footer">CertFlow © {new Date().getFullYear()}<span>Управление декларациями</span></div></main>
  </div>;
}

