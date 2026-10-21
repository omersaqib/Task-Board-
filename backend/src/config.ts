import { fileURLToPath } from 'node:url';

export interface AppConfig {
  port: number;
  databasePath: string;
  jwtSecret: string;
  /** True when JWT_SECRET was not provided and the public development secret is in use. */
  usingDevJwtSecret: boolean;
  tokenTtlSeconds: number;
  corsOrigins: string[];
  /** Max login/register attempts per client IP per minute; 0 disables rate limiting. */
  authRateLimitPerMinute: number;
  isProduction: boolean;
}

const DEV_JWT_SECRET = 'dev-only-secret-do-not-use-in-production-0000';

/**
 * Default database location, anchored to the backend package directory (this file lives in
 * `src/` or `dist/`, both one level below it) so the server uses the same file regardless of
 * the working directory it is started from.
 */
export const DEFAULT_DATABASE_PATH = fileURLToPath(
  new URL('../data/taskboard.db', import.meta.url),
);

function parseInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const value = raw === undefined || raw.trim() === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}"`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  const usingDevJwtSecret = env.JWT_SECRET === undefined && !isProduction;
  const jwtSecret = env.JWT_SECRET ?? (isProduction ? '' : DEV_JWT_SECRET);

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return {
    port: parseInteger('PORT', env.PORT, 3001, { min: 1, max: 65535 }),
    databasePath: env.DATABASE_PATH?.trim() || DEFAULT_DATABASE_PATH,
    jwtSecret,
    usingDevJwtSecret,
    tokenTtlSeconds: parseInteger('TOKEN_TTL_SECONDS', env.TOKEN_TTL_SECONDS, 3600, {
      min: 1,
      max: 60 * 60 * 24 * 365,
    }),
    corsOrigins: (env.CORS_ORIGIN ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    authRateLimitPerMinute: parseInteger(
      'AUTH_RATE_LIMIT_PER_MINUTE',
      env.AUTH_RATE_LIMIT_PER_MINUTE,
      0,
      { min: 0, max: 1_000_000 },
    ),
    isProduction,
  };
}
