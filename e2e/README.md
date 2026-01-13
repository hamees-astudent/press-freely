# E2E Tests (Playwright)

This folder is a **separate project** dedicated to end-to-end (browser) testing of the Press Freely chat application.

## What it tests

- App loads and shows the login screen
- Two users can:
  - login/register
  - add each other by ID
  - exchange encryption keys
  - send an encrypted message and have it decrypted on the other side

Additional coverage includes:

- Login form validation
- Contact add edge cases (self / not found)
- Key exchange reject flow
- Typing indicator
- Settings modal + export/import key backup
- Upload + decrypt flows (image/audio/file)
- Logout

Optional (may be flaky depending on environment):

- WebRTC voice call (set `E2E_CALL=0` to skip)
- Audio recording (set `E2E_RECORD=1` to enable)

## Prerequisites

- Node.js 18+
- npm
- MongoDB running locally on `127.0.0.1:27017`
  - The test server uses database: `press-freely-e2e`

## Install

```bash
cd e2e
npm install
npm run install:browsers
```

## Run

```bash
cd e2e
npm test
```

Environment toggles:

- `E2E_CALL=0` disables the call test
- `E2E_RECORD=1` enables the recording test

What happens:

- Playwright starts the existing backend (`../server/server.js`) and frontend (`../client` CRA dev server)
- Then it runs tests against `http://localhost:3000`

## Notes / Troubleshooting

- If MongoDB is not running, the backend will fail to start.
- If you already have the app running, Playwright will reuse the existing server (unless `CI=1`).
- View the HTML report:

```bash
cd e2e
npm run report
```
