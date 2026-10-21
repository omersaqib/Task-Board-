import { expect, test } from '../../fixtures/index.ts';
import type { AuthResult, ErrorEnvelope } from '../../utils/api-client.ts';
import { uniqueEmail, VALID_PASSWORD } from '../../utils/data.ts';

test.describe('POST /api/auth/register', () => {
  test('201 returns token and user without password hash', async ({ api }) => {
    const email = uniqueEmail();
    const res = await api.register({ name: 'Ada', email, password: VALID_PASSWORD });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as AuthResult;
    expect(body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(body.user).toMatchObject({ name: 'Ada', email });
    expect(body.user.id).toEqual(expect.any(Number));
    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('$2');
  });

  test('400 with VALIDATION_ERROR envelope listing each bad field', async ({ api }) => {
    const res = await api.register({ name: '', email: 'nope', password: 'short' });
    expect(res.status()).toBe(400);
    const { error } = (await res.json()) as ErrorEnvelope;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toEqual(expect.any(String));
    expect([...new Set(error.details?.map((d) => d.field))].sort()).toEqual([
      'email',
      'name',
      'password',
    ]);
  });

  test('409 CONFLICT for an existing email', async ({ api, testUser }) => {
    const res = await api.register({
      name: 'Other',
      email: testUser.email,
      password: VALID_PASSWORD,
    });
    expect(res.status()).toBe(409);
    expect(((await res.json()) as ErrorEnvelope).error.code).toBe('CONFLICT');
  });
});

test.describe('POST /api/auth/login', () => {
  test('200 returns a token that works on /me', async ({ api, testUser }) => {
    const res = await api.login({ email: testUser.email, password: testUser.password });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as AuthResult;
    expect(body.user.email).toBe(testUser.email);
    expect(JSON.stringify(body).toLowerCase()).not.toContain('password');

    const me = await api.me(body.token);
    expect(me.status()).toBe(200);
    expect((await me.json()).user).toMatchObject({ id: testUser.user.id, email: testUser.email });
  });

  test('401 for wrong password and for unknown email, with the same message', async ({
    api,
    testUser,
  }) => {
    const wrong = await api.login({ email: testUser.email, password: 'Wrong-password9' });
    const unknown = await api.login({ email: uniqueEmail('ghost'), password: VALID_PASSWORD });
    expect(wrong.status()).toBe(401);
    expect(unknown.status()).toBe(401);
    const a = (await wrong.json()) as ErrorEnvelope;
    const b = (await unknown.json()) as ErrorEnvelope;
    expect(a.error.code).toBe('UNAUTHORIZED');
    expect(a.error.message).toBe('Invalid email or password');
    expect(b.error.message).toBe(a.error.message);
  });

  test('400 when fields are missing', async ({ api }) => {
    const res = await api.request.post('/api/auth/login', { data: {} });
    expect(res.status()).toBe(400);
    expect(((await res.json()) as ErrorEnvelope).error.code).toBe('VALIDATION_ERROR');
  });
});

test.describe('GET /api/auth/me', () => {
  test('401 without a token, with a garbage token', async ({ api }) => {
    const none = await api.me();
    expect(none.status()).toBe(401);
    expect(((await none.json()) as ErrorEnvelope).error.code).toBe('UNAUTHORIZED');
    expect((await api.me('garbage')).status()).toBe(401);
  });
});
