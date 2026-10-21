# Taskboard API

Base URL: `http://localhost:3001`. All request and response bodies are JSON. The authoritative
contract is `docs/CONTRACTS.md`; this document adds examples and details.

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [{ "field": "title", "message": "Title is required" }]
  }
}
```

`details` is present only for `VALIDATION_ERROR`; `message` is the first issue's message.

| HTTP | code               | When                                                             |
| ---- | ------------------ | ---------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR` | Body/query/id failed validation                                  |
| 400  | `INVALID_JSON`     | Malformed JSON body                                              |
| 400  | `BAD_REQUEST`      | Other body-parser errors (e.g. unsupported charset)              |
| 401  | `UNAUTHORIZED`     | Missing/invalid/expired token, user deleted, bad credentials     |
| 404  | `NOT_FOUND`        | Unknown task (or another user's task) or unknown `/api/*` path   |
| 409  | `CONFLICT`         | Email already registered (case-insensitive, also under races)    |
| 413  | `BAD_REQUEST`      | Body larger than 100 KB                                          |
| 429  | `RATE_LIMITED`     | Only when `AUTH_RATE_LIMIT_PER_MINUTE` is set; has `Retry-After` |
| 500  | `INTERNAL_ERROR`   | Unexpected error (message hidden when `NODE_ENV=production`)     |

## Auth flow

1. `POST /api/auth/register` or `/login` returns `{ token, user }`.
2. Send `Authorization: Bearer <token>` (scheme is case-insensitive) on protected routes.
3. Tokens are HS256 JWTs (`sub` = user id, `email` claim) valid for `TOKEN_TTL_SECONDS`
   (default 3600). A token is rejected with 401 if it is expired, signed with another
   secret/algorithm, its user no longer exists, or its email does not match the user.

## Endpoints

### GET /api/health

`200 {"status":"ok","database":"ok","uptimeSeconds":12}`; `503 {"status":"error","database":"unavailable"}`.

### POST /api/auth/register

```json
{ "name": "Ada", "email": "Ada@Example.com", "password": "Passw0rd!" }
```

`201`:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "ada@example.com",
    "name": "Ada",
    "createdAt": "2026-01-01T10:00:00.000Z"
  }
}
```

Errors: 400, 409 `An account with this email already exists`.

### POST /api/auth/login

`{ "email": "ada@example.com", "password": "Passw0rd!" }` -> `200 {token, user}`;
wrong email or password -> `401 Invalid email or password` (same response for both).

### GET /api/auth/me

`200 {"user": {...}}`; `401` for a missing/invalid token or a deleted user.

### GET /api/tasks?status=&search=

`200 {"tasks": [Task, ...]}`, newest first, only the caller's tasks. `status` is one of
`todo|in_progress|done` (400 otherwise, also if repeated). `search` (trimmed, max 120 chars) is a
case-insensitive substring match on title or description; `%`, `_` and `\` are literal.

### POST /api/tasks

```json
{
  "title": "Write docs",
  "description": "optional",
  "status": "todo",
  "priority": "medium",
  "dueDate": "2026-03-01"
}
```

Only `title` is required. Defaults: description `""`, status `todo`, priority `medium`, dueDate `null`.
`201 {"task": Task}`.

### GET /api/tasks/:id

`200 {"task": Task}`; 400 `Invalid id`; 404 `Task not found` (also for other users' tasks).

### PATCH /api/tasks/:id

Partial update; at least one of `title, description, status, priority, dueDate`. Unknown fields
are rejected with 400. `{"dueDate": null}` clears the due date. `200 {"task": Task}`.

### DELETE /api/tasks/:id

`204` with no body; 404 if missing.

```json
Task = { "id": 1, "title": "Write docs", "description": "", "status": "todo",
         "priority": "medium", "dueDate": null,
         "createdAt": "2026-01-01T10:00:00.000Z", "updatedAt": "2026-01-01T10:00:00.000Z" }
```

## Validation rules

| Field       | Rule                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| name        | trimmed, 1-80 chars                                                                                 |
| email       | trimmed, lower-cased, valid address, at most 254 chars                                              |
| password    | 8-128 chars, at least one letter and one digit (login: non-empty)                                   |
| title       | trimmed, 1-120 chars                                                                                |
| description | trimmed, at most 2000 chars                                                                         |
| status      | `todo`, `in_progress`, `done`                                                                       |
| priority    | `low`, `medium`, `high`                                                                             |
| dueDate     | real calendar date `YYYY-MM-DD`, or `null`                                                          |
| `:id`       | canonical positive integer (`/^[1-9][0-9]{0,14}$/`); `0x10`, `1e3`, `+1`, `1.0` -> 400 `Invalid id` |

## Environment variables

| Variable                     | Default                          | Notes                                                                |
| ---------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| `PORT`                       | `3001`                           | 1-65535                                                              |
| `DATABASE_PATH`              | `backend/data/taskboard.db`      | `:memory:` allowed                                                   |
| `JWT_SECRET`                 | dev secret (non-production only) | Required, >= 32 chars, when `NODE_ENV=production`                    |
| `TOKEN_TTL_SECONDS`          | `3600`                           | 1 to 31536000                                                        |
| `CORS_ORIGIN`                | unset (CORS off)                 | Comma-separated allowed origins                                      |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `0` (off)                        | Per client socket IP, applied to register and login; excess -> 429   |
| `NODE_ENV`                   | -                                | `production` hides internal error messages and requires `JWT_SECRET` |
