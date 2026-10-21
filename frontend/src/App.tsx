import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Header } from './components/Header';
import { useAuth } from './lib/auth';
import { Redirect, useRouter } from './lib/router';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { TasksPage } from './pages/TasksPage';

export function App() {
  const { path } = useRouter();
  const { user, status } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(path);

  // After a client-side navigation, move focus to the new page's heading so keyboard and
  // screen-reader users start at the top of the new content (and focus is not left on a
  // control that no longer exists, e.g. "Log out"). A layout effect runs before the browser
  // can deliver further input, so it never steals focus from a field the user started typing in.
  useLayoutEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    const main = mainRef.current;
    if (!main || main.contains(document.activeElement)) return;
    const heading = main.querySelector<HTMLElement>('h1');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  });

  if (status === 'loading') {
    return (
      <div className="tb">
        <p className="loading" role="status">
          Loading…
        </p>
      </div>
    );
  }

  const guestOnly = (page: ReactNode) => (user ? <Redirect to="/tasks" /> : page);
  const authOnly = (page: ReactNode) => (user ? page : <Redirect to="/login" />);

  let page: ReactNode;
  switch (path) {
    case '/':
      page = <Redirect to={user ? '/tasks' : '/login'} />;
      break;
    case '/login':
      page = guestOnly(<LoginPage />);
      break;
    case '/register':
      page = guestOnly(<RegisterPage />);
      break;
    case '/tasks':
      page = authOnly(<TasksPage />);
      break;
    default:
      page = <NotFoundPage />;
  }

  return (
    <div className="tb">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Header />
      <main id="main" className="app-main" ref={mainRef} tabIndex={-1}>
        {page}
      </main>
    </div>
  );
}
