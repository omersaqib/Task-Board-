# Taskboard backend

Express 5 + TypeScript (ESM) API with SQLite (`node:sqlite`), JWT auth, zod validation.
HTTP API: see `../docs/API.md` (frozen contract: `../docs/CONTRACTS.md`). Requires Node 22.5+ (24 recommended).

## Scripts (run from the repo root with `-w backend`)

| Script                         | Purpose                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `npm run dev -w backend`       | Watch mode via tsx                                                          |
| `npm run build -w backend`     | Compile to `backend/dist`                                                   |
| `npm run start -w backend`     | Run `dist/server.js` (build first), port 3001                               |
| `npm run typecheck -w backend` | `tsc --noEmit`                                                              |
| `npm test -w backend`          | Vitest + Supertest (in-memory databases; file-DB tests use the OS temp dir) |

## Local run

```
npm run build -w backend && npm run start -w backend
curl http://localhost:3001/api/health
```

Without `JWT_SECRET` a public development secret is used (a warning is logged). Set `JWT_SECRET`
(32+ chars) for anything real; in `NODE_ENV=production` it is mandatory. Environment variables are
listed in `../docs/API.md`. SIGINT/SIGTERM stop the server gracefully (forced exit after 10 s).

## Data

The database lives at `DATABASE_PATH`, default `backend/data/taskboard.db` (resolved relative to the
package, not the working directory; WAL mode, so `-wal`/`-shm` files appear next to it). Delete the
files to reset. Tokens issued before a reset are rejected (user/email binding).

## Migrations

`src/db.ts` holds an ordered `MIGRATIONS` array. Applied on startup, each in a transaction, tracked
by `PRAGMA user_version`. Append new entries; never edit or reorder existing ones. Reopening an
up-to-date database is a no-op.
