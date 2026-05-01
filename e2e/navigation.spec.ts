import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', heading: 'Org Overview' },
  { path: '/teams', heading: 'Teams' },
  { path: '/developers', heading: 'Developers' },
  { path: '/products/github', heading: 'GitHub Copilot' },
  { path: '/products/m365', heading: 'Microsoft 365 Copilot' },
  { path: '/admin/identity', heading: 'Identity Management' },
  { path: '/admin/pipelines', heading: 'Pipelines' },
];

for (const { path, heading } of routes) {
  test(`${path} renders "${heading}"`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1')).toContainText(heading);
  });
}

test('nav links navigate correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Teams' }).click();
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.locator('h1')).toContainText('Teams');

  await page.getByRole('link', { name: 'Developers' }).click();
  await expect(page).toHaveURL(/\/developers$/);
});
