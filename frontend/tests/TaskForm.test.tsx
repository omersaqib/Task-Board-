import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskForm } from '../src/components/TaskForm';
import { ApiError } from '../src/lib/api';

describe('TaskForm', () => {
  it('shows a validation error and does not submit a blank title', async () => {
    const onSubmit = vi.fn();
    render(<TaskForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));

    expect(screen.getByText('Title is required')).toBeVisible();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values and resets the form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), '  Ship it  ');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'high');
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Ship it',
      description: '',
      priority: 'high',
      dueDate: null,
    });
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('surfaces server-side errors', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'VALIDATION_ERROR', 'Due date is invalid', [
          { field: 'dueDate', message: 'Due date is invalid' },
        ]),
      );
    render(<TaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'Task');
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Due date is invalid');
    expect(screen.getByLabelText('Title')).toHaveValue('Task');
  });

  it('announces success in a status region and returns focus to the title', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'Ship it');
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Task “Ship it” added.');
    expect(screen.getByLabelText('Title')).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('focuses the title when validation fails and keeps the button name stable while submitting', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<TaskForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(screen.getByLabelText('Title')).toHaveFocus();

    await userEvent.type(screen.getByLabelText('Title'), 'Slow');
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
    resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled());
  });
});
