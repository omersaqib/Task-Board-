# Interface Contracts

These contracts are shared between the frontend, backend, Playwright and CI workstreams.
Changing any of them requires updating every consumer in the same change.

## Runtime topology

| Service            | Command (from repo root)      | Port | Readiness check                           |
| ------------------ | ----------------------------- | ---- | ----------------------------------------- |
| API (Express)      | `npm run start -w backend`    | 3001 | `GET /api/health` → `200 {"status":"ok"}` |
| Web (Vite preview) | `npm run preview -w frontend` | 4173 | `GET /` → `200` HTML                      |

The web server proxies `/api/*` to `API_PROXY_TARGET` (default `http://localhost:3001`),
so the browser only ever talks to one origin. Both commands require `npm run build` first.

Database: SQLite via `node:sqlite`, file at `DATABASE_PATH` (default `backend/data/taskboard.db`,
relative to the backend workspace). Migrations run automatically at startup.

## HTTP API

All bodies are JSON. Errors always use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [{ "field": "title", "message": "Title is required" }]
  }
}
```

`details` is present only for `VALIDATION_ERROR`. Codes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400),
`BAD_REQUEST` (other body-parser 4xx, e.g. 413 for bodies over 100 kB), `UNAUTHORIZED` (401),
`NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429, only when `AUTH_RATE_LIMIT_PER_MINUTE` is set),
`INTERNAL_ERROR` (500).

Tokens are HS256 JWTs. A token is rejected with 401 if it is expired, malformed, or its user no longer
exists (or the user's email differs from the token's `email` claim, e.g. after a database reset).
Note: bcrypt only uses the first 72 bytes of a password; passwords up to 128 characters are accepted.

| Method | Path                         | Auth | Success                                 | Notable errors                                |
| ------ | ---------------------------- | ---- | --------------------------------------- | --------------------------------------------- |
| GET    | `/api/health`                | –    | 200 `{status, database, uptimeSeconds}` | 503 if DB unavailable                         |
| POST   | `/api/auth/register`         | –    | 201 `{token, user}`                     | 400, 409 duplicate email (case-insensitive)   |
| POST   | `/api/auth/login`            | –    | 200 `{token, user}`                     | 400, 401 `Invalid email or password`          |
| GET    | `/api/auth/me`               | ✔    | 200 `{user}`                            | 401                                           |
| GET    | `/api/tasks?status=&search=` | ✔    | 200 `{tasks: Task[]}` newest first      | 400 bad status                                |
| POST   | `/api/tasks`                 | ✔    | 201 `{task}`                            | 400                                           |
| GET    | `/api/tasks/:id`             | ✔    | 200 `{task}`                            | 400 bad id, 404 (also for other users' tasks) |
| PATCH  | `/api/tasks/:id`             | ✔    | 200 `{task}` (partial update)           | 400 empty/unknown fields, 404                 |
| DELETE | `/api/tasks/:id`             | ✔    | 204                                     | 404                                           |

Auth: `Authorization: Bearer <jwt>`. `user = {id, email, name, createdAt}` (never includes the password hash).
`Task = {id, title, description, status: todo|in_progress|done, priority: low|medium|high, dueDate: YYYY-MM-DD|null, createdAt, updatedAt}`.

Validation rules: name 1–80 chars; email valid, normalised to lower case; password 8–128 chars with
a letter and a digit; title 1–120 chars after trim; description ≤ 2000; dueDate `YYYY-MM-DD` or null.

## UI contract (selectors used by Playwright)

Prefer role/label selectors. Accessible names below are part of the contract.

- Session token is stored in `localStorage["taskboard.token"]`.
- Routes: `/` (redirects), `/login`, `/register`, `/tasks` (auth required, otherwise redirect to `/login`),
  anything else → heading "Page not found". Logged-in users visiting `/login` or `/register` go to `/tasks`.
- Header: `nav[aria-label="Main"]`. Guest: links "Log in", "Sign up". Authenticated:
  `[data-testid=current-user]` (user's name) and button "Log out".
- Login (`/login`): heading "Log in", `form[aria-label="Log in"]`, labels "Email", "Password",
  submit button "Log in", link "Create one" → `/register`. Server errors render in `role=alert`.
- Register (`/register`): heading "Create account", `form[aria-label="Create account"]`, labels "Name",
  "Email", "Password", "Confirm password", submit button "Create account", link "Log in".
- Client-side validation messages render under the field and the input gets `aria-invalid="true"`.
- Tasks (`/tasks`): heading "<name>’s tasks". `form[aria-label="New task"]` with labels "Title",
  "Description", "Priority" (select: low/medium/high), "Due date"; submit button "Add task".
  - `section[aria-label="Task list"]`; filter group `role=group` "Filter by status" with toggle buttons
    "All", "To do", "In progress", "Done" (`aria-pressed`); search box "Search tasks" + button "Search".
  - `[data-testid=empty-state]`, `[data-testid=task-count]` ("1 task" / "N tasks").
  - Each task: `li[data-testid=task-item][data-task-id]` containing `[data-testid=task-title]`,
    `[data-testid=task-priority]`, optional `[data-testid=task-due]` ("Due YYYY-MM-DD"),
    select "Status for <title>" (options "To do", "In progress", "Done"),
    buttons "Edit <title>", "Delete <title>" → then "Confirm delete <title>" / "Keep".
    Edit mode: textbox "New title for <title>", buttons "Save" / "Cancel".

## Playwright ↔ CI contract

Scripts in `playwright/package.json` (run with `npm run <script> -w playwright`):

| Script             | Purpose                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test`             | Run every discovered test (starts servers via `webServer` unless `PW_SKIP_WEBSERVER=1`)                                                                                              |
| `test:smoke`       | Tests tagged `@smoke`                                                                                                                                                                |
| `test:regression`  | Tests tagged `@regression`                                                                                                                                                           |
| `verify:discovery` | Fails if any `*.spec.ts` under `tests/` is not discovered, any non-spec `.ts` file sits in `tests/`, or zero tests are found                                                         |
| `verify:results`   | Reads `test-results/results.json`; fails on zero executed tests, any failure, or any skipped test; writes `test-results/summary.md` (and appends to `$GITHUB_STEP_SUMMARY` when set) |

Environment: `E2E_BASE_URL` (default `http://localhost:4173`), `E2E_API_URL` (default `http://localhost:3001`),
`PW_SKIP_WEBSERVER` (`1` when services are started externally, as in CI).

Output locations (relative to `playwright/`): `playwright-report/` (HTML), `test-results/` (traces,
screenshots, videos, `results.json`, `junit.xml`, `summary.md`).
