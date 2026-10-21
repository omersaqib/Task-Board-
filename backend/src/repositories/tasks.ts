import type { SQLInputValue } from 'node:sqlite';
import type { Database } from '../db.js';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '../schemas.js';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const COLUMN_BY_FIELD = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  dueDate: 'due_date',
} as const satisfies Record<keyof UpdateTaskInput, string>;

/** All queries are scoped by user id so one user can never read or modify another's tasks. */
export function createTaskRepository(db: Database) {
  return {
    list(userId: number, query: ListTasksQuery): Task[] {
      const clauses = ['user_id = ?'];
      const params: SQLInputValue[] = [userId];
      if (query.status) {
        clauses.push('status = ?');
        params.push(query.status);
      }
      if (query.search) {
        clauses.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
        const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(pattern, pattern);
      }
      const rows = db
        .prepare(`SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY id DESC`)
        .all(...params) as unknown as TaskRow[];
      return rows.map(toTask);
    },

    find(userId: number, id: number): Task | undefined {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId) as
        TaskRow | undefined;
      return row && toTask(row);
    },

    create(userId: number, input: CreateTaskInput): Task {
      const row = db
        .prepare(
          `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        )
        .get(
          userId,
          input.title,
          input.description,
          input.status,
          input.priority,
          input.dueDate,
        ) as unknown as TaskRow;
      return toTask(row);
    },

    /** Applies only the provided fields; omitted fields are left untouched. */
    update(userId: number, id: number, input: UpdateTaskInput): Task | undefined {
      const entries = (Object.keys(COLUMN_BY_FIELD) as (keyof UpdateTaskInput)[])
        .filter((field) => input[field] !== undefined)
        .map((field) => [COLUMN_BY_FIELD[field], input[field] ?? null] as const);

      const assignments = entries.map(([column]) => `${column} = ?`);
      assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

      const row = db
        .prepare(
          `UPDATE tasks SET ${assignments.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`,
        )
        .get(...entries.map(([, value]) => value), id, userId) as TaskRow | undefined;
      return row && toTask(row);
    },

    delete(userId: number, id: number): boolean {
      const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
      return result.changes > 0;
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
