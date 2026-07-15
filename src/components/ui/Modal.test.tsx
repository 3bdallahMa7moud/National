import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal focus management', () => {
  it('keeps focus on the requested confirmation field instead of the close button', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Confirm action">
        <input aria-label="Confirmation text" data-modal-autofocus />
      </Modal>,
    );

    const input = screen.getByLabelText('Confirmation text');
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: 'CLEAR' } });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('CLEAR');
  });
});
