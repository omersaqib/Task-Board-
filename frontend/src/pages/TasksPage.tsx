import { useCallback, useEffect, useRef, useState } from 'react';
import { TaskForm } from '../components/TaskForm';
import { STATUS_LABELS, TaskItem } from '../components/TaskItem';
import { api, type Task, type TaskInput, type TaskStatus } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Filter = TaskStatus | 'all';

const TODAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function TasksPage() {
  useDocumentTitle('Tasks');
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  /** Key (filter + search) of the last request that settled; null until the first one does. */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  /** True while a refetch started from an event handler (after a mutation, Retry) is in flight. */
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const listRef = useRef<HTMLElement>(null);

  const queryKey = `${filter}\n${appliedSearch}`;
  const initialLoading = settledKey === null;
  // Derived rather than stored, so the effect below never sets state synchronously.
  const refreshing = settledKey !== queryKey || refetching;

  /** Runs one list request; state is only touched in the continuation, and only if still the latest. */
  const fetchTasks = useCallback((status: Filter, query: string) => {
    // Only the most recent request may update state, so a slow response for an old
    // filter/search can never overwrite the results of a newer one.
    const requestId = ++latestRequest.current;
    return api
      .listTasks({ status: status === 'all' ? undefined : status, search: query || undefined })
      .then(
        (res) => {
          if (requestId !== latestRequest.current) return;
          setTasks(res.tasks);
          setError(null);
        },
        (err: unknown) => {
          if (requestId !== latestRequest.current) return;
          setError(err instanceof Error ? err.message : 'Could not load tasks');
        },
      )
      .finally(() => {
        if (requestId !== latestRequest.current) return;
        setSettledKey(`${status}\n${query}`);
        setRefetching(false);
      });
  }, []);

  useEffect(() => {
    void fetchTasks(filter, appliedSearch);
  }, [fetchTasks, filter, appliedSearch]);

  const load = () => {
    setRefetching(true);
    return fetchTasks(filter, appliedSearch);
  };

  const createTask = async (input: TaskInput) => {
    await api.createTask(input);
    await load();
  };

  const updateTask = async (id: number, input: Parameters<typeof api.updateTask>[1]) => {
    await api.updateTask(id, input);
    await load();
  };

  const deleteTask = async (id: number) => {
    await api.deleteTask(id);
    // The focused "Confirm delete" button is about to disappear; keep focus in the list.
    listRef.current?.focus();
    await load();
  };

  const filtersActive = filter !== 'all' || appliedSearch !== '';

  return (
    <>
      <div>
        <span className="tb-eyebrow">{TODAY_FORMAT.format(new Date())}</span>
        <h1 className="tb-title">{user?.name}&rsquo;s tasks</h1>
      </div>

      <div className="tb-tasks-layout">
        <TaskForm onSubmit={createTask} />

        <section
          className="tb-list"
          aria-label="Task list"
          aria-busy={refreshing}
          ref={listRef}
          tabIndex={-1}
        >
          <div className="tb-toolbar">
            <div role="group" aria-label="Filter by status" className="tb-segmented">
              {(['all', 'todo', 'in_progress', 'done'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === 'all' ? 'All' : STATUS_LABELS[value]}
                </button>
              ))}
            </div>
            <form
              role="search"
              className="tb-search"
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedSearch(search.trim());
              }}
            >
              <input
                className="tb-input"
                type="search"
                aria-label="Search tasks"
                placeholder="Search tasks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="tb-btn tb-btn--secondary">
                Search
              </button>
            </form>
          </div>

          <p className="updating" aria-live="polite">
            {refreshing && !initialLoading ? 'Updating…' : ''}
          </p>

          {error && (
            <div className="load-error">
              {/* Keep the alert's text to the message alone; the retry control sits beside it. */}
              <div role="alert" className="tb-alert">
                {error}
              </div>
              <button
                type="button"
                className="tb-btn tb-btn--secondary"
                onClick={() => void load()}
              >
                Retry
              </button>
            </div>
          )}

          {initialLoading ? (
            <p className="tb-muted">Loading tasks…</p>
          ) : (
            <>
              {!error && (
                <p className="tb-count" data-testid="task-count">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </p>
              )}
              {/* Don't claim "no tasks" when we simply failed to fetch them. */}
              {tasks.length === 0 && !error && (
                <div className="tb-empty" data-testid="empty-state">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="7" y="5" width="26" height="30" rx="3" />
                    <path d="M13 14h14M13 20h14M13 26h8" />
                  </svg>
                  {filtersActive ? (
                    <strong>No tasks match your filters.</strong>
                  ) : (
                    <span>
                      <strong>No tasks yet.</strong> Add your first task above.
                    </span>
                  )}
                </div>
              )}
              {tasks.length > 0 && (
                <ul className="tb-ledger">
                  {tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onStatusChange={(status) => updateTask(task.id, { status })}
                      onRename={(title) => updateTask(task.id, { title })}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
