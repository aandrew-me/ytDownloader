const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test.describe('Preferences UI & Persistence Test', () => {
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

  test('Opens preferences window, updates max active downloads, and verifies persistence', async () => {
    const preferencesWindowPromise = electronApp.waitForEvent('window');

    await window.click('#menuIcon');
    await window.waitForSelector('#menu', { state: 'visible' });
    await window.click('#preferenceWin');

    const preferencesWindow = await preferencesWindowPromise;
    await preferencesWindow.waitForLoadState('domcontentloaded');
    await preferencesWindow.waitForSelector('#maxDownloads', { state: 'visible', timeout: 15000 });

    await preferencesWindow.fill('#maxDownloads', '8');
    await preferencesWindow.dispatchEvent('#maxDownloads', 'change');

    const savedMaxDownloads = await preferencesWindow.evaluate(() => {
      return localStorage.getItem('maxActiveDownloads');
    });

    expect(savedMaxDownloads).toBe('8');
  });
});
