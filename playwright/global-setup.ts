import { API_URL, BASE_URL } from './utils/env.ts';

const TIMEOUT_MS = 60_000;
const INTERVAL_MS = 500;

async function probe(
  url: string,
  check: (res: Response) => Promise<string | null>,
): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return await check(res);
  } catch (error) {
    return `request failed (${error instanceof Error ? error.message : String(error)})`;
  }
}

async function waitFor(
  name: string,
  url: string,
  check: (res: Response) => Promise<string | null>,
) {
  const deadline = Date.now() + TIMEOUT_MS;
  let last = 'no attempt made';
  while (Date.now() < deadline) {
    const problem = await probe(url, check);
    if (problem === null) return;
    last = problem;
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  throw new Error(
    `${name} is not healthy at ${url} after ${TIMEOUT_MS / 1000}s: ${last}.\n` +
      `Start the services (npm run build && npm start) or let Playwright start them (unset PW_SKIP_WEBSERVER).`,
  );
}

export default async function globalSetup() {
  await Promise.all([
    waitFor('API', `${API_URL}/api/health`, async (res) => {
      if (res.status !== 200) return `HTTP ${res.status}`;
      const body = (await res.json()) as { status?: string };
      return body.status === 'ok' ? null : `unexpected body ${JSON.stringify(body)}`;
    }),
    waitFor('Frontend', `${BASE_URL}/`, async (res) =>
      res.status === 200 ? null : `HTTP ${res.status}`,
    ),
  ]);
}
