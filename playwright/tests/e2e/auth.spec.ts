import { expect, test } from '../../fixtures/index.ts';
import { LoginPage } from '../../pages/login-page.ts';
import { RegisterPage } from '../../pages/register-page.ts';
import { TasksPage } from '../../pages/tasks-page.ts';
import { uniqueEmail, VALID_PASSWORD } from '../../utils/data.ts';
import { TOKEN_KEY } from '../../utils/env.ts';

test.describe('registration', () => {
  test('a new user registers and lands on their tasks', async ({ page }) => {
    const register = new RegisterPage(page);
    const tasks = new TasksPage(page);
    const name = 'Rita Register';
    await register.goto();
    await register.register({ name, email: uniqueEmail(), password: VALID_PASSWORD });

    await expect(page).toHaveURL(/\/tasks$/);
    await expect(tasks.heading(name)).toBeVisible();
    await expect(tasks.header.currentUser).toHaveText(name);
    await expect(tasks.emptyState).toBeVisible();
  });

  test('duplicate email surfaces a server error', async ({ page, testUser }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.register({ name: 'Dup', email: testUser.email, password: VALID_PASSWORD });

    await expect(register.alert).toContainText('already exists');
    await expect(page).toHaveURL(/\/register$/);
  });

  test('client-side validation flags every invalid field', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.submit.click();

    for (const field of [register.name, register.email, register.password]) {
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(register.form.getByText('Name is required')).toBeVisible();
    await expect(register.form.getByText('Email is required')).toBeVisible();
    await expect(register.form.getByText('Password is required')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('mismatched password confirmation is rejected', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.register({
      name: 'Mismatch',
      email: uniqueEmail(),
      password: VALID_PASSWORD,
      confirmPassword: 'Different1password',
    });
    await expect(register.confirmPassword).toHaveAttribute('aria-invalid', 'true');
    await expect(register.form.getByText('Passwords do not match')).toBeVisible();
  });

  test('weak password is rejected client-side', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.register({ name: 'Weak', email: uniqueEmail(), password: 'short1' });
    await expect(register.password).toHaveAttribute('aria-invalid', 'true');
    await expect(register.form.getByText('Password must be at least 8 characters')).toBeVisible();
  });
});

test.describe('login and logout', () => {
  test('existing user logs in and out', async ({ page, testUser }) => {
    const login = new LoginPage(page);
    const tasks = new TasksPage(page);
    await login.goto();
    await login.login(testUser.email, testUser.password);

    await expect(page).toHaveURL(/\/tasks$/);
    await expect(tasks.header.currentUser).toHaveText(testUser.name);
    await expect(tasks.header.loginLink).toBeHidden();

    await tasks.header.logout();
    await expect(page).toHaveURL(/\/login$/);
    await expect(login.header.loginLink).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  });

  test('wrong password surfaces an error alert', async ({ page, testUser }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(testUser.email, 'Wrong-password9');
    await expect(login.alert).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('client-side validation flags empty and malformed fields', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.submit.click();
    await expect(login.email).toHaveAttribute('aria-invalid', 'true');
    await expect(login.password).toHaveAttribute('aria-invalid', 'true');

    await login.email.fill('not-an-email');
    await login.password.fill('x');
    await login.submit.click();
    await expect(login.form.getByText('Enter a valid email address')).toBeVisible();
    await expect(login.password).not.toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('route guards and session', () => {
  test('guest visiting /tasks is redirected to /login', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/login$/);
    await expect(new LoginPage(page).heading).toBeVisible();
  });

  test('logged-in user visiting /login or /register goes to /tasks', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/tasks$/);
    await page.goto('/register');
    await expect(page).toHaveURL(/\/tasks$/);
  });

  test('session is restored after a reload', async ({ authenticatedPage: page, testUser }) => {
    const tasks = new TasksPage(page);
    await tasks.goto();
    await expect(tasks.header.currentUser).toHaveText(testUser.name);
    await page.reload();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(tasks.header.currentUser).toHaveText(testUser.name);
  });

  test('an invalid token in localStorage redirects to login', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'not.a.valid.token'), TOKEN_KEY);
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/login$/);
    await expect(new LoginPage(page).heading).toBeVisible();
  });
});
