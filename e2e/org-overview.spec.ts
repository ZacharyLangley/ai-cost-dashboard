import { test, expect } from '@playwright/test';

test.describe('Org Overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('stat card labels visible', async ({ page }) => {
    await expect(page.getByText('Monthly Cost')).toBeVisible();
    await expect(page.getByText('Active Devs')).toBeVisible();
    await expect(page.getByText('Idle Seats')).toBeVisible();
    await expect(page.getByText('Unmapped Users')).toBeVisible();
  });

  test('top developers section visible', async ({ page }) => {
    await expect(page.getByText('Top 10 Developers by Cost')).toBeVisible();
  });

  test('top teams section visible', async ({ page }) => {
    await expect(page.getByText('Top 10 Teams by Cost')).toBeVisible();
  });

  test('click team row navigates to team detail', async ({ page }) => {
    // "Top 10 Teams" table is the second table on the page; filter to rows with team link
    await expect(page.getByText('Top 10 Teams by Cost')).toBeVisible();
    const teamRows = page.getByRole('row').filter({ hasText: 'Platform' });
    // Click the last matching row (teams table is below devs table)
    await teamRows.last().click();
    await expect(page).toHaveURL(/\/teams\/Platform/);
    await expect(page.locator('h1')).toContainText('Platform');
  });
});
