import type { Locator, Page } from '@playwright/test';
import { Header } from './header.ts';

export class LoginPage {
  readonly page: Page;
  readonly header: Header;
  readonly heading: Locator;
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly alert: Locator;
  readonly createAccountLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new Header(page);
    this.heading = page.getByRole('heading', { name: 'Log in' });
    this.form = page.getByRole('form', { name: 'Log in' });
    this.email = this.form.getByLabel('Email');
    this.password = this.form.getByLabel('Password');
    this.submit = this.form.getByRole('button', { name: 'Log in' });
    this.alert = this.form.getByRole('alert');
    this.createAccountLink = page.getByRole('link', { name: 'Create one' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
