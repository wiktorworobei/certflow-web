import { lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import type { RootState } from './store';
import { Loading, Notifications } from './common';
import { Layout } from './Layout';
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Overview = lazy(() =>
  import('./pages/Overview').then((module) => ({ default: module.Overview })),
);
const Registry = lazy(() =>
  import('./pages/Registry').then((module) => ({ default: module.Registry })),
);
const DeclarationEditor = lazy(() =>
  import('./pages/DeclarationEditor').then((module) => ({ default: module.DeclarationEditor })),
);
const NewDeclaration = lazy(() =>
  import('./pages/NewDeclaration').then((module) => ({ default: module.NewDeclaration })),
);
const Instruction = lazy(() =>
  import('./pages/Instruction').then((module) => ({ default: module.Instruction })),
);
const Directories = lazy(() =>
  import('./pages/Directories').then((module) => ({ default: module.Directories })),
);
const Settings = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings })),
);
const Team = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Team })));
const DevelopmentPlan = lazy(() =>
  import('./pages/DevelopmentPlan').then((module) => ({ default: module.DevelopmentPlan })),
);
const Marking = lazy(() =>
  import('./pages/Marking').then((module) => ({ default: module.Marking })),
);
const Catalog = lazy(() =>
  import('./pages/Catalog').then((module) => ({ default: module.Catalog })),
);
const Crpt = lazy(() => import('./pages/Crpt').then((module) => ({ default: module.Crpt })));
const RegistryChecks = lazy(() =>
  import('./pages/RegistryChecks').then((module) => ({ default: module.RegistryChecks })),
);

export default function App() {
  const session = useSelector((s: RootState) => s.session);
  if (!session.ready)
    return (
      <div className="full-loading">
        <div className="brand-icon">C</div>
        <CircularProgress size={24} />
      </div>
    );
  return (
    <Notifications>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={session.user ? <Navigate to="/" replace /> : <Login />} />
          <Route element={session.user ? <Layout /> : <Navigate to="/login" replace />}>
            <Route index element={<Overview />} />
            <Route path="declarations" element={<Registry />} />
            <Route path="declarations/new" element={<NewDeclaration />} />
            <Route path="declarations/:id" element={<DeclarationEditor />} />
            <Route path="instruction" element={<Instruction />} />
            <Route
              path="directories"
              element={
                <Suspense fallback={<Loading />}>
                  <Directories />
                </Suspense>
              }
            />
            <Route
              path="development-plan"
              element={
                <Suspense fallback={<Loading />}>
                  <DevelopmentPlan />
                </Suspense>
              }
            />
            <Route path="integrations" element={<Navigate to="/settings" replace />} />
            <Route
              path="marking"
              element={
                <Suspense fallback={<Loading />}>
                  <Marking />
                </Suspense>
              }
            />
            <Route
              path="catalog"
              element={
                <Suspense fallback={<Loading />}>
                  <Catalog />
                </Suspense>
              }
            />
            <Route
              path="crpt"
              element={
                <Suspense fallback={<Loading />}>
                  <Crpt />
                </Suspense>
              }
            />
            <Route
              path="registries"
              element={
                <Suspense fallback={<Loading />}>
                  <RegistryChecks />
                </Suspense>
              }
            />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </Notifications>
  );
}
