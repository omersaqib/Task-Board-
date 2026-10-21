import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers.js';

describe('tasks API', () => {
  const { app } = createTestApp();
  let auth: { Authorization: string };

  beforeEach(async () => {
    const user = await registerUser(app);
    auth = { Authorization: `Bearer ${user.token}` };
  });

  const createTask = (body: object) =>
    request(app).post('/api/tasks').set(auth).send(body).expect(201);

  it('requires authentication', async () => {
    await request(app).get('/api/tasks').expect(401);
    await request(app).post('/api/tasks').send({ title: 'x' }).expect(401);
  });

  it('creates a task with defaults', async () => {
    const res = await createTask({ title: '  Write tests  ' });
    expect(res.body.task).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
    });
  });

  it('validates task input', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(auth)
      .send({ title: '   ', status: 'archived', dueDate: '31/12/2030' })
      .expect(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'status', 'dueDate']));
  });

  it('lists, filters and searches tasks', async () => {
    await createTask({ title: 'Buy milk', status: 'done' });
    await createTask({ title: 'Write report', description: 'quarterly numbers' });
    await createTask({ title: '100% done_ish' });

    const all = await request(app).get('/api/tasks').set(auth).expect(200);
    expect(all.body.tasks).toHaveLength(3);

    const done = await request(app).get('/api/tasks?status=done').set(auth).expect(200);
    expect(done.body.tasks.map((t: { title: string }) => t.title)).toEqual(['Buy milk']);

    const search = await request(app).get('/api/tasks?search=QUARTERLY').set(auth).expect(200);
    expect(search.body.tasks.map((t: { title: string }) => t.title)).toEqual(['Write report']);

    // LIKE wildcards in the search term are treated literally
    const literal = await request(app).get('/api/tasks?search=%25').set(auth).expect(200);
    expect(literal.body.tasks.map((t: { title: string }) => t.title)).toEqual(['100% done_ish']);
  });

  it('partially updates a task without touching other fields', async () => {
    const created = await createTask({ title: 'Plan', description: 'keep me', priority: 'high' });
    const res = await request(app)
      .patch(`/api/tasks/${created.body.task.id}`)
      .set(auth)
      .send({ status: 'in_progress' })
      .expect(200);
    expect(res.body.task).toMatchObject({
      title: 'Plan',
      description: 'keep me',
      priority: 'high',
      status: 'in_progress',
    });
  });

  it('rejects empty and unknown update fields', async () => {
    const created = await createTask({ title: 'Plan' });
    await request(app).patch(`/api/tasks/${created.body.task.id}`).set(auth).send({}).expect(400);
    await request(app)
      .patch(`/api/tasks/${created.body.task.id}`)
      .set(auth)
      .send({ userId: 999 })
      .expect(400);
  });

  it('deletes a task', async () => {
    const created = await createTask({ title: 'Temp' });
    const url = `/api/tasks/${created.body.task.id}`;
    await request(app).delete(url).set(auth).expect(204);
    await request(app).get(url).set(auth).expect(404);
    await request(app).delete(url).set(auth).expect(404);
  });

  it("does not expose another user's tasks", async () => {
    const created = await createTask({ title: 'Private' });
    const other = await registerUser(app);
    const otherAuth = { Authorization: `Bearer ${other.token}` };
    const url = `/api/tasks/${created.body.task.id}`;

    await request(app).get(url).set(otherAuth).expect(404);
    await request(app).patch(url).set(otherAuth).send({ title: 'Hacked' }).expect(404);
    await request(app).delete(url).set(otherAuth).expect(404);
    const list = await request(app).get('/api/tasks').set(otherAuth).expect(200);
    expect(list.body.tasks).toEqual([]);

    const mine = await request(app).get(url).set(auth).expect(200);
    expect(mine.body.task.title).toBe('Private');
  });

  it('rejects invalid ids', async () => {
    await request(app).get('/api/tasks/abc').set(auth).expect(400);
    await request(app).get('/api/tasks/-1').set(auth).expect(400);
  });
});
