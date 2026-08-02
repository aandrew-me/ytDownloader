const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test.describe('Invalid URL Error Handling Test', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../main.js')],
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Pasting an invalid URL displays error message in UI', async () => {
    const invalidUrl = 'not-a-valid-url-12345';

    await window.evaluate((url) => {
      window.electronAPI.clipboard.writeText(url);
    }, invalidUrl);

    await window.click('#pasteUrl');
    await window.waitForSelector('#incorrectMsg', { state: 'visible', timeout: 10000 });

    const errorMsg = await window.$eval('#incorrectMsg', el => el.textContent);
    expect(errorMsg.length).toBeGreaterThan(0);
  });
});
