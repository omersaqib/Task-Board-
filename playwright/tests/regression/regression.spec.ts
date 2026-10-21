import { expect, test } from '../../fixtures/index.ts';
import type { AuthResult, ErrorEnvelope, Task } from '../../utils/api-client.ts';
import { isoDate, uniqueEmail, uniqueId, uniqueTitle, VALID_PASSWORD } from '../../utils/data.ts';

test.describe('regression', { tag: '@regression' }, () => {
  // REG-001: Email lookup was case-sensitive, so users who typed "User@Example.com" at login
  // could not sign in with the lower-cased address they registered with.
  test('REG-001 login email is case-insensitive', async ({ api, testUser }) => {
    const res = await api.login({
      email: testUser.email.toUpperCase(),
      password: testUser.password,
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as AuthResult;
    expect(body.user.id).toBe(testUser.user.id);
    expect(body.user.email).toBe(testUser.email.toLowerCase());
  });

  // REG-002: Whitespace-only titles slipped past validation and produced tasks that looked blank.
  test('REG-002 whitespace-only title is rejected on create and update', async ({
    api,
    testUser,
  }) => {
    const create = await api.createTask(testUser.token, { title: '   \t ' });
    expect(create.status()).toBe(400);
    const { error } = (await create.json()) as ErrorEnvelope;
    expect(error.details?.[0]?.field).toBe('title');

    const task = await api.seedTask(testUser.token, { title: uniqueTitle() });
    const update = await api.updateTask(testUser.token, task.id, { title: '   ' });
    expect(update.status()).toBe(400);
    const after = (await (await api.getTask(testUser.token, task.id)).json()) as { task: Task };
    expect(after.task.title).toBe(task.title);
  });

  // REG-003: A partial PATCH overwrote omitted fields with defaults (wiping description, priority, dueDate).
  test('REG-003 PATCH of one field leaves the others untouched', async ({ api, testUser }) => {
    const due = isoDate(5);
    const task = await api.seedTask(testUser.token, {
      title: uniqueTitle(),
      description: 'keep me',
      priority: 'high',
      dueDate: due,
    });
    const res = await api.updateTask(testUser.token, task.id, { status: 'done' });
    expect(res.status()).toBe(200);
    const { task: updated } = (await res.json()) as { task: Task };
    expect(updated).toMatchObject({
      title: task.title,
      description: 'keep me',
      priority: 'high',
      dueDate: due,
      status: 'done',
    });
  });

  // REG-004: Search interpolated user input into a SQL LIKE pattern, so "%" and "_" acted as wildcards.
  test('REG-004 search treats % and _ literally', async ({ api, testUser }) => {
    const tag = uniqueId();
    const percent = await api.seedTask(testUser.token, { title: `${tag} 100% done` });
    const underscore = await api.seedTask(testUser.token, { title: `${tag} snake_case` });
    await api.seedTask(testUser.token, { title: `${tag} plain text` });
    await api.seedTask(testUser.token, { title: `${tag} snakeXcase` });

    const ids = async (q: string) => {
      const res = await api.listTasks(testUser.token, { search: q });
      expect(res.status()).toBe(200);
      return ((await res.json()) as { tasks: Task[] }).tasks.map((t) => t.id);
    };
    expect(await ids('%')).toEqual([percent.id]);
    expect(await ids('snake_case')).toEqual([underscore.id]);
    expect(await ids('_')).toEqual([underscore.id]);
  });

  // REG-005: IDOR - task ids are sequential, so one user could read/modify/delete another's tasks by id.
  test('REG-005 a user cannot access another user task by id', async ({ api, testUser: owner }) => {
    const attacker = (await (
      await api.register({ name: 'Eve', email: uniqueEmail(), password: VALID_PASSWORD })
    ).json()) as AuthResult;
    const task = await api.seedTask(owner.token, { title: uniqueTitle('Private') });

    expect((await api.getTask(attacker.token, task.id)).status()).toBe(404);
    expect((await api.updateTask(attacker.token, task.id, { status: 'done' })).status()).toBe(404);
    expect((await api.deleteTask(attacker.token, task.id)).status()).toBe(404);

    const intact = (await (await api.getTask(owner.token, task.id)).json()) as { task: Task };
    expect(intact.task).toEqual(task);
    const attackerList = (await (await api.listTasks(attacker.token)).json()) as { tasks: Task[] };
    expect(attackerList.tasks.map((t) => t.id)).not.toContain(task.id);
  });

  // REG-006: Duplicate-email check was case-sensitive, allowing two accounts for "A@x.com" and "a@x.com".
  test('REG-006 registering the same email in a different case is a 409', async ({
    api,
    testUser,
  }) => {
    const res = await api.register({
      name: 'Clone',
      email: testUser.email.toUpperCase(),
      password: VALID_PASSWORD,
    });
    expect(res.status()).toBe(409);
    expect(((await res.json()) as ErrorEnvelope).error.code).toBe('CONFLICT');
  });
});
