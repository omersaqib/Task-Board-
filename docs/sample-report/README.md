# Sample test report

These files were produced by real runs of the suite on 2026-10-21 and show how results reach developers.

| File                                             | What it shows                                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [passing-summary.md](passing-summary.md)         | `verify:results` output after a green run: 58 tests, 0 failed, 0 skipped.                                                                                                      |
| [failing-summary.md](failing-summary.md)         | The same report after a deliberately failing test was added (then removed): the test name, file and line, the assertion diff and the paths to its screenshot, video and trace. |
| [failure-screenshot.png](failure-screenshot.png) | The screenshot Playwright captured at the moment of that failure.                                                                                                              |

## Where these appear in CI

- **Job summary:** `verify:results` appends the summary table to the GitHub Actions run page (`$GITHUB_STEP_SUMMARY`).
- **Annotations:** in CI Playwright uses the `github` reporter, so each failure is annotated on the PR's changed-files view.
- **Artifacts** (kept 14 days, uploaded even when the job fails):
  - `playwright-report`: the HTML report. Download, unzip, then run `npx playwright show-report <folder>`.
  - `test-results`: traces, screenshots, videos, `results.json`, `junit.xml` and `summary.md`. Open a trace with `npx playwright show-trace trace.zip`.
  - `logs`: backend and frontend server logs.
- **Gate:** any failure makes the `e2e` job fail, so the required `CI Gate` check fails and the PR cannot be merged.
