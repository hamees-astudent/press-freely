const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login, getMyId, addContactById, openChatWithUser, exchangeKeys } = require('./helpers');

test('two users exchange keys and send an encrypted message', async ({ browser }) => {
  const passphrase = 'password123';
  const unique = uniqueSuffix();
  const usernameA = `alice_${unique}`;
  const usernameB = `bob_${unique}`;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await login(pageA, usernameA, passphrase);
  await login(pageB, usernameB, passphrase);

  const idA = await getMyId(pageA);
  const idB = await getMyId(pageB);
  expect(idA).toBeTruthy();
  expect(idB).toBeTruthy();

  // Add each other as contacts
  await addContactById(pageA, idB);
  await addContactById(pageB, idA);

  // Open chat threads
  await openChatWithUser(pageA, usernameB);
  await openChatWithUser(pageB, usernameA);

  await exchangeKeys(pageA, pageB);

  // Send message A -> B
  const message = `hello from e2e ${unique}`;
  await pageA.getByPlaceholder('Type a message...').fill(message);
  await pageA.getByRole('button', { name: 'Send message' }).click();

  // B should see the plaintext after decrypt
  await expect(pageB.getByText(message)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
