## Playwright results

| Total | Passed | Failed | Flaky | Skipped |
| ----: | -----: | -----: | ----: | ------: |
|     1 |      0 |      1 |     0 |       0 |

### Failures

#### sample failure: login heading has the wrong text (chromium)

- Location: `tests/zz-sample/sample-failure.spec.ts:3`

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByRole('heading', { level: 1 })
Expected: "Sign in"
Received: "Log in"
Timeout:  2000ms

Call log:
  - Expect "toHaveText" getByRole('heading', { level: 1 }) with timeout 2000ms
  - waiting for getByRole('heading', { level: 1 })
    21 × locator resolved to <h1 class="tb-title tb-title--card">Log in</h1>
       - unexpected value "Log in"

```

- screenshot: `test-results/artifacts/zz-sample-sample-failure-s-b28b6--heading-has-the-wrong-text-chromium/test-failed-1.png`
- video: `test-results/artifacts/zz-sample-sample-failure-s-b28b6--heading-has-the-wrong-text-chromium/video.webm`
- trace: `test-results/artifacts/zz-sample-sample-failure-s-b28b6--heading-has-the-wrong-text-chromium/trace.zip`

**Result: FAILED** (1 test(s) failed)
