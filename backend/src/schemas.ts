import { z } from 'zod';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: 'Email must be a valid email address' })
      .max(254, { error: 'Email must be a valid email address' }),
  );

export const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, { error: 'Name is required' })
    .max(80, { error: 'Name must be at most 80 characters' }),
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(8, { error: 'Password must be at least 8 characters' })
    .max(128, { error: 'Password must be at most 128 characters' })
    .regex(/[A-Za-z]/, { error: 'Password must contain a letter' })
    .regex(/\d/, { error: 'Password must contain a number' }),
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, { error: 'Password is required' }),
});

const title = z
  .string({ error: 'Title is required' })
  .trim()
  .min(1, { error: 'Title is required' })
  .max(120, { error: 'Title must be at most 120 characters' });

const description = z
  .string()
  .trim()
  .max(2000, { error: 'Description must be at most 2000 characters' });

const dueDate = z.iso.date({ error: 'Due date must be in YYYY-MM-DD format' }).nullable();

export const createTaskSchema = z.object({
  title,
  description: description.default(''),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  dueDate: dueDate.optional().transform((value) => value ?? null),
});

export const updateTaskSchema = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: dueDate.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: 'At least one field must be provided',
  });

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
});

export const idParamSchema = z.object({
  id: z
    .string({ error: 'Invalid id' })
    .regex(/^[1-9]\d{0,14}$/, { error: 'Invalid id' })
    .transform(Number),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
