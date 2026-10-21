import { expect, test } from '../../fixtures/index.ts';
import type { AuthResult, ErrorEnvelope, Task } from '../../utils/api-client.ts';
import { uniqueEmail, uniqueTitle, VALID_PASSWORD } from '../../utils/data.ts';

test.describe('cross-user isolation', () => {
  test('user B gets 404 on user A task for GET, PATCH and DELETE, and A is unaffected', async ({
    api,
    testUser: userA,
  }) => {
    const b = (await (
      await api.register({ name: 'B', email: uniqueEmail(), password: VALID_PASSWORD })
    ).json()) as AuthResult;
    const task = await api.seedTask(userA.token, { title: uniqueTitle('Secret') });

    for (const res of [
      await api.getTask(b.token, task.id),
      await api.updateTask(b.token, task.id, { title: 'hacked' }),
      await api.deleteTask(b.token, task.id),
    ]) {
      expect(res.status()).toBe(404);
      expect(((await res.json()) as ErrorEnvelope).error.code).toBe('NOT_FOUND');
    }

    const listB = (await (await api.listTasks(b.token)).json()) as { tasks: Task[] };
    expect(listB.tasks).toEqual([]);

    const still = await api.getTask(userA.token, task.id);
    expect(still.status()).toBe(200);
    expect(((await still.json()) as { task: Task }).task).toEqual(task);
  });
});
