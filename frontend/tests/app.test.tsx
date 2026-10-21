import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { setAuthToken } from '../src/lib/api';
import { AuthProvider } from '../src/lib/auth';
import { RouterProvider } from '../src/lib/router';

const json = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const user = { id: 1, email: 'ada@example.com', name: 'Ada', createdAt: '2030-01-01T00:00:00Z' };

function renderAt(path: string) {
  window.history.replaceState(null, '', path);
  return render(
    <RouterProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RouterProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setAuthToken(null);
});
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('redirects guests from /tasks to /login and sets the page title', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderAt('/tasks');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(document.title).toBe('Log in · TaskBoard');
  });

  it('shows the server error in an alert on failed login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        json(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }),
      ),
    );
    renderAt('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(localStorage.getItem('taskboard.token')).toBeNull();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  it('reports a network failure on login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    renderAt('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'whatever1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server');
  });

  it('navigates between pages with Link without a reload and moves focus to the heading', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderAt('/login');
    await userEvent.click(screen.getByRole('link', { name: 'Create one' }));
    const heading = await screen.findByRole('heading', { name: 'Create account' });
    expect(window.location.pathname).toBe('/register');
    expect(heading).toHaveFocus();
    expect(document.title).toBe('Create account · TaskBoard');
  });

  it('renders the not-found page for unknown routes', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  it('logs out and redirects to /login when the API returns 401 mid-session', async () => {
    localStorage.setItem('taskboard.token', 'tok');
    let tasksCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/me')) return json(200, { user });
        tasksCalls += 1;
        return tasksCalls === 1
          ? json(200, { tasks: [] })
          : json(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } });
      }),
    );
    renderAt('/tasks');
    expect(await screen.findByRole('heading', { name: 'Ada’s tasks' })).toBeVisible();
    expect(await screen.findByTestId('empty-state')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'x{Enter}');

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(localStorage.getItem('taskboard.token')).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });

  it('ignores a slow response for a superseded filter', async () => {
    localStorage.setItem('taskboard.token', 'tok');
    const task = (id: number, title: string) => ({
      id,
      title,
      description: '',
      status: 'todo',
      priority: 'low',
      dueDate: null,
      createdAt: '',
      updatedAt: '',
    });
    let releaseSlow!: () => void;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/me')) return json(200, { user });
        if (url.includes('status=done')) return json(200, { tasks: [task(2, 'Fast done')] });
        if (url.includes('status=todo')) {
          return new Promise<Response>((r) => {
            releaseSlow = () => r(new Response(JSON.stringify({ tasks: [task(1, 'Slow todo')] })));
          });
        }
        return json(200, { tasks: [] });
      }),
    );
    renderAt('/tasks');
    await screen.findByTestId('empty-state');
    await userEvent.click(screen.getByRole('button', { name: 'To do' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Fast done')).toBeVisible();
    releaseSlow();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Slow todo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
  });
});
