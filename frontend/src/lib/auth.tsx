import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api, setAuthToken, setUnauthorizedHandler, type User } from './api';

export const TOKEN_STORAGE_KEY = 'taskboard.token';

interface AuthValue {
  user: User | null;
  status: 'loading' | 'ready';
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthValue['status']>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) ? 'loading' : 'ready',
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  const startSession = useCallback((token: string, sessionUser: User) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setAuthToken(token);
    setUser(sessionUser);
  }, []);

  // Restore an existing session on first load.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;
    // StrictMode runs this effect twice in development; ignore the superseded response.
    let active = true;
    setAuthToken(token);
    api
      .me()
      .then(({ user: sessionUser }) => {
        if (active) setUser(sessionUser);
      })
      .catch((error: unknown) => {
        if (!active) return;
        // Only an explicit 401 means the token is bad. A network/server error must not
        // destroy a valid session: keep the token so a reload can restore it.
        if (error instanceof ApiError && error.status === 401) logout();
        else {
          setAuthToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setStatus('ready');
      });
    return () => {
      active = false;
    };
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      logout,
      login: async (email, password) => {
        const res = await api.login({ email, password });
        startSession(res.token, res.user);
      },
      register: async (name, email, password) => {
        const res = await api.register({ name, email, password });
        startSession(res.token, res.user);
      },
    }),
    [user, status, logout, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
