import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { changeLanguage } from '@/i18n';
import { expectNoAxeViolations } from '@/test/axe';
import LoginPage from './LoginPage';

describe('LoginPage automated accessibility', () => {
  beforeEach(async () => {
    await changeLanguage('en');
  });

  afterEach(cleanup);

  it('has no detectable axe violations in its initial state', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await expectNoAxeViolations(document.body);
  });
});
