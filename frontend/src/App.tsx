import { lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import type { RootState } from './store';
import { Loading, Notifications } from './common';
import { Layout } from './Layout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Registry } from './pages/Registry';
import { DeclarationEditor } from './pages/DeclarationEditor';
const Directories = lazy(() => import('./pages/Directories').then(module => ({ default: module.Directories })));
import { Settings, Team } from './pages/Settings';
const DevelopmentPlan = lazy(() => import('./pages/DevelopmentPlan').then(module => ({ default: module.DevelopmentPlan })));
const Marking = lazy(() => import('./pages/Marking').then(module => ({ default: module.Marking })));
const Catalog = lazy(() => import('./pages/Catalog').then(module => ({ default: module.Catalog })));

export default function App() {
  const session = useSelector((s: RootState) => s.session);
  if (!session.ready) return <div className="full-loading"><div className="brand-icon">C</div><CircularProgress size={24}/></div>;
  return <Notifications><Routes>
    <Route path="/login" element={session.user ? <Navigate to="/" replace/> : <Login/>}/>
    <Route element={session.user ? <Layout/> : <Navigate to="/login" replace/>}>
      <Route index element={<Overview/>}/><Route path="declarations" element={<Registry/>}/>
      <Route path="declarations/new" element={<DeclarationEditor/>}/><Route path="declarations/:id" element={<DeclarationEditor/>}/>
      <Route path="directories" element={<Suspense fallback={<Loading/>}><Directories/></Suspense>}/><Route path="development-plan" element={<Suspense fallback={<Loading/>}><DevelopmentPlan/></Suspense>}/>
      <Route path="integrations" element={<Navigate to="/settings" replace/>}/>
      <Route path="marking" element={<Suspense fallback={<Loading/>}><Marking/></Suspense>}/>
      <Route path="catalog" element={<Suspense fallback={<Loading/>}><Catalog/></Suspense>}/>
      <Route path="team" element={<Team/>}/><Route path="settings" element={<Settings/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Route>
  </Routes></Notifications>;
}
