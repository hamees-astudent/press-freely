const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login, getMyId, addContactById, openChatWithUser, exchangeKeys } = require('./helpers');

// Recording depends on MediaRecorder support; keep optional.
const shouldRun = process.env.E2E_RECORD === '1';

test.describe('audio recording', () => {
  test.skip(!shouldRun, 'Enable with E2E_RECORD=1');

  test('mic button starts and stops recording', async ({ browser }) => {
    const passphrase = 'password123';
    const unique = uniqueSuffix();
    const usernameA = `rec_a_${unique}`;
    const usernameB = `rec_b_${unique}`;

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

    const mic = pageA.getByRole('button', { name: /start audio recording/i });
    await mic.click();

    // After starting, aria-label changes.
    await expect(pageA.getByRole('button', { name: /stop audio recording/i })).toBeVisible();

    await pageA.getByRole('button', { name: /stop audio recording/i }).click();

    // A should send an audio message; B should get Play Audio button.
    await expect(pageB.getByRole('button', { name: /play audio/i })).toBeVisible({ timeout: 30000 });

    await ctxA.close();
    await ctxB.close();
  });
});
