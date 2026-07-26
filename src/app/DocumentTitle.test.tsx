import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { changeLanguage } from '@/i18n';
import DocumentTitle from './DocumentTitle';

function NavigationHarness() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/admin/schedule')}>
        Open schedule
      </button>
      <button type="button" onClick={() => navigate('/not-a-real-route')}>
        Open unknown route
      </button>
    </>
  );
}

beforeEach(async () => {
  await changeLanguage('en');
});

afterEach(() => {
  cleanup();
});

describe('DocumentTitle', () => {
  it('updates the title during client-side navigation and falls back for unknown routes', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <DocumentTitle>
          <NavigationHarness />
        </DocumentTitle>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.title).toBe('Sign In | CT Scan Scheduling');
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'index, follow',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open schedule' }));
    await waitFor(() => {
      expect(document.title).toBe('Schedule Management | CT Scan Scheduling');
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow, noarchive',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open unknown route' }));
    await waitFor(() => {
      expect(document.title).toBe('Page not found | CT Scan Scheduling');
    });
  });

  it('uses the loading fallback at the root route', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <DocumentTitle>
          <div>Loading route</div>
        </DocumentTitle>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.title).toBe('Loading... | CT Scan Scheduling');
    });
  });

  it('updates route and application titles when the language changes', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <DocumentTitle>
          <div>Login route</div>
        </DocumentTitle>
      </MemoryRouter>,
    );

    await changeLanguage('ar');

    await waitFor(() => {
      expect(document.title).toBe('تسجيل الدخول | جدولة الأشعة المقطعية');
    });
  });
});
