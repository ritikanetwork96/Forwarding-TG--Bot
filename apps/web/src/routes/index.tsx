import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AdminLayout } from '../components/AdminLayout';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { SourcesPage } from '../pages/SourcesPage';
import { DestinationsPage } from '../pages/DestinationsPage';
import { RulesPage } from '../pages/RulesPage';
import { PublishLogsPage } from '../pages/PublishLogsPage';
import { ScheduledPage } from '../pages/ScheduledPage';
import { AdminsPage } from '../pages/AdminsPage';
import { PostsPage } from '../pages/PostsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/setup',
    element: <Navigate to="/login" replace />,
  },

  // Protected Admin routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <HomePage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/categories',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <CategoriesPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/sources',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <SourcesPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/destinations',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <DestinationsPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/rules',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <RulesPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/scheduled',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <ScheduledPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/logs',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <PublishLogsPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admins',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <AdminsPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/posts',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <PostsPage />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },

  // Catch-all 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
