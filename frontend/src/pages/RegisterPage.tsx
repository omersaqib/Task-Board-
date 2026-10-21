import { useState, type FormEvent } from 'react';
import { AuthAside } from '../components/AuthAside';
import { Field, FormAlert } from '../components/Field';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Link } from '../lib/router';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { hasErrors, validateRegister, type FieldErrors } from '../lib/validation';

type RegisterField = 'name' | 'email' | 'password' | 'confirmPassword';

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FieldErrors<RegisterField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: RegisterField) => (e: { target: { value: string } }) => {
    const { value } = e.target;
    setValues((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateRegister(values);
    setErrors(validation);
    setFormError(null);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    try {
      await register(values.name.trim(), values.email.trim(), values.password);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        setErrors(Object.fromEntries(error.details.map((d) => [d.field, d.message])));
      }
      setFormError(error instanceof Error ? error.message : 'Registration failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="tb-auth-layout">
      <AuthAside />
      <form className="tb-card" aria-label="Create account" onSubmit={handleSubmit} noValidate>
        <div>
          <h1 className="tb-title tb-title--card">Create account</h1>
          <p className="tb-muted">Your tasks, kept in one ledger.</p>
        </div>
        <FormAlert message={formError} />
        <Field
          label="Name"
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={update('name')}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={update('email')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          onChange={update('password')}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={update('confirmPassword')}
        />
        <button
          type="submit"
          className="tb-btn tb-btn--primary tb-btn--block"
          disabled={submitting}
          aria-busy={submitting}
        >
          Create account
        </button>
        <p className="tb-muted">
          Already registered?{' '}
          <Link to="/login" className="tb-link">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
