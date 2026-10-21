import { expect, test } from '../../fixtures/index.ts';
import { TasksPage } from '../../pages/tasks-page.ts';

test.describe('regression layout', { tag: '@regression' }, () => {
  test.use({ viewport: { width: 375, height: 812 } });

  // REG-007: Defect found in integration testing (real): the "Task ... added." status message
  // (p.form-status[role=status]) did not wrap an unbroken long title, so on a 375px viewport the
  // page scrolled horizontally. Guards the layout bug class "long unbroken strings overflow".
  test('REG-007 long unbroken task title does not cause horizontal scroll on mobile', async ({
    authenticatedPage: page,
  }) => {
    const tasks = new TasksPage(page);
    const title = 'A'.repeat(110);
    await tasks.goto();
    await tasks.addTask({ title });

    await expect(page.locator('p.form-status[role="status"]')).toContainText('added');

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(
      scrollWidth,
      `horizontal overflow: document scrollWidth ${scrollWidth} vs innerWidth ${innerWidth}`,
    ).toBeLessThanOrEqual(innerWidth);
  });
});
