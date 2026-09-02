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
		await triggerClick(page, "playlistWin");
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

		await triggerClick(page, "pasteLink");
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

		await triggerClick(page, "pasteLink");
		await waitForPlaylistOptions(page);

		await triggerClick(page, "audioTogglePlaylist");

		await page.selectOption("#audioSelect", "mp3");
		await page.selectOption("#audioQualitySelect", "0");

		await clearExecutedCommands(page);

		await triggerClick(page, "audioDownloadPlaylist");

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

		await triggerClick(page, "pasteLink");
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

		await triggerClick(page, "pasteLink");
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

		await triggerClick(page, "pasteLink");
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

		await triggerClick(page, "pasteLink");
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

	test("selective playlist mode fetches entries and downloads selected video with custom format", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PLselective123";

		// Switch to Selective mode
		await page.click("#playlistModeSelectiveBtn");
		await expect(page.locator("#playlistSelectiveSection")).toBeVisible();

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLinkSelective");

		// Wait for entries list to render
		await page.waitForSelector("#selectiveContent", { state: "visible" });
		await expect(page.locator("#selectivePlaylistTitle")).toHaveText("Test Mock Playlist");
		await expect(page.locator(".selective-item-card")).toHaveCount(2);

		// Customize first video to 720p mp4
		await page.selectOption("#sel_res_0", "720");
		await page.selectOption("#sel_fmt_0", "mp4");

		// Customize second video to audio mp3
		await page.selectOption("#sel_type_1", "audio");
		await page.selectOption("#sel_aext_1", "mp3");

		await clearExecutedCommands(page);

		// Click download selected
		await page.click("#selectiveDownloadBtn");

		// Wait for commands to execute
		await page.waitForFunction(() => {
			const cmds = window.__executedCommands;
			return cmds && cmds.length >= 2;
		});

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThanOrEqual(2);

		// Find the video and audio commands
		const vid1Cmd = commands.find((cmd) => cmd.some((arg) => typeof arg === "string" && arg.includes("vid1")));
		const vid2Cmd = commands.find((cmd) => cmd.some((arg) => typeof arg === "string" && arg.includes("vid2")));

		expect(vid1Cmd).toBeDefined();
		expect(vid1Cmd).toContain("--no-playlist");
		expect(vid1Cmd.join(" ")).toContain("height<=720");
		expect(vid1Cmd).toContain("mp4");
		expect(vid1Cmd.join(" ")).toContain("Test Mock Playlist");
		expect(vid1Cmd.join(" ")).not.toContain("\\NA\\");
		expect(vid1Cmd.join(" ")).not.toContain("/NA/");

		expect(vid2Cmd).toBeDefined();
		expect(vid2Cmd).toContain("-x");
		expect(vid2Cmd).toContain("--audio-format");
		expect(vid2Cmd).toContain("mp3");
		expect(vid2Cmd.join(" ")).toContain("Test Mock Playlist");
	});

	test("selective playlist mode select all / deselect all toggles all items", async () => {
		const playlistUrl = "https://www.youtube.com/playlist?list=PLselective123";

		await page.click("#playlistModeSelectiveBtn");
		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);

		await page.click("#pasteLinkSelective");
		await page.waitForSelector("#selectiveContent", { state: "visible" });

		// Click Deselect All
		await page.click("#selectiveSelectAllBtn");
		await expect(page.locator("#selectiveDownloadCount")).toHaveText("0");
		expect(await page.locator(".selective-cb:checked").count()).toBe(0);

		// Click Select All
		await page.click("#selectiveSelectAllBtn");
		await expect(page.locator("#selectiveDownloadCount")).toHaveText("2");
		expect(await page.locator(".selective-cb:checked").count()).toBe(2);
	});

	test("playlist page shows empty state card initially and hides when options/content are shown", async () => {
		// Verify batch mode empty state is visible initially
		const emptyBatch = page.locator("#emptyStatePlaylist");
		await expect(emptyBatch).toBeVisible();
		await expect(emptyBatch.locator("h3")).toHaveText("No downloads yet");

		// Paste link in batch mode -> empty state hides
		const playlistUrl = "https://www.youtube.com/playlist?list=PL123456789";
		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, playlistUrl);
		await page.click("#pasteLink");
		await waitForPlaylistOptions(page);
		await expect(emptyBatch).toBeHidden();

		// Switch to Selective mode -> selective empty state is visible initially
		await page.click("#playlistModeSelectiveBtn");
		const emptySelective = page.locator("#emptyStatePlaylistSelective");
		await expect(emptySelective).toBeVisible();
		await expect(emptySelective.locator("h3")).toHaveText("No downloads yet");

		// Fetch selective playlist -> selective empty state hides
		await page.click("#pasteLinkSelective");
		await page.waitForSelector("#selectiveContent", { state: "visible" });
		await expect(emptySelective).toBeHidden();
	});
});


