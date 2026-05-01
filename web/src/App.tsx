import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import OrgOverview from './pages/OrgOverview';
import TeamList from './pages/TeamList';
import TeamDetail from './pages/TeamDetail';
import DeveloperList from './pages/DeveloperList';
import DeveloperDetail from './pages/DeveloperDetail';
import GitHubProductPage from './pages/GitHubProductPage';
import M365ProductPage from './pages/M365ProductPage';
import AdminIdentity from './pages/AdminIdentity';
import AdminPipelines from './pages/AdminPipelines';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <OrgOverview /> },
      { path: 'teams', element: <TeamList /> },
      { path: 'teams/:name', element: <TeamDetail /> },
      { path: 'developers', element: <DeveloperList /> },
      { path: 'developers/:username', element: <DeveloperDetail /> },
      { path: 'products/github', element: <GitHubProductPage /> },
      { path: 'products/m365', element: <M365ProductPage /> },
      { path: 'admin/identity', element: <AdminIdentity /> },
      { path: 'admin/pipelines', element: <AdminPipelines /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
