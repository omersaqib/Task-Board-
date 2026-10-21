import bcrypt from 'bcryptjs';
import { Router } from 'express';
import type { AppConfig } from '../config.js';
import { currentUser, requireAuth, signToken } from '../lib/auth.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { rateLimit } from '../lib/rateLimit.js';
import type { UserRepository } from '../repositories/users.js';
import { loginSchema, registerSchema } from '../schemas.js';

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

const EMAIL_TAKEN = 'An account with this email already exists';

function isUniqueViolation(error: unknown): boolean {
  const e = error as { errcode?: number; message?: string } | null;
  return e?.errcode === 2067 || /UNIQUE constraint failed/.test(e?.message ?? '');
}

export function authRouter(users: UserRepository, config: AppConfig): Router {
  const router = Router();
  const issueToken = (user: { id: number; email: string }) =>
    signToken(user, config.jwtSecret, config.tokenTtlSeconds);

  const limiter = rateLimit(config.authRateLimitPerMinute);

  router.post('/register', limiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    if (users.findByEmail(input.email)) {
      throw conflict(EMAIL_TAKEN);
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    let user;
    try {
      user = users.create({ email: input.email, name: input.name, passwordHash });
    } catch (error) {
      // Another request registered the same email between the pre-check and the insert.
      if (isUniqueViolation(error)) throw conflict(EMAIL_TAKEN);
      throw error;
    }
    res.status(201).json({ token: issueToken(user), user });
  });

  router.post('/login', limiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const found = users.findByEmail(input.email);
    const valid = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH);
    if (!found || !valid) {
      throw unauthorized('Invalid email or password');
    }
    const { passwordHash: _omit, ...user } = found;
    res.json({ token: issueToken(user), user });
  });

  router.get('/me', requireAuth(config.jwtSecret, users), (req, res) => {
    const user = users.findById(currentUser(req).id);
    if (!user) throw unauthorized();
    res.json({ user });
  });

  return router;
}
