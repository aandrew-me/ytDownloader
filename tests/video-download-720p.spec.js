const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { getVideoHeight } = require('./helpers/media-inspector');

const TEST_URL = 'https://youtu.be/_Sl8diqCAFw';
const DOWNLOAD_DIR = path.join(__dirname, '../test-downloads-720p');

test.describe('Video Download - 720p Resolution Test', () => {
  let electronApp;
  let window;

  test.beforeAll(() => {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
  });

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../main.js')],
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.evaluate(({ dir }) => {
      localStorage.setItem('downloadPath', dir);
      if (window.ytDownloader && window.ytDownloader.state) {
        window.ytDownloader.state.downloadDir = dir;
      }
    }, { dir: DOWNLOAD_DIR });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Downloads video in 720p and verifies height === 720 with ffprobe', async () => {
    await window.evaluate((url) => {
      window.electronAPI.clipboard.writeText(url);
    }, TEST_URL);

    await window.click('#pasteUrl');
    await window.waitForSelector('#hidden', { state: 'visible', timeout: 30000 });

    await window.waitForFunction(() => {
      const sel = document.getElementById('videoFormatSelect');
      return sel && sel.options && sel.options.length > 0;
    }, { timeout: 30000 });

    const select720pOption = await window.evaluate(() => {
      const select = document.getElementById('videoFormatSelect');
      const options = Array.from(select.options);
      const option720 = options.find(opt => opt.text.includes('720') || opt.value.includes('720'));
      if (option720) {
        select.value = option720.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return option720.text;
      }
      if (options.length > 0) {
        select.value = options[0].value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return options[0].text;
      }
      return null;
    });

    expect(select720pOption).toBeTruthy();

    await window.evaluate(() => {
      if (window.ytDownloader && window.ytDownloader.handleDownloadRequest) {
        window.ytDownloader.handleDownloadRequest('video');
      } else {
        document.getElementById('videoDownload')?.click();
      }
    });

    await expect.poll(() => {
      if (!fs.existsSync(DOWNLOAD_DIR)) return 0;
      const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => !f.endsWith('.txt') && !f.endsWith('.part'));
      return files.length;
    }, { timeout: 90000, intervals: [1000] }).toBeGreaterThan(0);

    await window.waitForTimeout(2000);

    const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => !f.endsWith('.txt') && !f.endsWith('.part'));
    expect(files.length).toBeGreaterThan(0);

    const downloadedFile = path.join(DOWNLOAD_DIR, files[0]);
    const height = getVideoHeight(downloadedFile);
    expect(height).toBe(720);
  });
});
