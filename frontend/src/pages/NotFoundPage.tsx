import { Link } from '../lib/router';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <section className="tb-card">
      <h1 className="tb-title tb-title--card">Page not found</h1>
      <p className="tb-muted">
        The page you are looking for does not exist.{' '}
        <Link to="/" className="tb-link">
          Go home
        </Link>
      </p>
    </section>
  );
}
