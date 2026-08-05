const { test, expect } = require("@playwright/test");
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
		const el = document.getElementById(id) || document.getElementById(id + "Playlist");
		if (el) el.click();
	}, elementId);
}

test.describe("Playlist Page Download Tests", () => {
	let electronApp;
	let page;

	test.beforeEach(async () => {
		const res = await launchApp();
		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await page.click("#playlistWin");
	});

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test("playlist video download produces correct yt-dlp command", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLink");
		await waitForPlaylistOptions(page);

		await page.selectOption("#select", "1080");
		await page.selectOption("#videoTypeSelect", "mp4");

		await clearExecutedCommands(page);

		await triggerClick(page, "download");

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThan(0);

		const downloadCmd = commands[commands.length - 1];
		expect(downloadCmd).toContain("--yes-playlist");
		expect(downloadCmd).toContain("-f");
		expect(downloadCmd).toContain("-o");
		expect(downloadCmd).toContain("--ffmpeg-location");
		expect(downloadCmd.join(" ")).toContain("PL123456789");
	});

	test("playlist audio download produces correct yt-dlp command", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLink");
		await waitForPlaylistOptions(page);

		await triggerClick(page, "audioTogglePlaylist");

		await page.selectOption("#audioSelect", "mp3");
		await page.selectOption("#audioQualitySelect", "0");

		await clearExecutedCommands(page);

		await page.click("#audioDownloadPlaylist");

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThan(0);

		const downloadCmd = commands[commands.length - 1];
		expect(downloadCmd).toContain("--yes-playlist");
		expect(downloadCmd).toContain("-x");
		expect(downloadCmd).toContain("--audio-format");
		expect(downloadCmd).toContain("mp3");
		expect(downloadCmd).toContain("--audio-quality");
		expect(downloadCmd).toContain("0");
		expect(downloadCmd).toContain("--embed-thumbnail");
		expect(downloadCmd.join(" ")).toContain("PL123456789");
	});

	test("download thumbnails produces correct yt-dlp command", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLink");
		await waitForPlaylistOptions(page);

		await triggerClick(page, "advancedToggle");
		await clearExecutedCommands(page);

		await triggerClick(page, "downloadThumbnails");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("--write-thumbnail"));
		});

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThan(0);

		const downloadCmd = commands[commands.length - 1];
		expect(downloadCmd).toContain("--write-thumbnail");
		expect(downloadCmd).toContain("--convert-thumbnails");
		expect(downloadCmd).toContain("png");
		expect(downloadCmd).toContain("--skip-download");
		expect(downloadCmd.join(" ")).toContain("PL123456789");
	});

	test("save video links produces correct yt-dlp command", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLink");
		await waitForPlaylistOptions(page);

		await triggerClick(page, "advancedToggle");
		await clearExecutedCommands(page);

		await triggerClick(page, "saveLinks");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("webpage_url"));
		});

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThan(0);

		const downloadCmd = commands[commands.length - 1];
		expect(downloadCmd).toContain("--skip-download");
		expect(downloadCmd).toContain("--print-to-file");
		expect(downloadCmd).toContain("webpage_url");
		expect(downloadCmd.join(" ")).toContain("PL123456789");
	});

	test("playlist index range selection is passed to -I argument", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLink");
		await waitForPlaylistOptions(page);

		await triggerClick(page, "advancedToggle");

		await page.fill("#playlistIndex", "2");
		await page.fill("#playlistEnd", "10");

		await clearExecutedCommands(page);

		await triggerClick(page, "download");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands[commands.length - 1];

		expect(downloadCmd).toContain("-I");
		const rangeIndex = downloadCmd.indexOf("-I");
		expect(downloadCmd[rangeIndex + 1]).toBe("2:10");
	});

	test("download subtitles option adds subtitle flags to command", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLink");
		await waitForPlaylistOptions(page);

		await triggerClick(page, "advancedToggle");

		await page.check("#subCheckedPlaylist");

		await clearExecutedCommands(page);

		await triggerClick(page, "download");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands[commands.length - 1];

		expect(downloadCmd).toContain("--write-subs");
		expect(downloadCmd).toContain("--sub-format");
		expect(downloadCmd).toContain("srt/best");
		expect(downloadCmd).toContain("--convert-subs");
		expect(downloadCmd).toContain("srt");
		expect(downloadCmd).toContain("--sub-langs");
		expect(downloadCmd).toContain("all");
	});
});
