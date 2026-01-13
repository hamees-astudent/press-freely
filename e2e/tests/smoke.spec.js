const { test, expect } = require('@playwright/test');

test('loads login screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Chat Login')).toBeVisible();
  await expect(page.getByPlaceholder('Username')).toBeVisible();
  await expect(page.getByPlaceholder('Secret Passphrase')).toBeVisible();
});
