import { lazy, Suspense } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteErrorFallback from '@/components/common/RouteErrorFallback';
import { changeLanguage } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';

describe('route chunk failure behavior', () => {
  beforeEach(async () => {
    await changeLanguage('en');
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('replaces a rejected lazy import with a recoverable route error', async () => {
    const importFailure = new Error('Loading chunk 42 failed');
    const FailedRoute = lazy(() => Promise.reject(importFailure));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const router = createMemoryRouter(
      [
        {
          path: '/broken',
          element: (
            <Suspense fallback={<p role="status">Loading route</p>}>
              <FailedRoute />
            </Suspense>
          ),
          errorElement: <RouteErrorFallback />,
        },
        {
          path: '/login',
          element: <p>Login destination</p>,
        },
      ],
      { initialEntries: ['/broken'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Page load error');
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
  });
});
