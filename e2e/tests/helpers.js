const { expect } = require('@playwright/test');

const uniqueSuffix = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const login = async (page, username, passphrase) => {
  await page.goto('/');
  await expect(page.getByText('Chat Login')).toBeVisible();
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Secret Passphrase').fill(passphrase);
  await page.getByRole('button', { name: /enter chat/i }).click();
  await expect(page.getByText('Press Freely')).toBeVisible();
};

const getMyId = async (page) => {
  const id = await page.locator('.my-id-display strong').textContent();
  return (id || '').trim();
};

const addContactById = async (page, contactId) => {
  await page.getByLabel('Enter contact ID').fill(contactId);
  await page.getByRole('button', { name: 'Search contact' }).click();
  await expect(page.getByText(/Found:/)).toBeVisible();
  await page.getByRole('button', { name: /^Add$/ }).click();
};

const openChatWithUser = async (page, username) => {
  await page.getByLabel(new RegExp(`^Chat with ${username}`)).click();
  await expect(page.getByText(new RegExp(`To:\\s*${username}`))).toBeVisible();
};

const exchangeKeys = async (pageInitiator, pageReceiver) => {
  await pageInitiator.getByRole('button', { name: /exchange keys/i }).click();

  await expect(pageReceiver.getByRole('heading', { name: 'Key Exchange Request' })).toBeVisible();
  await pageReceiver.getByRole('button', { name: 'Accept key exchange request' }).click();

  // Messaging input should appear once keys are established.
  await expect(pageInitiator.getByPlaceholder('Type a message...')).toBeVisible();
  await expect(pageReceiver.getByPlaceholder('Type a message...')).toBeVisible();
};

module.exports = {
  uniqueSuffix,
  login,
  getMyId,
  addContactById,
  openChatWithUser,
  exchangeKeys
};
