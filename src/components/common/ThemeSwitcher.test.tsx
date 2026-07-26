import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import ThemeSwitcher from './ThemeSwitcher';

describe('ThemeSwitcher popover focus', () => {
  afterEach(cleanup);

  it('links the trigger to the popover and restores focus after Escape', async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher variant="default" />
      </ThemeProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Appearance' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Appearance' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    await waitFor(() => {
      expect(dialog.querySelector('[aria-pressed="true"]')).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
