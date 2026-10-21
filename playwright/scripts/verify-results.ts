// Guard: fail unless test-results/results.json shows a real, fully green run (no failures, no skips).
// Writes test-results/summary.md and appends it to $GITHUB_STEP_SUMMARY when set.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const resultsFile = path.join(root, 'test-results/results.json');
const summaryFile = path.join(root, 'test-results/summary.md');

if (!existsSync(resultsFile)) {
  console.error(
    `verify-results FAILED: ${path.relative(process.cwd(), resultsFile) || resultsFile} not found. Did the tests run?`,
  );
  process.exit(1);
}

interface Attachment {
  name: string;
  path?: string;
}
interface Result {
  status: string;
  error?: { message?: string };
  attachments?: Attachment[];
}
interface TestCase {
  projectName: string;
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  results: Result[];
}
interface Spec {
  title: string;
  file: string;
  line: number;
  tests: TestCase[];
}
interface Suite {
  specs?: Spec[];
  suites?: Suite[];
}
const report = JSON.parse(readFileSync(resultsFile, 'utf8')) as {
  suites: Suite[];
  errors?: { message?: string }[];
};

const rows: { spec: Spec; test: TestCase }[] = [];
(function walk(suites: Suite[]) {
  for (const s of suites) {
    for (const spec of s.specs ?? []) for (const test of spec.tests) rows.push({ spec, test });
    walk(s.suites ?? []);
  }
})(report.suites ?? []);

const count = (status: TestCase['status']) => rows.filter((r) => r.test.status === status).length;
const passed = count('expected');
const failed = count('unexpected');
const flaky = count('flaky');
const skipped = count('skipped');
const globalErrors = report.errors ?? [];

const strip = (s: string) => stripVTControlCharacters(s);
const trim = (raw: string, max = 600) => {
  const s = strip(raw);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
const rel = (p: string) => path.relative(root, p) || p;

const lines: string[] = [];
lines.push('## Playwright results', '');
lines.push('| Total | Passed | Failed | Flaky | Skipped |', '| --: | --: | --: | --: | --: |');
lines.push(`| ${rows.length} | ${passed} | ${failed} | ${flaky} | ${skipped} |`, '');

const failures = rows.filter((r) => r.test.status === 'unexpected');
if (failures.length > 0) {
  lines.push('### Failures', '');
  for (const { spec, test } of failures) {
    const last = test.results.at(-1);
    lines.push(
      `#### ${spec.title} (${test.projectName})`,
      `- Location: \`tests/${spec.file}:${spec.line}\``,
    );
    lines.push('', '```', trim(last?.error?.message ?? 'No error message recorded'), '```');
    for (const a of last?.attachments ?? []) {
      if (a.path && /trace|screenshot|video/i.test(`${a.name} ${a.path}`))
        lines.push(`- ${a.name}: \`${rel(a.path)}\``);
    }
    lines.push('');
  }
}
const flakyRows = rows.filter((r) => r.test.status === 'flaky');
if (flakyRows.length > 0) {
  lines.push('### Flaky (passed on retry)', '');
  for (const { spec, test } of flakyRows)
    lines.push(`- ${spec.title} (${test.projectName}) \`tests/${spec.file}:${spec.line}\``);
  lines.push('');
}
const skippedRows = rows.filter((r) => r.test.status === 'skipped');
if (skippedRows.length > 0) {
  lines.push('### Skipped', '');
  for (const { spec, test } of skippedRows)
    lines.push(`- ${spec.title} (${test.projectName}) \`tests/${spec.file}:${spec.line}\``);
  lines.push('');
}
for (const e of globalErrors)
  lines.push('### Global error', '', '```', trim(e.message ?? 'unknown'), '```', '');

const problems: string[] = [];
if (rows.length === 0) problems.push('zero tests were executed');
if (failed > 0) problems.push(`${failed} test(s) failed`);
if (skipped > 0) problems.push(`${skipped} test(s) were skipped`);
if (globalErrors.length > 0) problems.push(`${globalErrors.length} global error(s) reported`);
lines.push(
  problems.length ? `**Result: FAILED** (${problems.join('; ')})` : '**Result: PASSED**',
  '',
);

const markdown = lines.join('\n');
mkdirSync(path.dirname(summaryFile), { recursive: true });
writeFileSync(summaryFile, markdown);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);

console.log(markdown);
if (problems.length > 0) {
  console.error(`verify-results FAILED: ${problems.join('; ')}`);
  if (failures.length > 0) {
    console.error(
      'Artifacts: playwright/playwright-report/index.html, playwright/test-results/artifacts/',
    );
  }
  process.exit(1);
}
console.log(`verify-results OK: ${rows.length} tests, all passed.`);
