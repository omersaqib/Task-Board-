import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRepository } from '../repositories/users.js';
import { unauthorized } from './errors.js';

export interface AuthUser {
  id: number;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser, secret: string, ttlSeconds: number): string {
  return jwt.sign({ email: user.email }, secret, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: ttlSeconds,
  });
}

const CANONICAL_ID = /^[1-9]\d{0,14}$/;

/**
 * Verifies the bearer token (HS256 only), then checks the user still exists and that the
 * token's email claim matches that user, so tokens survive neither account deletion nor a
 * database reset that re-used the same ids.
 */
export function requireAuth(secret: string, users: Pick<UserRepository, 'findById'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const match = /^Bearer +([^ ]+)$/i.exec(req.headers.authorization ?? '');
    if (!match) {
      throw unauthorized();
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(match[1]!, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    } catch {
      throw unauthorized('Invalid or expired token');
    }

    if (typeof payload.sub !== 'string' || !CANONICAL_ID.test(payload.sub)) {
      throw unauthorized('Invalid or expired token');
    }
    const user = users.findById(Number(payload.sub));
    if (!user || typeof payload.email !== 'string' || user.email !== payload.email) {
      throw unauthorized('Invalid or expired token');
    }
    req.user = { id: user.id, email: user.email };
    next();
  };
}

/** Returns the authenticated user; only valid on routes behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
