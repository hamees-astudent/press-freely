const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login } = require('./helpers');

test('logout returns to login screen', async ({ page }) => {
  const passphrase = 'password123';
  const username = `logout_${uniqueSuffix()}`;

  await login(page, username, passphrase);

  await page.getByRole('button', { name: 'Logout from application' }).click();
  await expect(page.getByText('Chat Login')).toBeVisible();
});
