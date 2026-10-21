import type { Database } from '../db.js';

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.created_at,
});

export function createUserRepository(db: Database) {
  return {
    create(input: { email: string; name: string; passwordHash: string }): User {
      const row = db
        .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING *')
        .get(input.email, input.name, input.passwordHash) as unknown as UserRow;
      return toUser(row);
    },

    findByEmail(email: string): (User & { passwordHash: string }) | undefined {
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
        UserRow | undefined;
      return row && { ...toUser(row), passwordHash: row.password_hash };
    },

    findById(id: number): User | undefined {
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
      return row && toUser(row);
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
