import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers.js';

describe('auth API', () => {
  const { app } = createTestApp();

  it('reports health', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('registers a user and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: '  Ada@Example.com ', password: 'Passw0rd!' })
      .expect(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Ada', email: 'ada@example.com' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ADA@example.com', password: 'Passw0rd!' })
      .expect(409);
  });

  it('validates registration input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('logs in with valid credentials and rejects bad ones', async () => {
    const user = await registerUser(app);
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email.toUpperCase(), password: user.password })
      .expect(200);
    expect(ok.body.user.id).toBe(user.id);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password1' })
      .expect(401);
    expect(bad.body.error.message).toBe('Invalid email or password');

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' })
      .expect(401);
  });

  it('returns the current user for a valid token only', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(res.body.user.email).toBe(user.email);

    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
