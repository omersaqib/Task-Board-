import type { Locator, Page } from '@playwright/test';

export class Header {
  readonly nav: Locator;
  readonly loginLink: Locator;
  readonly signUpLink: Locator;
  readonly currentUser: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Main' });
    this.loginLink = this.nav.getByRole('link', { name: 'Log in' });
    this.signUpLink = this.nav.getByRole('link', { name: 'Sign up' });
    this.currentUser = this.nav.getByTestId('current-user');
    this.logoutButton = this.nav.getByRole('button', { name: 'Log out' });
  }

  async logout() {
    await this.logoutButton.click();
  }
}
