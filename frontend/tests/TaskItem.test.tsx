import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskItem } from '../src/components/TaskItem';
import type { Task } from '../src/lib/api';

const task: Task = {
  id: 7,
  title: 'Write docs',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '2030-01-02',
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
};

function setup(overrides: Partial<Parameters<typeof TaskItem>[0]> = {}) {
  const props = {
    task,
    onStatusChange: vi.fn().mockResolvedValue(undefined),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(
    <ul>
      <TaskItem {...props} />
    </ul>,
  );
  return props;
}

describe('TaskItem', () => {
  it('requires confirmation before deleting, and "Keep" cancels', async () => {
    const { onDelete } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Write docs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Write docs' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Write docs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete Write docs' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows a failed delete in an alert', async () => {
    setup({ onDelete: vi.fn().mockRejectedValue(new Error('Task not found')) });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Write docs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete Write docs' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Task not found');
  });

  it('renames via the edit form and returns focus to Edit', async () => {
    const { onRename } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Write docs' }));
    const input = screen.getByRole('textbox', { name: 'New title for Write docs' });
    await userEvent.clear(input);
    await userEvent.type(input, ' Write more docs ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onRename).toHaveBeenCalledWith('Write more docs');
    expect(await screen.findByRole('button', { name: 'Edit Write docs' })).toHaveFocus();
  });

  it('cancel discards the draft and returns focus to Edit', async () => {
    const { onRename } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Write docs' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New title for Write docs' }), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByTestId('task-title')).toHaveTextContent('Write docs');
    expect(screen.getByRole('button', { name: 'Edit Write docs' })).toHaveFocus();
  });

  it('rejects an empty title without calling the server', async () => {
    const { onRename } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Write docs' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'New title for Write docs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('disables controls while a status change is in flight', async () => {
    let resolve!: () => void;
    setup({ onStatusChange: vi.fn(() => new Promise<void>((r) => (resolve = r))) });
    await userEvent.selectOptions(screen.getByLabelText('Status for Write docs'), 'done');
    expect(screen.getByLabelText('Status for Write docs')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Write docs' })).toBeDisabled();
    resolve();
    expect(await screen.findByRole('button', { name: 'Delete Write docs' })).toBeEnabled();
  });

  it('exposes contract test ids', () => {
    setup();
    expect(screen.getByTestId('task-item')).toHaveAttribute('data-task-id', '7');
    expect(screen.getByTestId('task-priority')).toHaveTextContent('medium');
    expect(screen.getByTestId('task-due')).toHaveTextContent('Due 2030-01-02');
  });

  it('keeps contract text clean: priority is the bare word, due is "Due YYYY-MM-DD" with a sibling hint', () => {
    setup({ task: { ...task, dueDate: '2000-01-01' } });
    expect(screen.getByTestId('task-priority').textContent).toBe('medium');
    expect(screen.getByTestId('task-due').textContent).toBe('Due 2000-01-01');
    expect(screen.getByTestId('task-due').parentElement).toHaveTextContent(/days overdue/);
  });

  it('shows no due hint for done tasks', () => {
    setup({ task: { ...task, status: 'done', dueDate: '2000-01-01' } });
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });
});
