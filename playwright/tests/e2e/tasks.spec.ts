import { expect, test } from '../../fixtures/index.ts';
import { TasksPage } from '../../pages/tasks-page.ts';
import { isoDate, uniqueTitle } from '../../utils/data.ts';

test.describe('tasks', () => {
  let tasks: TasksPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    tasks = new TasksPage(page);
    await tasks.goto();
    await expect(tasks.form).toBeVisible();
  });

  test('new user sees the empty state', async () => {
    await expect(tasks.emptyState).toContainText('No tasks yet');
    await expect(tasks.items).toHaveCount(0);
  });

  test('create a task with priority and due date', async () => {
    const title = uniqueTitle('Create');
    const due = isoDate(10);
    await tasks.addTask({ title, description: 'Details here', priority: 'high', dueDate: due });

    const item = tasks.item(title);
    await expect(item).toBeVisible();
    await expect(item.getByTestId('task-priority')).toHaveText('high');
    await expect(item.getByTestId('task-due')).toHaveText(`Due ${due}`);
    await expect(tasks.count).toHaveText('1 task');
    await expect(tasks.title).toHaveValue('');
  });

  test('empty title shows a validation error and creates nothing', async () => {
    await tasks.addButton.click();
    await expect(tasks.title).toHaveAttribute('aria-invalid', 'true');
    await expect(tasks.form.getByText('Title is required')).toBeVisible();
    await expect(tasks.items).toHaveCount(0);
  });

  test('edit a task title', async () => {
    const title = uniqueTitle('Before');
    const renamed = uniqueTitle('After');
    await tasks.addTask({ title });
    await tasks.rename(title, renamed);

    await expect(tasks.item(renamed)).toBeVisible();
    await expect(tasks.item(title)).toHaveCount(0);
  });

  test('cancel edit keeps the original title', async ({ page }) => {
    const title = uniqueTitle('Keep');
    await tasks.addTask({ title });
    const item = await tasks.startEdit(title);
    await item.getByRole('textbox', { name: `New title for ${title}` }).fill('discarded');
    await item.getByRole('button', { name: 'Cancel' }).click();
    await expect(tasks.item(title)).toBeVisible();
    await expect(page.getByText('discarded')).toHaveCount(0);
  });

  test('change a task status', async () => {
    const title = uniqueTitle('Status');
    await tasks.addTask({ title });
    await tasks.statusSelect(title).selectOption('done');
    await expect(tasks.statusSelect(title)).toHaveValue('done');

    await tasks.filter('Done').click();
    await expect(tasks.item(title)).toBeVisible();
  });

  test('filter tabs show only matching tasks', async () => {
    const todo = uniqueTitle('Todo');
    const doing = uniqueTitle('Doing');
    const done = uniqueTitle('Finished');
    await tasks.addTask({ title: todo });
    await tasks.addTask({ title: doing });
    await tasks.addTask({ title: done });
    await tasks.statusSelect(doing).selectOption('in_progress');
    await expect(tasks.statusSelect(doing)).toHaveValue('in_progress');
    await tasks.statusSelect(done).selectOption('done');
    await expect(tasks.statusSelect(done)).toHaveValue('done');

    await expect(tasks.filter('All')).toHaveAttribute('aria-pressed', 'true');
    await expect(tasks.items).toHaveCount(3);

    await tasks.filter('To do').click();
    await expect(tasks.filter('To do')).toHaveAttribute('aria-pressed', 'true');
    await expect(tasks.items).toHaveCount(1);
    await expect(tasks.item(todo)).toBeVisible();

    await tasks.filter('In progress').click();
    await expect(tasks.items).toHaveCount(1);
    await expect(tasks.item(doing)).toBeVisible();

    await tasks.filter('Done').click();
    await expect(tasks.items).toHaveCount(1);
    await expect(tasks.item(done)).toBeVisible();

    await tasks.filter('All').click();
    await expect(tasks.items).toHaveCount(3);
  });

  test('search narrows the list and shows an empty state for no match', async () => {
    const needle = `needle${Date.now()}`;
    const hit = uniqueTitle(needle);
    const miss = uniqueTitle('Haystack');
    await tasks.addTask({ title: hit });
    await tasks.addTask({ title: miss });

    await tasks.search(needle);
    await expect(tasks.items).toHaveCount(1);
    await expect(tasks.item(hit)).toBeVisible();

    await tasks.search('zzz-no-such-task');
    await expect(tasks.emptyState).toContainText('No tasks match your filters');
    await expect(tasks.items).toHaveCount(0);
  });

  test('delete asks for confirmation; Keep cancels, Confirm removes', async () => {
    const title = uniqueTitle('Delete');
    await tasks.addTask({ title });
    const item = tasks.item(title);

    await item.getByRole('button', { name: `Delete ${title}` }).click();
    await item.getByRole('button', { name: 'Keep' }).click();
    await expect(item).toBeVisible();
    await expect(item.getByRole('button', { name: `Delete ${title}` })).toBeVisible();

    await tasks.remove(title);
    await expect(item).toHaveCount(0);
    await expect(tasks.emptyState).toBeVisible();
  });

  test('tasks persist across a reload', async ({ page }) => {
    const title = uniqueTitle('Persist');
    await tasks.addTask({ title, priority: 'low' });
    await expect(tasks.item(title)).toBeVisible();

    await page.reload();
    await expect(tasks.item(title)).toBeVisible();
    await expect(tasks.item(title).getByTestId('task-priority')).toHaveText('low');
  });

  test('tasks are isolated per user', async ({ api, testUser }) => {
    const title = uniqueTitle('Mine');
    await tasks.addTask({ title });
    await expect(tasks.item(title)).toBeVisible();
    const res = await api.listTasks(testUser.token);
    const body = await res.json();
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual([title]);
  });
});
