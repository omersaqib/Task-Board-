export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: FieldIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Please try again.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError(
      res.status,
      data?.error?.code ?? 'HTTP_ERROR',
      data?.error?.message ?? `Request failed with status ${res.status}`,
      data?.error?.details ?? [],
    );
  }
  return data as T;
}

type AuthResponse = { token: string; user: User };

export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<AuthResponse>('POST', '/auth/register', input),
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('POST', '/auth/login', input),
  me: () => request<{ user: User }>('GET', '/auth/me'),

  listTasks: (filters: { status?: TaskStatus; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const query = params.toString();
    return request<{ tasks: Task[] }>('GET', `/tasks${query ? `?${query}` : ''}`);
  },
  createTask: (input: TaskInput) => request<{ task: Task }>('POST', '/tasks', input),
  updateTask: (id: number, input: Partial<TaskInput & { status: TaskStatus }>) =>
    request<{ task: Task }>('PATCH', `/tasks/${id}`, input),
  deleteTask: (id: number) => request<void>('DELETE', `/tasks/${id}`),
};
