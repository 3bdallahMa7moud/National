import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  errorId?: string;
  hintId?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    hint,
    errorId: providedErrorId,
    hintId: providedHintId,
    className,
    id,
    'aria-describedby': providedDescribedBy,
    'aria-invalid': providedInvalid,
    ...props
  }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? `input-${generatedId}`;
    const errorId = providedErrorId ?? `${inputId}-error`;
    const hintId = providedHintId ?? `${inputId}-hint`;
    const activeDescriptionId = error ? errorId : hint ? hintId : undefined;
    const describedBy = [providedDescribedBy, activeDescriptionId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-primary mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={providedInvalid ?? (error ? true : undefined)}
          aria-describedby={describedBy}
          className={cn(
            'input-field',
            error && 'border-danger focus:ring-danger/20 focus:border-danger',
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-danger">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-text-secondary">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
