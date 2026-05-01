import { test, expect } from '@playwright/test';

test.describe('Admin Pipelines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/pipelines');
  });

  test('pipelines table shows github row', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'github' })).toBeVisible();
  });

  test('run now button present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Run Now' }).first()).toBeVisible();
  });

  test('API drift log section present', async ({ page }) => {
    await expect(page.getByText('API Drift Log')).toBeVisible();
  });
});

test.describe('Admin Identity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/identity');
  });

  test('import CSV section visible', async ({ page }) => {
    await expect(page.getByText('Import CSV')).toBeVisible();
  });

  test('file input present', async ({ page }) => {
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test('import button present and disabled without file', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Import' });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('sample CSV details link works', async ({ page }) => {
    await page.getByText('Show sample CSV').click();
    await expect(page.locator('pre')).toBeVisible();
  });
});
