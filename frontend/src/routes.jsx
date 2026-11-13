import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import Skeleton from './ui/Skeleton.jsx';
import AppShell from './layout/AppShell.jsx';
import PageLayout from './layout/PageLayout.jsx';
import MapLayout from './pages/map/MapLayout.jsx';
import MapHome from './pages/map/MapHome.jsx';
import SearchPage from './pages/search/SearchPage.jsx';
import PlaceSheet from './pages/place/PlaceSheet.jsx';
import StopSheet from './pages/place/StopSheet.jsx';
import RoutePlanner from './pages/route/RoutePlanner.jsx';
const ReportFlow = lazy(() => import('./pages/report/ReportFlow.jsx'));
const ReportPublic = lazy(() => import('./pages/report/ReportPublic.jsx'));
const NavigationPage = lazy(() => import('./pages/navigation/NavigationPage.jsx'));
const ProfilePage = lazy(() => import('./pages/account/ProfilePage.jsx'));
const MyReports = lazy(() => import('./pages/account/MyReports.jsx'));
const PrivacyPage = lazy(() => import('./pages/account/PrivacyPage.jsx'));
import NeedsPick from './pages/onboarding/NeedsPick.jsx';
import NeedsAdjust from './pages/onboarding/NeedsAdjust.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import CheckEmail from './pages/auth/CheckEmail.jsx';
import NewPassword from './pages/auth/NewPassword.jsx';
import LinkExpired from './pages/auth/LinkExpired.jsx';
import ConfirmAccount from './pages/auth/ConfirmAccount.jsx';
import AdminShell, { AdminSection } from './admin/AdminShell.jsx';
const ReportsPage = lazy(() => import('./admin/pages/ReportsPage.jsx'));
const WorksPage = lazy(() => import('./admin/pages/WorksPage.jsx'));
const ProjectsPage = lazy(() => import('./admin/pages/ProjectsPage.jsx'));
const PlacesPage = lazy(() => import('./admin/pages/PlacesPage.jsx'));
const StreetsPage = lazy(() => import('./admin/pages/StreetsPage.jsx'));
const VehiclesPage = lazy(() => import('./admin/pages/VehiclesPage.jsx'));
const OverviewPage = lazy(() => import('./admin/pages/OverviewPage.jsx'));
const StatsPage = lazy(() => import('./admin/pages/StatsPage.jsx'));
const AdminMapPage = lazy(() => import('./admin/pages/AdminMapPage.jsx'));
const UsersPage = lazy(() => import('./admin/pages/UsersPage.jsx'));
import { RequireAuth, RequireRole, RequireVerified } from './auth/guards.jsx';

// Paginile grele (navigarea, raportarea, contul, administrarea) se încarcă abia când sunt deschise.
function Page({ component: C, ...props }) {
  return (
    <Suspense fallback={<div className="flex flex-1 p-6"><Skeleton text="Se încarcă pagina…" className="w-full max-w-xl" /></div>}>
      <C {...props} />
    </Suspense>
  );
}

// Rutele aplicației.
export const routes = [
  // Cont (A1–A6) și bun venit (B1, B2): fără bara de navigare a aplicației
  { path: '/autentificare', element: <Login /> },
  { path: '/inregistrare', element: <Register /> },
  { path: '/parola-uitata', element: <ForgotPassword /> },
  { path: '/verifica-email', element: <CheckEmail /> },
  { path: '/parola-noua', element: <NewPassword /> },
  { path: '/link-expirat', element: <LinkExpired /> },
  { path: '/confirmare', element: <ConfirmAccount /> },
  { path: '/bun-venit', element: <RequireAuth><NeedsPick /></RequireAuth> },
  // Navigarea pas cu pas: ecran întreg, fără bara de taburi (D4)
  { path: '/navigare', element: <RequireAuth><Page component={NavigationPage}  /></RequireAuth> },
  { path: '/bun-venit/ajustare', element: <RequireAuth><NeedsAdjust /></RequireAuth> },
  {
    // Panoul de administrare (X1–X14): layout separat, doar pentru conturile de administrare.
    path: '/admin',
    element: <RequireRole roles={['admin', 'superadmin']}><AdminShell /></RequireRole>,
    children: [
      { index: true, element: <AdminSection id="prezentare"><Page component={OverviewPage}  /></AdminSection> },
      { path: 'rapoarte', element: <AdminSection id="rapoarte"><Page component={ReportsPage}  /></AdminSection> },
      { path: 'harta', element: <AdminSection id="harta"><Page component={AdminMapPage}  /></AdminSection> },
      { path: 'lucrari', element: <AdminSection id="lucrari"><Page component={WorksPage}  /></AdminSection> },
      { path: 'proiecte', element: <AdminSection id="proiecte"><Page component={ProjectsPage}  /></AdminSection> },
      { path: 'dotari', element: <AdminSection id="dotari"><Page component={PlacesPage}  /></AdminSection> },
      { path: 'strazi', element: <AdminSection id="dotari"><Page component={StreetsPage}  /></AdminSection> },
      { path: 'vehicule', element: <AdminSection id="vehicule"><Page component={VehiclesPage}  /></AdminSection> },
      { path: 'statistici', element: <AdminSection id="statistici"><Page component={StatsPage}  /></AdminSection> },
      { path: 'utilizatori', element: <AdminSection id="utilizatori"><Page component={UsersPage}  /></AdminSection> },
      { path: '*', element: <Navigate to="/admin/rapoarte" replace /> },
    ],
  },
  {
    element: <AppShell />,
    children: [
      {
        // O singură hartă rămâne montată pentru toate ecranele de mai jos.
        element: <MapLayout />,
        children: [
          { index: true, element: <MapHome /> },
          { path: 'cauta', element: <SearchPage /> },
          { path: 'loc/:id', element: <PlaceSheet /> },
          { path: 'statie/:id', element: <StopSheet /> },
          { path: 'traseu', element: <RequireAuth><RoutePlanner /></RequireAuth> },
          { path: 'raporteaza', element: <RequireVerified><Page component={ReportFlow}  /></RequireVerified> },
        ],
      },
      {
        element: <PageLayout />,
        children: [
          { path: 'profil/nevoi', element: <RequireAuth><NeedsAdjust editing /></RequireAuth> },
          { path: 'confidentialitate', element: <Page component={PrivacyPage}  /> },
        ],
      },
      {
        element: <PageLayout wide />,
        children: [
          { path: 'raport/:code', element: <Page component={ReportPublic}  /> },
          { path: 'profil', element: <RequireAuth><Page component={ProfilePage}  /></RequireAuth> },
          { path: 'rapoartele-mele', element: <RequireAuth><Page component={MyReports}  /></RequireAuth> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
