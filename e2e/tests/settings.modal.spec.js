const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login } = require('./helpers');

test('settings modal opens and closes', async ({ page }) => {
  const passphrase = 'password123';
  const username = `settings_${uniqueSuffix()}`;

  await login(page, username, passphrase);

  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden();
});
