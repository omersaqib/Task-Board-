import { useAuth } from '../lib/auth';
import { Link } from '../lib/router';

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="tb-header">
      <Link to="/" className="tb-brand">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <rect x="2" y="3" width="18" height="3" rx="1" fill="var(--accent)" />
          <rect x="2" y="9.5" width="13" height="3" rx="1" fill="var(--ink)" />
          <rect x="2" y="16" width="8" height="3" rx="1" fill="var(--ink-muted)" />
        </svg>
        TaskBoard
      </Link>
      <nav className="tb-nav" aria-label="Main">
        {user ? (
          <>
            <span className="tb-user">
              <span className="tb-avatar" aria-hidden="true">
                {Array.from(user.name.trim())[0]?.toUpperCase()}
              </span>
              <span data-testid="current-user">{user.name}</span>
            </span>
            <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="tb-link">
              Log in
            </Link>
            <Link to="/register" className="tb-btn tb-btn--secondary tb-btn--sm">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
