# TaskBoard Playwright suite

## Structure

```
playwright.config.ts   projects: api (tests/api/**, no browser) and chromium (everything else)
global-setup.ts        polls API /api/health and the web root (60s); throws if unhealthy
fixtures/index.ts      typed `test`: api (ApiClient), testUser (unique per test), authenticatedPage
pages/                 page objects: LoginPage, RegisterPage, TasksPage, Header
utils/                 env (URLs), data (unique emails/titles), api-client
tests/smoke/           @smoke    fast sanity checks
tests/e2e/             browser user journeys
tests/api/             HTTP contract tests
tests/regression/      @regression, one test per bug class (REG-NNN)
scripts/               verify-discovery.ts, verify-results.ts
```

## Run locally

```sh
npm install && npx playwright install chromium   # once
npm run build                                    # from the repo root
npm run test -w playwright                       # starts API + preview automatically
npm run test:smoke -w playwright
npm run test:regression -w playwright
npm run report -w playwright                     # open the HTML report
```

Environment: `E2E_BASE_URL` (default `http://localhost:4173`), `E2E_API_URL` (default `http://localhost:3001`),
`PW_SKIP_WEBSERVER=1` to use services you started yourself (global setup then fails fast if they are down).
Locally the API uses a throwaway DB at `playwright/.cache/e2e.db`, recreated whenever Playwright launches the server.

## Adding a test

- Create `tests/<any-folder>/<name>.spec.ts`. Files must end in `.spec.ts`; any new folder is picked up
  automatically (only `tests/api/` runs without a browser).
- Import `test`/`expect` from `fixtures/index.ts`. Use `testUser` for isolated data, `authenticatedPage` for a
  logged-in page, `api` for API calls/seeding. Never share state between tests.
- Tag with `{ tag: '@smoke' }` / `{ tag: '@regression' }` on `test.describe` or `test`. Regression tests get an
  `REG-NNN` id in the title and a comment naming the bug class they guard.
- Use web-first assertions and role/label locators; no `waitForTimeout`, `test.only` or `test.skip`.
- Put helpers in `pages/` or `utils/`, never in `tests/`.

## Guards

- `npm run verify:discovery -w playwright` runs `playwright test --list` and compares with spec files on disk. It
  fails on a spec with no discovered tests, any non-`*.spec.ts` TypeScript/JS file in `tests/` (which Playwright
  would silently ignore), or zero tests.
- `npm run verify:results -w playwright` reads `test-results/results.json` and fails if it is missing, has zero
  tests, any failure, or any skipped test. It writes `test-results/summary.md` (and appends to
  `$GITHUB_STEP_SUMMARY` in CI) with failure locations, trimmed errors and trace/screenshot paths.

Outputs: `playwright-report/` (HTML), `test-results/{results.json,junit.xml,summary.md}`,
`test-results/artifacts/` (traces, screenshots, videos on failure).
