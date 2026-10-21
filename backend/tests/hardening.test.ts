import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp, registerUser } from './helpers.js';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('auth hardening', () => {
  const { app, db, config } = createTestApp();

  it('rejects an expired token with 401', async () => {
    const user = await registerUser(app);
    const expired = jwt.sign(
      { email: user.email, sub: String(user.id), exp: Math.floor(Date.now() / 1000) - 10 },
      config.jwtSecret,
    );
    const res = await request(app).get('/api/auth/me').set(bearer(expired)).expect(401);
    expect(res.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  });

  it('rejects tokens signed with another secret or with alg "none"', async () => {
    const user = await registerUser(app);
    const forged = jwt.sign({ email: user.email }, 'x'.repeat(40), { subject: String(user.id) });
    await request(app).get('/api/auth/me').set(bearer(forged)).expect(401);

    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ email: user.email, sub: String(user.id) })).toString(
      'base64url',
    );
    await request(app)
      .get('/api/auth/me')
      .set(bearer(`${header}.${body}.`))
      .expect(401);
  });

  it('accepts the Bearer scheme case-insensitively and rejects other schemes', async () => {
    const user = await registerUser(app);
    await request(app).get('/api/auth/me').set('Authorization', `bearer ${user.token}`).expect(200);
    await request(app).get('/api/auth/me').set('Authorization', `Basic ${user.token}`).expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer').expect(401);
  });

  it('returns 401 (not 404/500) for a valid token whose user no longer exists', async () => {
    const user = await registerUser(app);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    const me = await request(app).get('/api/auth/me').set(bearer(user.token)).expect(401);
    expect(me.body.error.code).toBe('UNAUTHORIZED');

    // Previously this hit the tasks.user_id foreign key and returned 500.
    const create = await request(app)
      .post('/api/tasks')
      .set(bearer(user.token))
      .send({ title: 'orphan' })
      .expect(401);
    expect(create.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token whose email does not match the user id (e.g. after a DB reset)', async () => {
    const victim = await registerUser(app);
    const stale = jwt.sign({ email: 'someone-else@example.com' }, config.jwtSecret, {
      subject: String(victim.id),
    });
    await request(app).get('/api/auth/me').set(bearer(stale)).expect(401);
  });

  it('returns 409 (not 500) when the same email registers concurrently', async () => {
    // Slow the hash down so every request passes the "email taken?" pre-check before any insert.
    const realHash = bcrypt.hash.bind(bcrypt);
    const spy = vi.spyOn(bcrypt, 'hash').mockImplementation((async (
      password: string,
      salt: number,
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return realHash(password, salt);
    }) as typeof bcrypt.hash);
    const body = { name: 'Racer', email: 'race@example.com', password: 'Passw0rd!' };
    const results = await Promise.all(
      Array.from({ length: 3 }, () => request(app).post('/api/auth/register').send(body)),
    ).finally(() => spy.mockRestore());
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409]);
    for (const r of results.filter((r) => r.status === 409)) {
      expect(r.body.error).toEqual({
        code: 'CONFLICT',
        message: 'An account with this email already exists',
      });
    }
  });

  it('rejects absurdly long emails with the standard email message', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Long', email: `${'a'.repeat(250)}@example.com`, password: 'Passw0rd!' })
      .expect(400);
    expect(res.body.error.details).toEqual([
      { field: 'email', message: 'Email must be a valid email address' },
    ]);
  });
});

describe('request handling', () => {
  const { app } = createTestApp();

  it('returns 413 with the error envelope for oversized bodies', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(user.token))
      .send({ title: 'big', description: 'x'.repeat(200 * 1024) })
      .expect(413);
    expect(res.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'request entity too large' },
    });
  });

  it('returns 400 VALIDATION_ERROR when the body is missing', async () => {
    const user = await registerUser(app);
    const res = await request(app).post('/api/tasks').set(bearer(user.token)).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('task edge cases', () => {
  const { app } = createTestApp();

  const setup = async () => {
    const user = await registerUser(app);
    const auth = bearer(user.token);
    const created = await request(app)
      .post('/api/tasks')
      .set(auth)
      .send({ title: 'Dated', dueDate: '2030-01-15', description: 'keep' })
      .expect(201);
    return { auth, task: created.body.task as { id: number; updatedAt: string } };
  };

  it('PATCH dueDate: null clears the due date and keeps other fields', async () => {
    const { auth, task } = await setup();
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth)
      .send({ dueDate: null })
      .expect(200);
    expect(res.body.task).toMatchObject({ dueDate: null, title: 'Dated', description: 'keep' });
    expect(res.body.task.updatedAt >= task.updatedAt).toBe(true);

    const reread = await request(app).get(`/api/tasks/${task.id}`).set(auth).expect(200);
    expect(reread.body.task.dueDate).toBeNull();
  });

  it('PATCH can set every field at once', async () => {
    const { auth, task } = await setup();
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth)
      .send({
        title: ' New ',
        description: '',
        status: 'done',
        priority: 'low',
        dueDate: '2031-12-31',
      })
      .expect(200);
    expect(res.body.task).toMatchObject({
      title: 'New',
      description: '',
      status: 'done',
      priority: 'low',
      dueDate: '2031-12-31',
    });
  });

  it('rejects impossible calendar dates', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .post('/api/tasks')
      .set(auth)
      .send({ title: 'x', dueDate: '2025-02-30' })
      .expect(400);
    expect(res.body.error.message).toBe('Due date must be in YYYY-MM-DD format');
  });

  it.each(['0x10', '1e3', '1.0', '+1', ' 1', '0', '99999999999999999999'])(
    'rejects non-canonical id %j with "Invalid id"',
    async (id) => {
      const { auth } = await setup();
      const res = await request(app)
        .get(`/api/tasks/${encodeURIComponent(id)}`)
        .set(auth)
        .expect(400);
      expect(res.body.error.message).toBe('Invalid id');
    },
  );

  it('treats backslashes and underscores in search literally', async () => {
    const { auth } = await setup();
    for (const title of ['a_b', 'axb', 'c\\d']) {
      await request(app).post('/api/tasks').set(auth).send({ title }).expect(201);
    }
    const underscore = await request(app).get('/api/tasks').query({ search: '_' }).set(auth);
    expect(underscore.body.tasks.map((t: { title: string }) => t.title)).toEqual(['a_b']);
    const backslash = await request(app).get('/api/tasks').query({ search: '\\' }).set(auth);
    expect(backslash.body.tasks.map((t: { title: string }) => t.title)).toEqual(['c\\d']);
  });

  it('rejects repeated status query params with 400', async () => {
    const { auth } = await setup();
    await request(app).get('/api/tasks?status=todo&status=done').set(auth).expect(400);
  });
});

describe('health', () => {
  it('returns 503 when the database is unavailable', async () => {
    const { app, db } = createTestApp();
    db.close();
    const res = await request(app).get('/api/health').expect(503);
    expect(res.body).toEqual({ status: 'error', database: 'unavailable' });
  });
});
