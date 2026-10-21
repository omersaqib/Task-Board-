import { test as base, expect, request, type Page } from '@playwright/test';
import { ApiClient, type AuthResult, type User } from '../utils/api-client.ts';
import { uniqueEmail, VALID_PASSWORD } from '../utils/data.ts';
import { API_URL, TOKEN_KEY } from '../utils/env.ts';

export interface TestUser {
  name: string;
  email: string;
  password: string;
  token: string;
  user: User;
}

interface Fixtures {
  api: ApiClient;
  /** A freshly registered, unique user (isolated data per test). */
  testUser: TestUser;
  /** A page whose localStorage already holds testUser's token. */
  authenticatedPage: Page;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructure even with no deps
  api: async ({}, use) => {
    const context = await request.newContext({ baseURL: API_URL });
    await use(new ApiClient(context));
    await context.dispose();
  },

  testUser: async ({ api }, use, testInfo) => {
    const name = `QA User ${testInfo.workerIndex}`;
    const email = uniqueEmail();
    const res = await api.register({ name, email, password: VALID_PASSWORD });
    expect(res.status(), 'registering the per-test user').toBe(201);
    const { token, user } = (await res.json()) as AuthResult;
    await use({ name, email, password: VALID_PASSWORD, token, user });
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    await page.addInitScript(
      ([key, token]) => window.localStorage.setItem(key as string, token as string),
      [TOKEN_KEY, testUser.token],
    );
    await use(page);
  },
});

export { expect };
