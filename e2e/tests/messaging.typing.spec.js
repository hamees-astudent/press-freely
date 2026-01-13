const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login, getMyId, addContactById, openChatWithUser, exchangeKeys } = require('./helpers');

test('typing indicator appears and clears', async ({ browser }) => {
  const passphrase = 'password123';
  const unique = uniqueSuffix();
  const usernameA = `type_a_${unique}`;
  const usernameB = `type_b_${unique}`;

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

  await exchangeKeys(pageA, pageB);

  await pageA.getByPlaceholder('Type a message...').type('typing...');

  const typingIndicator = pageB.locator('.typing-indicator');
  await expect(typingIndicator).toBeVisible();

  // Wait for the inactivity timeout (2s) + a small buffer
  await pageA.waitForTimeout(2500);
  await expect(typingIndicator).toBeHidden({ timeout: 5000 });

  await ctxA.close();
  await ctxB.close();
});
