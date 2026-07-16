import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorState from './ErrorState';
import { queryClient } from '@/lib/queryClient';

export interface ErrorBoundaryProps {
  children: ReactNode;
  level?: 'global' | 'route' | 'section';
  title?: string;
  message?: string;
  onReset?: () => void;
  fallback?: ReactNode | ((props: { error: Error; resetErrorBoundary: () => void }) => ReactNode);
  invalidateQueries?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const level = this.props.level || 'section';
    console.error(`[ErrorBoundary (${level})] caught an error:`, error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    if (this.props.invalidateQueries) {
      void queryClient.invalidateQueries();
    }
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback, level = 'section', title, message } = this.props;

      if (typeof fallback === 'function') {
        return fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      if (fallback) {
        return fallback;
      }

      return (
        <ErrorState
          level={level}
          title={title}
          message={message}
          error={this.state.error}
          onRetry={this.resetErrorBoundary}
          onReload={level === 'global' ? () => window.location.reload() : undefined}
        />
      );
    }

    return this.props.children;
  }
}
