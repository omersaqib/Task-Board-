import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('uses development defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3001);
    expect(config.isProduction).toBe(false);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('requires a JWT secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('rejects short secrets', () => {
    expect(() => loadConfig({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('parses CORS origins', () => {
    const config = loadConfig({ CORS_ORIGIN: 'http://a.test, http://b.test ,' });
    expect(config.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
  });
});
