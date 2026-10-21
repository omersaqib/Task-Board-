// Guard: every *.spec.ts under tests/ must be discovered by Playwright, nothing else may live there.
// Run: node scripts/verify-discovery.ts  (from the playwright workspace)
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const testsDir = path.join(root, 'tests');
const problems: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const onDisk = walk(testsDir).map((f) => path.relative(testsDir, f).split(path.sep).join('/'));
const specFiles = onDisk.filter((f) => f.endsWith('.spec.ts'));
const strays = onDisk.filter(
  (f) => !f.endsWith('.spec.ts') && /\.(ts|tsx|js|mjs|cjs|mts|cts)$/.test(f),
);
for (const f of strays) {
  problems.push(
    `tests/${f} is not named *.spec.ts, so Playwright would silently ignore it (rename it, or move helpers out of tests/)`,
  );
}

interface Suite {
  file?: string;
  specs?: { file: string; tests: unknown[] }[];
  suites?: Suite[];
}
let report: { suites: Suite[]; errors?: { message?: string }[] };
try {
  const out = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  report = JSON.parse(out);
} catch (error) {
  console.error('verify-discovery: `playwright test --list` failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const discovered = new Map<string, number>(); // file (relative to tests/) -> test count
(function collect(suites: Suite[]) {
  for (const s of suites) {
    for (const spec of s.specs ?? []) {
      discovered.set(spec.file, (discovered.get(spec.file) ?? 0) + spec.tests.length);
    }
    collect(s.suites ?? []);
  }
})(report.suites);

for (const e of report.errors ?? []) problems.push(`Playwright reported an error: ${e.message}`);
for (const f of specFiles) {
  if (!discovered.has(f))
    problems.push(`tests/${f} exists but Playwright did not discover any test in it`);
}
for (const f of discovered.keys()) {
  if (!specFiles.includes(f))
    problems.push(`Playwright discovered ${f} which was not found on disk (unexpected)`);
}
const total = [...discovered.values()].reduce((a, b) => a + b, 0);
if (total === 0) problems.push('Zero tests discovered');

if (problems.length > 0) {
  console.error('verify-discovery FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `verify-discovery OK: ${specFiles.length} spec files, ${total} test cases (across projects) discovered.`,
);
