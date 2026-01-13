const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login, getMyId, addContactById, openChatWithUser, exchangeKeys } = require('./helpers');

// Calls use WebRTC + fake mic; still can be flaky on some machines.
// Enable/disable via env var if needed.
const shouldRun = process.env.E2E_CALL !== '0';

test.describe('voice calls', () => {
  test.skip(!shouldRun, 'Set E2E_CALL=1 to run call tests');

  test('user can call and end call', async ({ browser }) => {
    const passphrase = 'password123';
    const unique = uniqueSuffix();
    const usernameA = `call_a_${unique}`;
    const usernameB = `call_b_${unique}`;

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

    // Call button only visible once keys are exchanged.
    await pageA.getByRole('button', { name: /call/i }).click();

    // B receives incoming call notification.
    await expect(pageB.getByText(/Incoming Call from/i)).toBeVisible({ timeout: 15000 });
    await pageB.getByRole('button', { name: 'Answer' }).click();

    // A shows active call bar.
    await expect(pageA.getByText(/On Call with/i)).toBeVisible({ timeout: 20000 });

    // End call from A (both pages reload).
    await pageA.getByRole('button', { name: 'End call' }).click();

    await pageA.waitForLoadState('domcontentloaded');
    await pageB.waitForLoadState('domcontentloaded');

    // Should still be logged in.
    await expect(pageA.getByText('Press Freely')).toBeVisible();
    await expect(pageB.getByText('Press Freely')).toBeVisible();

    await ctxA.close();
    await ctxB.close();
  });
});
