import { useEffect, useRef, useState } from 'react';
import type { Task, TaskStatus } from '../lib/api';
import { getDueHint } from '../lib/due';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

interface TaskItemProps {
  task: Task;
  onStatusChange: (status: TaskStatus) => Promise<void>;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskItem({ task, onStatusChange, onRename, onDelete }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // The Save/Cancel buttons unmount when editing ends; hand focus back to "Edit".
  useEffect(() => {
    if (wasEditing.current && !editing) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const hint = getDueHint(task.dueDate, task.status);

  return (
    <li
      className={`tb-row${task.status === 'done' ? ' tb-row--done' : ''}`}
      data-testid="task-item"
      data-task-id={task.id}
    >
      <span className={`tb-glyph tb-glyph--${task.status}`} aria-hidden="true" />
      <div className="tb-row__body">
        {editing ? (
          <form
            className="tb-edit"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) {
                setError('Title is required');
                return;
              }
              if (draft.trim().length > 120) {
                setError('Title must be at most 120 characters');
                return;
              }
              void run(async () => {
                await onRename(draft.trim());
                setEditing(false);
              });
            }}
          >
            <input
              className="tb-input"
              aria-label={`New title for ${task.title}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <button type="submit" className="tb-btn tb-btn--secondary tb-btn--sm" disabled={busy}>
              Save
            </button>
            <button
              type="button"
              className="tb-btn tb-btn--ghost tb-btn--sm"
              onClick={() => {
                setDraft(task.title);
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <h3 className="tb-row__title" data-testid="task-title">
            {task.title}
          </h3>
        )}
        {task.description && <p className="tb-row__desc">{task.description}</p>}
        <div className="tb-row__meta">
          <span className={`tb-priority tb-priority--${task.priority}`} data-testid="task-priority">
            <span className="tb-meter" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className="tb-due" data-testid="task-due">
              Due {task.dueDate}
            </span>
          )}
          {hint && (
            <span
              className={`tb-due-hint${hint.tone === 'normal' ? '' : ` tb-due-hint--${hint.tone}`}`}
            >
              {hint.label}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="tb-error">
            {error}
          </p>
        )}
      </div>

      <div className="tb-row__actions">
        <select
          className="tb-select"
          aria-label={`Status for ${task.title}`}
          value={task.status}
          disabled={busy}
          onChange={(e) => void run(() => onStatusChange(e.target.value as TaskStatus))}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {!editing && (
          <button
            type="button"
            className="tb-btn tb-btn--ghost tb-btn--sm"
            aria-label={`Edit ${task.title}`}
            ref={editButtonRef}
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        )}
        {confirmingDelete ? (
          <span className="tb-confirm">
            Delete this task?
            <button
              type="button"
              className="tb-btn tb-btn--danger-solid tb-btn--sm"
              aria-label={`Confirm delete ${task.title}`}
              disabled={busy}
              onClick={() => void run(onDelete)}
            >
              Confirm
            </button>
            <button
              type="button"
              className="tb-btn tb-btn--ghost tb-btn--sm"
              disabled={busy}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="tb-btn tb-btn--danger tb-btn--sm"
            aria-label={`Delete ${task.title}`}
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
