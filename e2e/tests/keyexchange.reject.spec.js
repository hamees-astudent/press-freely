const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login, getMyId, addContactById, openChatWithUser } = require('./helpers');

test('key exchange can be rejected and messaging stays locked', async ({ browser }) => {
  const passphrase = 'password123';
  const unique = uniqueSuffix();
  const usernameA = `rej_a_${unique}`;
  const usernameB = `rej_b_${unique}`;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await login(pageA, usernameA, passphrase);
  await login(pageB, usernameB, passphrase);

  const idA = await getMyId(pageA);
  const idB = await getMyId(pageB);

  await addContactById(pageA, idB);
  await addContactById(pageB, idA);

  await openChatWithUser(pageA, usernameB);
  await openChatWithUser(pageB, usernameA);

  // Initiate from A
  await pageA.getByRole('button', { name: /exchange keys/i }).click();

  // Reject on B
  await expect(pageB.getByRole('heading', { name: 'Key Exchange Request' })).toBeVisible();
  await pageB.getByRole('button', { name: 'Reject key exchange request' }).click();

  // A should show status banner about decline
  await expect(pageA.getByText(/declined key exchange/i)).toBeVisible();

  // Messaging UI remains locked
  await expect(pageA.getByText(/exchange encryption keys to start messaging/i)).toBeVisible();
  await expect(pageB.getByText(/exchange encryption keys to start messaging/i)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
