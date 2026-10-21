import { useState, type FormEvent } from 'react';
import { AuthAside } from '../components/AuthAside';
import { Field, FormAlert } from '../components/Field';
import { useAuth } from '../lib/auth';
import { Link } from '../lib/router';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { hasErrors, validateLogin, type FieldErrors } from '../lib/validation';

export function LoginPage() {
  useDocumentTitle('Log in');
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateLogin({ email, password });
    setErrors(validation);
    setFormError(null);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Login failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="tb-auth-layout">
      <AuthAside />
      <form className="tb-card" aria-label="Log in" onSubmit={handleSubmit} noValidate>
        <div>
          <h1 className="tb-title tb-title--card">Log in</h1>
          <p className="tb-muted">Pick up where you left off.</p>
        </div>
        <FormAlert message={formError} />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="tb-btn tb-btn--primary tb-btn--block"
          disabled={submitting}
          aria-busy={submitting}
        >
          Log in
        </button>
        <p className="tb-muted">
          No account?{' '}
          <Link to="/register" className="tb-link">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
