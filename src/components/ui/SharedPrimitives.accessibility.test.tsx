import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';

describe('shared primitive accessibility', () => {
  afterEach(cleanup);

  it('has no detectable axe violations for labeled form controls and actions', async () => {
    render(
      <form aria-label="Employee lookup">
        <Input
          label="Employee number"
          hint="Use the number printed on the badge."
        />
        <Button type="submit">Search</Button>
      </form>,
    );

    await expectNoAxeViolations(document.body);
  });

  it('has no detectable axe violations for an open modal', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Confirm schedule">
        <p id="schedule-confirmation">Review the schedule before publishing.</p>
        <Button>Publish schedule</Button>
      </Modal>,
    );

    await expectNoAxeViolations(document.body);
  });
});
