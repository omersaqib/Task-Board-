import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError, type TaskInput, type TaskPriority } from '../lib/api';
import { hasErrors, validateTask, type FieldErrors } from '../lib/validation';
import { Field, FieldError, FormAlert } from './Field';

const EMPTY: TaskInput = { title: '', description: '', priority: 'medium', dueDate: null };

export function TaskForm({ onSubmit }: { onSubmit: (input: TaskInput) => Promise<void> }) {
  const [values, setValues] = useState<TaskInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<'title' | 'description' | 'dueDate'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const descriptionId = useId();
  const priorityId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateTask(values);
    setErrors(validation);
    setFormError(null);
    setCreated(null);
    if (hasErrors(validation)) {
      (validation.title ? titleRef : descriptionRef).current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const title = values.title.trim();
      await onSubmit({ ...values, title });
      setValues(EMPTY);
      setCreated(`Task “${title}” added.`);
      // The submit button keeps focus otherwise; return to the first field for rapid entry.
      titleRef.current?.focus();
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        setErrors(Object.fromEntries(error.details.map((d) => [d.field, d.message])));
      }
      setFormError(error instanceof Error ? error.message : 'Could not create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tb-card" aria-label="New task" onSubmit={handleSubmit} noValidate>
      <h2 className="tb-h2">New task</h2>
      <FormAlert message={formError} />
      <Field
        ref={titleRef}
        label="Title"
        value={values.title}
        error={errors.title}
        maxLength={200}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
      />
      <div className="tb-field">
        <label className="tb-label" htmlFor={descriptionId}>
          Description
        </label>
        <textarea
          className="tb-textarea"
          id={descriptionId}
          ref={descriptionRef}
          rows={2}
          value={values.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? `${descriptionId}-error` : undefined}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
        <FieldError id={`${descriptionId}-error`}>{errors.description}</FieldError>
      </div>
      <div className="tb-form-row">
        <div className="tb-field">
          <label className="tb-label" htmlFor={priorityId}>
            Priority
          </label>
          <select
            className="tb-select"
            id={priorityId}
            value={values.priority}
            onChange={(e) => setValues({ ...values, priority: e.target.value as TaskPriority })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <Field
          label="Due date"
          type="date"
          value={values.dueDate ?? ''}
          error={errors.dueDate}
          onChange={(e) => setValues({ ...values, dueDate: e.target.value || null })}
        />
      </div>
      <button
        type="submit"
        className="tb-btn tb-btn--primary tb-btn--block"
        disabled={submitting}
        aria-busy={submitting}
      >
        Add task
      </button>
      {/* Always mounted so screen readers announce the text when it changes. */}
      <p role="status" className="tb-status form-status">
        {created}
      </p>
    </form>
  );
}
