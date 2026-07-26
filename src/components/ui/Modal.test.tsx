import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal focus management', () => {
  afterEach(cleanup);

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

  it('wraps Tab and Shift+Tab within the dialog', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Keyboard dialog" showClose={false}>
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Modal>,
    );

    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('closes on Escape and restores focus to the opener', async () => {
    function ModalHarness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>Open dialog</button>
          <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title="Restoring dialog"
            showClose={false}
          >
            <button type="button">Dialog action</button>
          </Modal>
        </>
      );
    }

    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dialog action' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('makes background content inert and redirects escaped focus', async () => {
    const { container } = render(
      <>
        <button type="button">Background action</button>
        <Modal isOpen onClose={vi.fn()} title="Contained dialog" showClose={false}>
          <button type="button">Inside action</button>
        </Modal>
      </>,
    );

    const background = screen.getByRole('button', { name: 'Background action', hidden: true });
    const inside = screen.getByRole('button', { name: 'Inside action' });
    await waitFor(() => expect(inside).toHaveFocus());

    expect(container.inert).toBe(true);
    background.focus();
    expect(inside).toHaveFocus();
  });

  it('connects the dialog name and visible description', () => {
    render(
      <Modal
        isOpen
        onClose={vi.fn()}
        title="Delete schedule"
        descriptionId="delete-schedule-description"
      >
        <p id="delete-schedule-description">This action cannot be undone.</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete schedule' });
    expect(dialog).toHaveAttribute('aria-describedby', 'delete-schedule-description');
    expect(screen.getByText('This action cannot be undone.')).toHaveAttribute(
      'id',
      'delete-schedule-description',
    );
  });
});
