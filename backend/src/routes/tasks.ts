import { Router } from 'express';
import { currentUser } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import type { TaskRepository } from '../repositories/tasks.js';
import {
  createTaskSchema,
  idParamSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '../schemas.js';

export function tasksRouter(tasks: TaskRepository): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const query = listTasksQuerySchema.parse(req.query);
    res.json({ tasks: tasks.list(currentUser(req).id, query) });
  });

  router.post('/', (req, res) => {
    const input = createTaskSchema.parse(req.body);
    res.status(201).json({ task: tasks.create(currentUser(req).id, input) });
  });

  router.get('/:id', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const task = tasks.find(currentUser(req).id, id);
    if (!task) throw notFound('Task not found');
    res.json({ task });
  });

  router.patch('/:id', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateTaskSchema.parse(req.body);
    const task = tasks.update(currentUser(req).id, id, input);
    if (!task) throw notFound('Task not found');
    res.json({ task });
  });

  router.delete('/:id', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    if (!tasks.delete(currentUser(req).id, id)) throw notFound('Task not found');
    res.status(204).end();
  });

  return router;
}
