import { expect, type Locator, type Page } from '@playwright/test';
import { Header } from './header.ts';

export interface NewTask {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export class TasksPage {
  readonly page: Page;
  readonly header: Header;
  readonly form: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly priority: Locator;
  readonly dueDate: Locator;
  readonly addButton: Locator;
  readonly list: Locator;
  readonly items: Locator;
  readonly emptyState: Locator;
  readonly count: Locator;
  readonly filterGroup: Locator;
  readonly searchBox: Locator;
  readonly searchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new Header(page);
    this.form = page.getByRole('form', { name: 'New task' });
    this.title = this.form.getByLabel('Title');
    this.description = this.form.getByLabel('Description');
    this.priority = this.form.getByLabel('Priority');
    this.dueDate = this.form.getByLabel('Due date');
    this.addButton = this.form.getByRole('button', { name: 'Add task' });
    this.list = page.getByRole('region', { name: 'Task list' });
    this.items = this.list.getByTestId('task-item');
    this.emptyState = this.list.getByTestId('empty-state');
    this.count = this.list.getByTestId('task-count');
    this.filterGroup = page.getByRole('group', { name: 'Filter by status' });
    this.searchBox = page.getByRole('searchbox', { name: 'Search tasks' });
    this.searchButton = page.getByRole('button', { name: 'Search', exact: true });
  }

  async goto() {
    await this.page.goto('/tasks');
  }

  heading(userName: string) {
    return this.page.getByRole('heading', { name: `${userName}’s tasks` });
  }

  async addTask(task: NewTask) {
    await this.title.fill(task.title);
    if (task.description !== undefined) await this.description.fill(task.description);
    if (task.priority) await this.priority.selectOption(task.priority);
    if (task.dueDate) await this.dueDate.fill(task.dueDate);
    await this.addButton.click();
    // The form resets only after the server accepted the task and the list refreshed; waiting for
    // the new item prevents the next fill() from being wiped by that reset.
    await expect(this.item(task.title)).toBeVisible();
    await expect(this.title).toHaveValue('');
  }

  /** The list item whose title is exactly `title`. */
  item(title: string): Locator {
    return this.items.filter({
      has: this.page.getByTestId('task-title').getByText(title, { exact: true }),
    });
  }

  statusSelect(title: string) {
    return this.item(title).getByLabel(`Status for ${title}`);
  }

  filter(name: 'All' | 'To do' | 'In progress' | 'Done') {
    return this.filterGroup.getByRole('button', { name, exact: true });
  }

  async search(term: string) {
    await this.searchBox.fill(term);
    await this.searchButton.click();
  }

  /** The list item with this task id; stable while the title is being edited. */
  itemById(id: string): Locator {
    return this.items.and(this.page.locator(`[data-task-id="${id}"]`));
  }

  async rename(title: string, newTitle: string) {
    const id = await this.item(title).getAttribute('data-task-id');
    if (!id) throw new Error(`No task item found for "${title}"`);
    const item = this.itemById(id);
    await item.getByRole('button', { name: `Edit ${title}` }).click();
    await item.getByRole('textbox', { name: `New title for ${title}` }).fill(newTitle);
    await item.getByRole('button', { name: 'Save' }).click();
  }

  async startEdit(title: string): Promise<Locator> {
    const id = await this.item(title).getAttribute('data-task-id');
    if (!id) throw new Error(`No task item found for "${title}"`);
    const item = this.itemById(id);
    await item.getByRole('button', { name: `Edit ${title}` }).click();
    return item;
  }

  async remove(title: string) {
    await this.item(title)
      .getByRole('button', { name: `Delete ${title}` })
      .click();
    await this.item(title)
      .getByRole('button', { name: `Confirm delete ${title}` })
      .click();
  }
}
