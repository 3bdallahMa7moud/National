import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { queryClient } from '@/lib/queryClient';

// Mock i18next hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}));

function ProblemChild({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test crash error');
  }
  return <div>Safe Child Content</div>;
}

describe('ErrorBoundary Component', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn(); // Suppress expected error logs from ErrorBoundary in test output
  });

  afterEach(() => {
    cleanup();
    console.error = originalConsoleError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Child Content')).toBeInTheDocument();
  });

  it('renders ErrorState when a child throws an error', () => {
    render(
      <ErrorBoundary level="section" title="Custom Section Error">
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Section Error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('resets error state and calls onReset when retry is clicked', () => {
    const onResetMock = vi.fn();
    let throwError = true;

    function DynamicChild() {
      if (throwError) {
        throw new Error('Dynamic error');
      }
      return <div>Recovered Content</div>;
    }

    render(
      <ErrorBoundary onReset={onResetMock}>
        <DynamicChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Change flag before clicking retry button
    throwError = false;

    const retryButton = screen.getByRole('button', { name: 'common:errorState.resetSection' });
    fireEvent.click(retryButton);

    expect(onResetMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Recovered Content')).toBeInTheDocument();
  });

  it('invalidates queries when invalidateQueries is set to true on reset', () => {
    render(
      <ErrorBoundary invalidateQueries>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: 'common:errorState.resetSection' });
    fireEvent.click(retryButton);

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('renders function fallback when provided', () => {
    render(
      <ErrorBoundary
        fallback={({ error, resetErrorBoundary }) => (
          <div>
            <span>Custom Fallback: {error.message}</span>
            <button onClick={resetErrorBoundary}>Custom Reset</button>
          </div>
        )}
      >
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Fallback: Test crash error')).toBeInTheDocument();
  });
});
