import { test, expect } from '@playwright/test';

test.describe('Team List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/teams');
  });

  test('shows seeded teams', async ({ page }) => {
    await expect(page.getByText('Platform')).toBeVisible();
    await expect(page.getByText('Backend')).toBeVisible();
    await expect(page.getByText('Frontend')).toBeVisible();
    await expect(page.getByText('DevOps')).toBeVisible();
  });

  test('click team navigates to detail', async ({ page }) => {
    await page.getByRole('row').filter({ hasText: 'Platform' }).first().click();
    await expect(page).toHaveURL(/\/teams\/Platform/);
  });
});

test.describe('Team Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/teams/Platform');
  });

  test('shows team name in heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Platform');
  });

  test('shows developers section', async ({ page }) => {
    await expect(page.getByText('Developers')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('breadcrumb links back to teams', async ({ page }) => {
    await page.getByRole('link', { name: 'Teams' }).click();
    await expect(page).toHaveURL(/\/teams$/);
  });
});
