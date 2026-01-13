const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { uniqueSuffix, login, getMyId, addContactById, openChatWithUser, exchangeKeys } = require('./helpers');

test('settings: export keys downloads a backup, import restores keys', async ({ browser }) => {
  const passphrase = 'password123';
  const unique = uniqueSuffix();
  const usernameA = `keys_a_${unique}`;
  const usernameB = `keys_b_${unique}`;

  const ctxA = await browser.newContext({ acceptDownloads: true });
  const ctxB = await browser.newContext({ acceptDownloads: true });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // Auto-accept alerts (import triggers an alert + reload)
  pageA.on('dialog', (d) => d.accept());

  await login(pageA, usernameA, passphrase);
  await login(pageB, usernameB, passphrase);

  const idA = await getMyId(pageA);
  const idB = await getMyId(pageB);

  await addContactById(pageA, idB);
  await addContactById(pageB, idA);

  await openChatWithUser(pageA, usernameB);
  await openChatWithUser(pageB, usernameA);

  await exchangeKeys(pageA, pageB);

  // Open settings and export
  await pageA.getByRole('button', { name: 'Open settings' }).click();
  await expect(pageA.getByRole('heading', { name: 'Settings' })).toBeVisible();

  const downloadPromise = pageA.waitForEvent('download');
  await pageA.getByRole('button', { name: 'Export encryption keys' }).click();
  const download = await downloadPromise;

  const outDir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(outDir, { recursive: true });
  const keysPath = path.join(outDir, `keys_${unique}.json`);
  await download.saveAs(keysPath);

  // Clear local keys then import back
  await pageA.evaluate(() => {
    localStorage.removeItem('contactKeys');
  });

  // Still in settings modal
  await pageA.locator('input[aria-label="Choose key file"]').setInputFiles(keysPath);

  // Import triggers reload
  await pageA.waitForLoadState('domcontentloaded');

  const count = await pageA.evaluate(() => {
    const raw = localStorage.getItem('contactKeys') || '{}';
    return Object.keys(JSON.parse(raw)).length;
  });

  expect(count).toBeGreaterThan(0);

  await ctxA.close();
  await ctxB.close();
});
