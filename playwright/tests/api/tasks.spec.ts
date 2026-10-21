import { expect, test } from '../../fixtures/index.ts';
import type { ErrorEnvelope, Task } from '../../utils/api-client.ts';
import { isoDate, uniqueTitle } from '../../utils/data.ts';

test.describe('tasks CRUD', () => {
  test('create returns 201 with defaults applied', async ({ api, testUser }) => {
    const title = uniqueTitle();
    const res = await api.createTask(testUser.token, { title });
    expect(res.status()).toBe(201);
    const { task } = (await res.json()) as { task: Task };
    expect(task).toMatchObject({
      title,
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
    });
    expect(task.id).toEqual(expect.any(Number));
    expect(task.createdAt).toEqual(expect.any(String));
  });

  test('create stores all supplied fields; get returns the same task', async ({
    api,
    testUser,
  }) => {
    const due = isoDate(3);
    const created = await api.seedTask(testUser.token, {
      title: uniqueTitle(),
      description: 'desc',
      priority: 'high',
      status: 'in_progress',
      dueDate: due,
    });
    expect(created).toMatchObject({
      description: 'desc',
      priority: 'high',
      status: 'in_progress',
      dueDate: due,
    });

    const res = await api.getTask(testUser.token, created.id);
    expect(res.status()).toBe(200);
    expect(((await res.json()) as { task: Task }).task).toEqual(created);
  });

  test('list returns only own tasks, newest first', async ({ api, testUser }) => {
    const first = await api.seedTask(testUser.token, { title: uniqueTitle('A') });
    const second = await api.seedTask(testUser.token, { title: uniqueTitle('B') });
    const res = await api.listTasks(testUser.token);
    expect(res.status()).toBe(200);
    const { tasks } = (await res.json()) as { tasks: Task[] };
    expect(tasks.map((t) => t.id)).toEqual([second.id, first.id]);
  });

  test('list filters by status and rejects an invalid status', async ({ api, testUser }) => {
    await api.seedTask(testUser.token, { title: uniqueTitle(), status: 'done' });
    const todo = await api.seedTask(testUser.token, { title: uniqueTitle() });
    const res = await api.listTasks(testUser.token, { status: 'todo' });
    const { tasks } = (await res.json()) as { tasks: Task[] };
    expect(tasks.map((t) => t.id)).toEqual([todo.id]);

    const bad = await api.listTasks(testUser.token, { status: 'bogus' });
    expect(bad.status()).toBe(400);
    expect(((await bad.json()) as ErrorEnvelope).error.code).toBe('VALIDATION_ERROR');
  });

  test('patch updates fields and bumps nothing else', async ({ api, testUser }) => {
    const task = await api.seedTask(testUser.token, { title: uniqueTitle(), priority: 'low' });
    const res = await api.updateTask(testUser.token, task.id, { status: 'done', title: 'Renamed' });
    expect(res.status()).toBe(200);
    const { task: updated } = (await res.json()) as { task: Task };
    expect(updated).toMatchObject({
      id: task.id,
      status: 'done',
      title: 'Renamed',
      priority: 'low',
    });
  });

  test('patch can clear dueDate with null', async ({ api, testUser }) => {
    const task = await api.seedTask(testUser.token, { title: uniqueTitle(), dueDate: isoDate(2) });
    const res = await api.updateTask(testUser.token, task.id, { dueDate: null });
    expect(res.status()).toBe(200);
    expect(((await res.json()) as { task: Task }).task.dueDate).toBeNull();
  });

  test('delete returns 204 and the task is gone', async ({ api, testUser }) => {
    const task = await api.seedTask(testUser.token, { title: uniqueTitle() });
    const del = await api.deleteTask(testUser.token, task.id);
    expect(del.status()).toBe(204);
    expect((await api.getTask(testUser.token, task.id)).status()).toBe(404);
    expect((await api.deleteTask(testUser.token, task.id)).status()).toBe(404);
  });
});

test.describe('validation errors use the standard envelope', () => {
  test('create with bad title, priority and dueDate lists every field', async ({
    api,
    testUser,
  }) => {
    const res = await api.createTask(testUser.token, {
      title: '',
      priority: 'urgent',
      dueDate: '31/12/2030',
    });
    expect(res.status()).toBe(400);
    const { error } = (await res.json()) as ErrorEnvelope;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((d) => d.field).sort()).toEqual(['dueDate', 'priority', 'title']);
    for (const d of error.details ?? []) expect(d.message).toEqual(expect.any(String));
  });

  test('title over 120 characters is rejected', async ({ api, testUser }) => {
    const res = await api.createTask(testUser.token, { title: 'x'.repeat(121) });
    expect(res.status()).toBe(400);
  });

  test('patch with empty body or unknown field is 400', async ({ api, testUser }) => {
    const task = await api.seedTask(testUser.token, { title: uniqueTitle() });
    expect((await api.updateTask(testUser.token, task.id, {})).status()).toBe(400);
    expect((await api.updateTask(testUser.token, task.id, { owner: 1 })).status()).toBe(400);
  });

  test('non-numeric task id is 400', async ({ api, testUser }) => {
    const res = await api.getTask(testUser.token, 'abc');
    expect(res.status()).toBe(400);
    expect(((await res.json()) as ErrorEnvelope).error.code).toBe('VALIDATION_ERROR');
  });
});

test.describe('authorization', () => {
  test('401 on every task endpoint without a token', async ({ api }) => {
    const responses = await Promise.all([
      api.listTasks(),
      api.createTask(undefined, { title: 'x' }),
      api.getTask(undefined, 1),
      api.updateTask(undefined, 1, { title: 'x' }),
      api.deleteTask(undefined, 1),
    ]);
    for (const res of responses) {
      expect(res.status()).toBe(401);
      expect(((await res.json()) as ErrorEnvelope).error.code).toBe('UNAUTHORIZED');
    }
  });

  test('401 with a tampered token', async ({ api, testUser }) => {
    const res = await api.listTasks(`${testUser.token}tampered`);
    expect(res.status()).toBe(401);
  });
});

test.describe('protocol edge cases', () => {
  test('malformed JSON body is 400 INVALID_JSON', async ({ api }) => {
    const res = await api.request.post('/api/auth/login', {
      headers: { 'content-type': 'application/json' },
      data: '{"email": ',
    });
    expect(res.status()).toBe(400);
    expect(((await res.json()) as ErrorEnvelope).error.code).toBe('INVALID_JSON');
  });

  test('unknown API route is 404 NOT_FOUND envelope', async ({ api }) => {
    const res = await api.request.get('/api/does-not-exist');
    expect(res.status()).toBe(404);
    expect(((await res.json()) as ErrorEnvelope).error.code).toBe('NOT_FOUND');
  });

  test('health reports database status and uptime', async ({ api }) => {
    const body = await (await api.health()).json();
    expect(body).toMatchObject({ status: 'ok', uptimeSeconds: expect.any(Number) });
    expect(body.database).toBeTruthy();
  });
});
