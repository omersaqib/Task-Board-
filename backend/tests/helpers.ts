import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

export function createTestApp() {
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_PATH: ':memory:' });
  const db = openDatabase(config.databasePath);
  return { app: createApp(db, config), db, config };
}

let counter = 0;

export async function registerUser(app: ReturnType<typeof createTestApp>['app']) {
  counter += 1;
  const credentials = {
    name: `User ${counter}`,
    email: `user${counter}@example.com`,
    password: 'Passw0rd!',
  };
  const res = await request(app).post('/api/auth/register').send(credentials).expect(201);
  return { ...credentials, token: res.body.token as string, id: res.body.user.id as number };
}
