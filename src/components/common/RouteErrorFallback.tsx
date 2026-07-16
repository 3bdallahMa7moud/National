import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import ErrorState from './ErrorState';
import NotFoundPage from '@/features/auth/NotFoundPage';
import ForbiddenPage from '@/features/auth/ForbiddenPage';
import { useAuthStore } from '@/stores/authStore';

export default function RouteErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    if (error.status === 403) {
      return <ForbiddenPage />;
    }
  }

  const handleHome = () => {
    if (user?.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (user?.role === 'employee') {
      navigate('/employee/dashboard');
    } else {
      navigate('/login');
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <ErrorState
        level="route"
        error={error}
        onHome={handleHome}
        onReload={handleReload}
      />
    </div>
  );
}
