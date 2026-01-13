const { test, expect } = require('@playwright/test');
const { uniqueSuffix, login, getMyId, addContactById, openChatWithUser, exchangeKeys } = require('./helpers');
const path = require('path');

const smallPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X9l2sAAAAASUVORK5CYII=',
  'base64'
);

test('upload image and decrypt to view', async ({ browser }) => {
  const passphrase = 'password123';
  const unique = uniqueSuffix();
  const usernameA = `img_a_${unique}`;
  const usernameB = `img_b_${unique}`;

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

  // Upload an image from A (exercise the "Attach file" button)
  const [chooser] = await Promise.all([
    pageA.waitForEvent('filechooser'),
    pageA.getByRole('button', { name: 'Attach file' }).click()
  ]);
  await chooser.setFiles({
    name: 'tiny.png',
    mimeType: 'image/png',
    buffer: smallPngBuffer
  });

  // B should receive a "View Image" decrypt button, then show the image
  await expect(pageB.getByRole('button', { name: /view image/i })).toBeVisible();
  await pageB.getByRole('button', { name: /view image/i }).click();
  await expect(pageB.locator('img.media-image')).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test('upload generic file and decrypt triggers download', async ({ browser }, testInfo) => {
  const passphrase = 'password123';
  const unique = uniqueSuffix();
  const usernameA = `file_a_${unique}`;
  const usernameB = `file_b_${unique}`;

  const ctxA = await browser.newContext({ acceptDownloads: true });
  const ctxB = await browser.newContext({ acceptDownloads: true });
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

  // Upload a small text file from A (will be sent as type "file")
  await pageA.setInputFiles('#file-upload', {
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello from e2e')
  });

  // B should be able to decrypt/download
  const downloadPromise = pageB.waitForEvent('download');
  await pageB.locator('button.decrypt-file-btn').first().click();
  const download = await downloadPromise;
  await download.saveAs(testInfo.outputPath(path.join('downloads', 'downloaded_hello.txt')));

  await ctxA.close();
  await ctxB.close();
});

test('upload audio file and decrypt shows audio player', async ({ browser }) => {
  const passphrase = 'password123';
  const unique = uniqueSuffix();
  const usernameA = `aud_a_${unique}`;
  const usernameB = `aud_b_${unique}`;

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

  // Upload a tiny audio blob from A (not necessarily playable, but enough to exercise decrypt path)
  await pageA.setInputFiles('#file-upload', {
    name: 'tiny.webm',
    mimeType: 'audio/webm',
    buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00])
  });

  await expect(pageB.getByRole('button', { name: /play audio/i })).toBeVisible();
  await pageB.getByRole('button', { name: /play audio/i }).click();
  await expect(pageB.locator('audio.audio-player')).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
