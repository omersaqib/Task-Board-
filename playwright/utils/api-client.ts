import type { APIRequestContext, APIResponse } from '@playwright/test';

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
export interface AuthResult {
  token: string;
  user: User;
}
export interface ErrorEnvelope {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

/** Thin typed wrapper over APIRequestContext. Methods return raw responses so tests can assert status. */
export class ApiClient {
  readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  private headers(token?: string) {
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }

  health() {
    return this.request.get('/api/health');
  }
  register(data: { name: string; email: string; password: string }) {
    return this.request.post('/api/auth/register', { data });
  }
  login(data: { email: string; password: string }) {
    return this.request.post('/api/auth/login', { data });
  }
  me(token?: string) {
    return this.request.get('/api/auth/me', { headers: this.headers(token) });
  }
  listTasks(token?: string, query: Record<string, string> = {}) {
    return this.request.get('/api/tasks', { headers: this.headers(token), params: query });
  }
  createTask(token: string | undefined, data: Record<string, unknown>) {
    return this.request.post('/api/tasks', { headers: this.headers(token), data });
  }
  getTask(token: string | undefined, id: number | string) {
    return this.request.get(`/api/tasks/${id}`, { headers: this.headers(token) });
  }
  updateTask(token: string | undefined, id: number | string, data: Record<string, unknown>) {
    return this.request.patch(`/api/tasks/${id}`, { headers: this.headers(token), data });
  }
  deleteTask(token: string | undefined, id: number | string) {
    return this.request.delete(`/api/tasks/${id}`, { headers: this.headers(token) });
  }

  /** Create a task and return it, failing loudly if the API rejects it. */
  async seedTask(token: string, data: Record<string, unknown>): Promise<Task> {
    const res = await this.createTask(token, data);
    if (res.status() !== 201)
      throw new Error(`seedTask failed: ${res.status()} ${await res.text()}`);
    return ((await res.json()) as { task: Task }).task;
  }
}

export async function json<T>(res: APIResponse): Promise<T> {
  return (await res.json()) as T;
}
