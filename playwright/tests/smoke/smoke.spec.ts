import { expect, test } from '../../fixtures/index.ts';
import { LoginPage } from '../../pages/login-page.ts';

test.describe('smoke', { tag: '@smoke' }, () => {
  test('app loads and shows guest navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });

  test('health endpoint reports ok', async ({ api }) => {
    const res = await api.health();
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('login page renders its form', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.heading).toBeVisible();
    await expect(login.email).toBeVisible();
    await expect(login.password).toBeVisible();
    await expect(login.submit).toBeEnabled();
    await expect(login.createAccountLink).toHaveAttribute('href', '/register');
  });

  test('unknown route shows Page not found', async ({ page }) => {
    await page.goto('/definitely-not-a-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
