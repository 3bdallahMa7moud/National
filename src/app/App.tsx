import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import ToastProvider from '@/components/ui/Toast';
import { ThemeProvider } from '@/hooks/useTheme';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { router } from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ErrorBoundary level="global" invalidateQueries>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
