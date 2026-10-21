import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';

// React 19: `ref` is a regular prop, so callers can focus the input (e.g. first invalid field).
interface FieldProps extends ComponentPropsWithRef<'input'> {
  label: string;
  error?: string;
}

export function Field({ label, error, ...inputProps }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="tb-field">
      <label className="tb-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="tb-input"
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="tb-error">
      {children}
    </p>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="tb-alert">
      {message}
    </div>
  );
}
