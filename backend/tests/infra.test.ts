import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

describe('migrations', () => {
  const dir = mkdtempSync(join(tmpdir(), 'taskboard-db-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('are idempotent when reopening a file database and keep data', () => {
    const path = join(dir, 'nested', 'test.db');
    const first = openDatabase(path);
    first
      .prepare("INSERT INTO users (email, name, password_hash) VALUES ('a@b.co', 'A', 'h')")
      .run();
    const version = first.prepare('PRAGMA user_version').get() as { user_version: number };
    first.close();

    const second = openDatabase(path);
    expect(second.prepare('PRAGMA user_version').get()).toEqual(version);
    expect(version.user_version).toBeGreaterThan(0);
    expect(second.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
    second.close();
  });
});

describe('auth rate limiting', () => {
  const login = { email: 'nobody@example.com', password: 'whatever1' };

  it('is off by default', async () => {
    const config = loadConfig({ DATABASE_PATH: ':memory:' });
    expect(config.authRateLimitPerMinute).toBe(0);
    const app = createApp(openDatabase(':memory:'), config);
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send(login).expect(401);
  });

  it('returns 429 with the error envelope once the limit is exceeded', async () => {
    const config = loadConfig({ AUTH_RATE_LIMIT_PER_MINUTE: '2' });
    const app = createApp(openDatabase(':memory:'), config);
    await request(app).post('/api/auth/login').send(login).expect(401);
    await request(app).post('/api/auth/login').send(login).expect(401);
    const res = await request(app).post('/api/auth/login').send(login).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
    // Non-auth endpoints are unaffected.
    await request(app).get('/api/health').expect(200);
  });

  it('rejects an invalid limit', () => {
    expect(() => loadConfig({ AUTH_RATE_LIMIT_PER_MINUTE: 'abc' })).toThrow(/AUTH_RATE_LIMIT/);
  });
});
