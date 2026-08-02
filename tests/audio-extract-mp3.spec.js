const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { getAudioCodec } = require('./helpers/media-inspector');

const TEST_URL = 'https://youtu.be/_Sl8diqCAFw';
const DOWNLOAD_DIR = path.join(__dirname, '../test-downloads-mp3');

test.describe('Audio Extraction - MP3 Test', () => {
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

  test('Extracts audio in MP3 format and verifies .mp3 extension & codec with ffprobe', async () => {
    await window.evaluate((url) => {
      window.electronAPI.clipboard.writeText(url);
    }, TEST_URL);

    await window.click('#pasteUrl');
    await window.waitForSelector('#hidden', { state: 'visible', timeout: 30000 });

    await window.evaluate(() => {
      const select = document.getElementById('extractSelection');
      if (select) {
        select.value = 'mp3';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const selectedFormat = await window.$eval('#extractSelection', el => el.value);
    expect(selectedFormat).toBe('mp3');

    await window.evaluate(() => {
      if (window.ytDownloader && window.ytDownloader.handleDownloadRequest) {
        window.ytDownloader.handleDownloadRequest('extract');
      } else {
        document.getElementById('extractBtn')?.click();
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

    const mp3File = files.find(f => f.toLowerCase().endsWith('.mp3'));
    expect(mp3File).toBeTruthy();

    const downloadedFilePath = path.join(DOWNLOAD_DIR, mp3File);
    const codec = getAudioCodec(downloadedFilePath);
    expect(codec).toBe('mp3');
  });
});
