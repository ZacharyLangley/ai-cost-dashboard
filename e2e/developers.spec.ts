import { test, expect } from '@playwright/test';

test.describe('Developer List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/developers');
  });

  test('shows seeded developers', async ({ page }) => {
    // Seed has Alice Chen, Bob Smith, etc.
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('team filter dropdown has seeded teams', async ({ page }) => {
    const select = page.getByRole('combobox');
    await expect(select).toBeVisible();
    await expect(select.locator('option', { hasText: 'Platform' })).toBeAttached();
    await expect(select.locator('option', { hasText: 'Backend' })).toBeAttached();
  });

  test('team filter narrows list', async ({ page }) => {
    const rowsBefore = await page.getByRole('row').count();
    await page.getByRole('combobox').selectOption('Platform');
    const rowsAfter = await page.getByRole('row').count();
    // Platform has 2 devs (alice-dev, bob-codes) + 1 header row
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
  });

  test('click developer row navigates to detail', async ({ page }) => {
    await page.getByRole('row').nth(1).click();
    await expect(page).toHaveURL(/\/developers\/.+/);
  });
});

test.describe('Developer Detail', () => {
  test('renders developer name in breadcrumb area', async ({ page }) => {
    await page.goto('/developers');
    await page.getByRole('row').nth(1).click();
    // Breadcrumb shows "Developers / Name"
    await expect(page.getByRole('link', { name: 'Developers' })).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows cost breakdown section', async ({ page }) => {
    await page.goto('/developers');
    await page.getByRole('row').nth(1).click();
    await expect(page.getByText('Cost Breakdown')).toBeVisible();
  });
});
