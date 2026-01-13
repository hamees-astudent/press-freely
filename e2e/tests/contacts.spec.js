const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login, getMyId } = require('./helpers');

test('add contact: cannot add yourself', async ({ page }) => {
  const passphrase = 'password123';
  const username = `self_${uniqueSuffix()}`;

  await login(page, username, passphrase);
  const myId = await getMyId(page);

  await page.getByLabel('Enter contact ID').fill(myId);
  await page.getByRole('button', { name: 'Search contact' }).click();

  await expect(page.getByText('You cannot add yourself.')).toBeVisible();
});

test('add contact: shows user not found for invalid id', async ({ page }) => {
  const passphrase = 'password123';
  const username = `nf_${uniqueSuffix()}`;

  await login(page, username, passphrase);

  await page.getByLabel('Enter contact ID').fill('000000000000');
  await page.getByRole('button', { name: 'Search contact' }).click();

  await expect(page.getByText('User not found.')).toBeVisible();
});
