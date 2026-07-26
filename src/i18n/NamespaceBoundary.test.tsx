import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, {
  changeLanguage,
  loadNamespace,
} from './index';
import { CRITICAL_NAMESPACES, NAMESPACES, type Namespace } from './constants';
import * as resourceLoader from './resourceLoader';
import NamespaceBoundary from './NamespaceBoundary';

const FEATURE_NAMESPACES = NAMESPACES.filter(
  (namespace) =>
    !CRITICAL_NAMESPACES.includes(namespace as (typeof CRITICAL_NAMESPACES)[number]),
);
const DASHBOARD_NAMESPACE = ['dashboard'] as const satisfies readonly Namespace[];

beforeEach(async () => {
  localStorage.setItem('app-language', 'en');
  await changeLanguage('en');
  for (const namespace of FEATURE_NAMESPACES) {
    i18n.removeResourceBundle('en', namespace);
    i18n.removeResourceBundle('ar', namespace);
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('translation namespace loading', () => {
  it('initializes only the critical namespaces before feature rendering', () => {
    for (const namespace of CRITICAL_NAMESPACES) {
      expect(i18n.hasResourceBundle('en', namespace)).toBe(true);
    }
    for (const namespace of FEATURE_NAMESPACES) {
      expect(i18n.hasResourceBundle('en', namespace)).toBe(false);
    }
  });

  it('loads a feature namespace before rendering its content', async () => {
    const importSpy = vi.spyOn(resourceLoader, 'importNamespaceResources');

    render(
      <NamespaceBoundary namespaces={DASHBOARD_NAMESPACE}>
        <p>dashboard feature</p>
      </NamespaceBoundary>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    expect(screen.queryByText('dashboard feature')).not.toBeInTheDocument();
    expect(await screen.findByText('dashboard feature')).toBeInTheDocument();
    expect(importSpy).toHaveBeenCalledWith('en', 'dashboard');
  });

  it('does not duplicate concurrent or already completed namespace loads', async () => {
    const importSpy = vi.spyOn(resourceLoader, 'importNamespaceResources');

    await Promise.all([
      loadNamespace('dashboard', 'en'),
      loadNamespace('dashboard', 'en'),
    ]);
    await loadNamespace('dashboard', 'en');

    expect(importSpy).toHaveBeenCalledTimes(1);
  });

  it('loads critical Arabic resources and preserves RTL language switching', async () => {
    await changeLanguage('ar');

    expect(i18n.language).toBe('ar');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    for (const namespace of CRITICAL_NAMESPACES) {
      expect(i18n.hasResourceBundle('ar', namespace)).toBe(true);
    }
  });
});
