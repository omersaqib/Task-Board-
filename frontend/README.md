# TaskBoard frontend

React 19 + Vite + TypeScript single-page app. Plain CSS, a ~80-line History-API router, no UI libraries.

## Scripts

Run from the repo root with `-w frontend` (or from `frontend/`):

| Script                          | What it does                                                   |
| ------------------------------- | -------------------------------------------------------------- |
| `npm run dev -w frontend`       | Vite dev server on http://localhost:5173                       |
| `npm run build -w frontend`     | Type-check, then production build into `frontend/dist`         |
| `npm run preview -w frontend`   | Serve `dist` on http://localhost:4173 (what Playwright/CI use) |
| `npm run typecheck -w frontend` | `tsc --noEmit`                                                 |
| `npm test -w frontend`          | Vitest + Testing Library (jsdom)                               |

## API proxy

The browser only talks to its own origin; `/api/*` is proxied by both `vite dev` and `vite preview`
to `API_PROXY_TARGET` (default `http://localhost:3001`):

```sh
API_PROXY_TARGET=http://localhost:3201 npm run dev -w frontend
```

## Structure

```
src/
  main.tsx, App.tsx     entry, route table, auth guards, focus-on-navigate, skip link
  lib/api.ts            fetch client, ApiError, 401 handler hook
  lib/auth.tsx          AuthProvider (token in localStorage "taskboard.token", restored via /api/auth/me)
  lib/router.tsx        RouterProvider, Link, Redirect
  lib/validation.ts     client-side validation mirroring backend rules
  lib/due.ts            relative due-date hint (pure; `today` injectable for tests)
  lib/useDocumentTitle  "<Page> · TaskBoard" titles
  components/           Header, Field (labelled input + error), TaskForm, TaskItem
  pages/                Login, Register, Tasks, NotFound
  design/tokens.css     "Ledger" design tokens (light + dark via prefers-color-scheme)
  design/components.css .tb-* component classes (source: docs/design/taskboard-design-system.html)
  styles.css            app-shell/layout glue only
tests/                  Vitest component/integration tests (fetch is mocked)
```

## Behaviour notes

- Any 401 on an authenticated request clears the token and returns the user to `/login`.
- Only the latest task-list request may update the UI, so quick filter changes cannot show stale results.
- Accessible names, labels, roles and `data-testid`s are a frozen contract with the Playwright suite
  (see `docs/CONTRACTS.md`, "UI contract"). Do not rename them; button names stay constant while a
  request is in flight (the button is disabled with `aria-busy` instead).
- `role="alert"` is used only for errors; the "Task added" confirmation uses `role="status"`.

## Design system

The UI follows `docs/design/taskboard-design-system.html`. Add visual styling through the `.tb-*` classes;
decorative elements (glyph, priority meter, avatar, due hint) are `aria-hidden` or sit outside the contract
nodes, so `data-testid=task-priority` is the bare word and `data-testid=task-due` is exactly `Due YYYY-MM-DD`.
Fonts (Bricolage Grotesque, IBM Plex) load from Google Fonts in `index.html` with system fallbacks.

## Testing

`npm test -w frontend` runs everything in `tests/`: validation, `TaskForm`, `TaskItem`, and app-level flows
(guest redirect, failed login, 401 mid-session, router links/focus, stale-response handling).
End-to-end tests live in `playwright/`.
