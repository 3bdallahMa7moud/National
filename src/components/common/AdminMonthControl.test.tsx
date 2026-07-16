import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminMonthControl from './AdminMonthControl';

afterEach(cleanup);

const baseProps = {
  status: 'draft' as const,
  monthLabel: 'July 2026',
  assignmentCount: 12,
  tableClipboard: null,
  onCopy: () => ({ ok: true }),
  onPaste: () => ({ ok: true }),
  onClear: () => ({ ok: true }),
  onReset: () => ({ ok: true }),
};

describe('AdminMonthControl', () => {
  it('shows Copy Table and an always-visible Paste Table without restoring legacy controls', () => {
    render(<AdminMonthControl {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Copy Table' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear assignments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset table' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete month' })).not.toBeInTheDocument();
    expect(screen.queryByText(/copy previous/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lock|unlock/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/template|saved version/i)).not.toBeInTheDocument();
  });

  it('displays the successful operation message returned by the store', () => {
    render(
      <AdminMonthControl
        {...baseProps}
        onCopy={() => ({ ok: true, message: 'The exact copied-table result.' })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy Table' }));
    expect(screen.getByText('The exact copied-table result.')).toBeInTheDocument();
  });

  it('keeps the confirmation input focused while typing CLEAR and executes the action', async () => {
    const onClear = vi.fn(() => ({ ok: true }));
    render(<AdminMonthControl {...baseProps} status="published" onClear={onClear} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear assignments' }));
    const input = screen.getByLabelText('Type CLEAR to confirm');
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: 'CLEAR' } });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('CLEAR');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Type CLEAR to confirm')).not.toBeInTheDocument();
  });

  it('explains the overwrite and requires focused PASTE confirmation before executing paste', async () => {
    const onPaste = vi.fn(() => ({ ok: true, message: 'Store paste completed.' }));
    render(
      <AdminMonthControl
        {...baseProps}
        tableClipboard={{ sourceMonthLabel: 'June 2026', assignmentCount: 27 }}
        onPaste={onPaste}
      />,
    );

    const pasteButton = screen.getByRole('button', { name: 'Paste Table' });
    expect(pasteButton).toBeEnabled();
    fireEvent.click(pasteButton);

    expect(screen.getByText(/overwrite the entire July 2026 table/i)).toHaveTextContent('June 2026');
    expect(screen.getByText('Source: June 2026')).toBeInTheDocument();
    expect(screen.getByText('Target: July 2026')).toBeInTheDocument();
    const input = screen.getByLabelText('Type PASTE to confirm');
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();

    fireEvent.change(input, { target: { value: 'paste' } });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('PASTE');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Type PASTE to confirm')).not.toBeInTheDocument();
    expect(screen.getByText('Store paste completed.')).toBeInTheDocument();
  });
});
