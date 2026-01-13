const { test, expect } = require('@playwright/test');

test('login shows validation error for short username', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill('ab');
  await page.getByPlaceholder('Secret Passphrase').fill('password123');
  await page.getByRole('button', { name: /enter chat/i }).click();

  await expect(page.getByText(/username must be between 3 and 30/i)).toBeVisible();
});

test('login shows validation error for short passphrase', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill('valid_user');
  await page.getByPlaceholder('Secret Passphrase').fill('short');
  await page.getByRole('button', { name: /enter chat/i }).click();

  await expect(page.getByText(/passphrase must be at least 8/i)).toBeVisible();
});
