import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from './index';
import I18nBootstrap from './I18nBootstrap';

beforeEach(() => {
  localStorage.setItem('app-language', 'en');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('I18nBootstrap', () => {
  it('renders the application after critical initialization succeeds', async () => {
    const initialize = vi.fn().mockResolvedValue(i18n);

    render(
      <I18nBootstrap initialize={initialize}>
        <p>application ready</p>
      </I18nBootstrap>,
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('application ready')).toBeInTheDocument();
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('shows a visible error when critical initialization fails', async () => {
    const initialize = vi.fn().mockRejectedValue(new Error('translation import failed'));

    render(
      <I18nBootstrap initialize={initialize}>
        <p>application ready</p>
      </I18nBootstrap>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to start the application',
    );
    expect(screen.queryByText('application ready')).not.toBeInTheDocument();
  });

  it('retries critical initialization after a failure', async () => {
    const initialize = vi.fn()
      .mockRejectedValueOnce(new Error('temporary translation failure'))
      .mockResolvedValueOnce(i18n);

    render(
      <I18nBootstrap initialize={initialize}>
        <p>application ready</p>
      </I18nBootstrap>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('application ready')).toBeInTheDocument();
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('shows the startup error and retries when the application module fails to load', async () => {
    const initialize = vi.fn().mockResolvedValue(i18n);
    const Application = () => <p>application module ready</p>;
    const loadApplication = vi.fn()
      .mockRejectedValueOnce(new Error('application import failed'))
      .mockResolvedValueOnce({ default: Application });

    render(
      <I18nBootstrap
        initialize={initialize}
        loadApplication={loadApplication}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to start the application',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('application module ready')).toBeInTheDocument();
    expect(loadApplication).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['en', 'ltr', 'Loading application…'],
    ['ar', 'rtl', 'جارٍ تحميل التطبيق…'],
  ] as const)(
    'uses the persisted %s language during startup',
    async (language, direction, loadingText) => {
      localStorage.setItem('app-language', language);
      let completeInitialization: ((value: typeof i18n) => void) | undefined;
      const initialize = vi.fn(() => new Promise<typeof i18n>((resolve) => {
        completeInitialization = resolve;
      }));

      render(
        <I18nBootstrap initialize={initialize}>
          <p>application ready</p>
        </I18nBootstrap>,
      );

      expect(screen.getByRole('status')).toHaveTextContent(loadingText);
      expect(document.documentElement).toHaveAttribute('lang', language);
      expect(document.documentElement).toHaveAttribute('dir', direction);

      await waitFor(() => {
        expect(initialize).toHaveBeenCalledTimes(1);
      });
      completeInitialization?.(i18n);
      await waitFor(() => {
        expect(screen.getByText('application ready')).toBeInTheDocument();
      });
    },
  );
});
