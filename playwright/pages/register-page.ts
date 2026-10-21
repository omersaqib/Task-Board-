import type { Locator, Page } from '@playwright/test';
import { Header } from './header.ts';

export class RegisterPage {
  readonly page: Page;
  readonly header: Header;
  readonly heading: Locator;
  readonly form: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly confirmPassword: Locator;
  readonly submit: Locator;
  readonly alert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new Header(page);
    this.heading = page.getByRole('heading', { name: 'Create account' });
    this.form = page.getByRole('form', { name: 'Create account' });
    this.name = this.form.getByLabel('Name');
    this.email = this.form.getByLabel('Email');
    this.password = this.form.getByLabel('Password', { exact: true });
    this.confirmPassword = this.form.getByLabel('Confirm password');
    this.submit = this.form.getByRole('button', { name: 'Create account' });
    this.alert = this.form.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/register');
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }) {
    await this.name.fill(data.name);
    await this.email.fill(data.email);
    await this.password.fill(data.password);
    await this.confirmPassword.fill(data.confirmPassword ?? data.password);
    await this.submit.click();
  }
}
