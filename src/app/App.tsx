import { RouterProvider } from 'react-router-dom';
import ToastProvider from '@/components/ui/Toast';
import { ThemeProvider } from '@/hooks/useTheme';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { router } from './routes';
import BackendSessionBootstrap from './BackendSessionBootstrap';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary level="global" invalidateQueries>
          <BackendSessionBootstrap />
          <RouterProvider router={router} />
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}
