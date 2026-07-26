import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Input from './Input';

describe('Input accessibility relationships', () => {
  afterEach(cleanup);

  it('connects a stable generated hint ID to the input', () => {
    const { rerender } = render(
      <Input label="Employee number" hint="Use the number on your badge." />,
    );

    const input = screen.getByLabelText('Employee number');
    const initialId = input.id;
    const initialDescriptionId = input.getAttribute('aria-describedby');
    expect(initialId).toBeTruthy();
    expect(initialDescriptionId).toBeTruthy();
    expect(screen.getByText('Use the number on your badge.')).toHaveAttribute(
      'id',
      initialDescriptionId,
    );

    rerender(<Input label="Employee number" hint="Use the number on your badge." />);
    expect(screen.getByLabelText('Employee number')).toHaveAttribute('id', initialId);
    expect(screen.getByLabelText('Employee number')).toHaveAttribute(
      'aria-describedby',
      initialDescriptionId,
    );
  });

  it('marks an errored field invalid and merges external descriptions', () => {
    render(
      <>
        <span id="password-requirements">At least six characters.</span>
        <Input
          id="new-password"
          label="New password"
          error="Password is required."
          aria-describedby="password-requirements"
        />
      </>,
    );

    const input = screen.getByLabelText('New password');
    const error = screen.getByRole('alert');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(error).toHaveAttribute('id', 'new-password-error');
    expect(input).toHaveAttribute(
      'aria-describedby',
      'password-requirements new-password-error',
    );
  });

  it('honors caller-provided invalid state and hint/error IDs', () => {
    render(
      <Input
        label="Code"
        hint="Six digits"
        hintId="code-hint"
        errorId="code-error"
        aria-invalid="grammar"
      />,
    );

    const input = screen.getByLabelText('Code');
    expect(input).toHaveAttribute('aria-invalid', 'grammar');
    expect(input).toHaveAttribute('aria-describedby', 'code-hint');
    expect(screen.getByText('Six digits')).toHaveAttribute('id', 'code-hint');
  });
});
