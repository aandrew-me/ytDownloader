const { test, expect } = require("@playwright/test");
const os = require("os");
const fs = require("fs");
const path = require("path");
const {
	launchApp,
	getExecutedCommands,
	clearExecutedCommands,
} = require("./helpers/electronApp");

async function waitForPlaylistOptions(page) {
	await page.waitForFunction(() => {
		const options = document.getElementById("options");
		return options && options.style.display === "block";
	});
}

async function triggerClick(page, elementId) {
	await page.evaluate((id) => {
		const el = document.getElementById(id);
		if (el) el.click();
	}, elementId);
}

test.describe("Playlist Preferences Integration Tests", () => {
	let electronApp;
	let page;

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test("download location and output templates are reflected in playlist -o argument", async () => {
		const customDir = path.join(os.tmpdir(), "ytPlaylistTestDir");
		if (!fs.existsSync(customDir)) {
			fs.mkdirSync(customDir, { recursive: true });
		}

		const customFolder = "%(playlist_title)s_folder";
		const customFile = "%(playlist_index)s_%(title)s_custom.%(ext)s";

		const res = await launchApp({
			downloadPath: customDir,
			foldernameFormat: customFolder,
			filenameFormat: customFile,
		});

		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await triggerClick(page, "playlistWin");

		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await triggerClick(page, "pasteLink");
		await waitForPlaylistOptions(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "download");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands[commands.length - 1];

		expect(downloadCmd).toBeDefined();
		const oIndex = downloadCmd.indexOf("-o");
		expect(oIndex).not.toBe(-1);

		const expectedOutputPath = path.join(customDir, customFolder, customFile);
		expect(downloadCmd[oIndex + 1]).toBe(expectedOutputPath);
	});

	test("default preferred video quality in playlist is 1080", async () => {
		const res = await launchApp();

		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await triggerClick(page, "playlistWin");

		const selectedVideo = await page.$eval("#select", (el) => el.value);
		expect(selectedVideo).toBe("1080");
	});

	test("preferred video and audio quality defaults are selected in UI dropdowns", async () => {
		const res = await launchApp({
			preferredVideoQuality: "720",
			preferredAudioQuality: "flac",
		});

		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await triggerClick(page, "playlistWin");

		const selectedVideo = await page.$eval("#select", (el) => el.value);
		expect(selectedVideo).toBe("720");

		const selectedAudio = await page.$eval("#audioSelect", (el) => el.value);
		expect(selectedAudio).toBe("flac");
	});

	test("cookies preference is included in playlist yt-dlp command", async () => {
		const res = await launchApp({
			cookieSource: "browser",
			browser: "chrome",
		});

		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await triggerClick(page, "playlistWin");

		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), playlistUrl);

		await triggerClick(page, "pasteLink");
		await waitForPlaylistOptions(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "download");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands[commands.length - 1];

		expect(downloadCmd).toContain("--cookies-from-browser");
		expect(downloadCmd).toContain("chrome");
	});

	test("proxy preference is included in playlist yt-dlp command", async () => {
		const proxyUrl = "http://127.0.0.1:8080";
		const res = await launchApp({
			proxy: proxyUrl,
		});

		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await triggerClick(page, "playlistWin");

		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), playlistUrl);

		await triggerClick(page, "pasteLink");
		await waitForPlaylistOptions(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "download");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands[commands.length - 1];

		expect(downloadCmd).toContain("--proxy");
		expect(downloadCmd).toContain(proxyUrl);
	});

	test("concurrent fragments preference is included in playlist yt-dlp command when > 1", async () => {
		const res = await launchApp({
			concurrentFragments: "5",
		});

		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await triggerClick(page, "playlistWin");

		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), playlistUrl);

		await triggerClick(page, "pasteLink");
		await waitForPlaylistOptions(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "download");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands[commands.length - 1];

		expect(downloadCmd).toContain("--concurrent-fragments");
		const fragIdx = downloadCmd.indexOf("--concurrent-fragments");
		expect(downloadCmd[fragIdx + 1]).toBe("5");
	});
});
