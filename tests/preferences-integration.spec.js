const { test, expect } = require("@playwright/test");
const os = require("os");
const fs = require("fs");
const path = require("path");
const {
	launchApp,
	getExecutedCommands,
	clearExecutedCommands,
} = require("./helpers/electronApp");

async function waitForInfoPanel(page) {
	await page.waitForFunction(() => {
		const el = document.getElementById("hidden");
		return el && el.style.display === "inline-block";
	});
}

async function triggerClick(page, elementId) {
	await page.evaluate((id) => {
		const el = document.getElementById(id);
		if (el) el.click();
	}, elementId);
}

test.describe("Preferences Integration Tests", () => {
	let electronApp;
	let page;

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test("download location preference is used in yt-dlp command", async () => {
		const customPath = path.join(os.tmpdir(), "ytDownloaderTestLocation");
		if (!fs.existsSync(customPath)) {
			fs.mkdirSync(customPath, { recursive: true });
		}

		const res = await launchApp({
			downloadPath: customPath,
		});
		electronApp = res.app;
		page = res.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		const pathIndex = downloadCmd.indexOf("-P");
		expect(pathIndex).not.toBe(-1);
		expect(downloadCmd[pathIndex + 1]).toBe(customPath);
	});

	test("preferred video quality and codec select matching format", async () => {
		const res = await launchApp({
			preferredVideoQuality: "720",
			preferredVideoCodec: "avc1",
		});
		electronApp = res.app;
		page = res.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		// Verify selected format in video dropdown is 720p (format_id 22)
		const selectedFormat = await page.$eval(
			"#videoFormatSelect",
			(el) => el.value,
		);
		expect(selectedFormat).toContain("22");
	});

	test("showMoreFormats preference toggles format options in UI", async () => {
		// Test showMoreFormats = false
		const resHide = await launchApp({
			showMoreFormats: "false",
		});
		electronApp = resHide.app;
		page = resHide.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		const formatValuesHide = await page.$$eval(
			"#videoFormatSelect option",
			(opts) => opts.map((o) => o.value),
		);
		// WebM format "248" should be excluded when showMoreFormats is false
		const containsWebmHide = formatValuesHide.some((val) => val.includes("248"));
		expect(containsWebmHide).toBe(false);

		// Switch showMoreFormats = true via localStorage and reload page
		await page.evaluate(() => localStorage.setItem("showMoreFormats", "true"));
		await page.reload();

		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);
		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		const formatValuesShow = await page.$$eval(
			"#videoFormatSelect option",
			(opts) => opts.map((o) => o.value),
		);
		// WebM format "248" should be included when showMoreFormats is true
		const containsWebmShow = formatValuesShow.some((val) => val.includes("248"));
		expect(containsWebmShow).toBe(true);
	});

	test("output templates preference is reflected in -o argument", async () => {
		const customVidTemplate = "%(title)s_custom_video.%(ext)s";
		const customAudTemplate = "%(title)s_custom_audio.%(ext)s";

		const res = await launchApp({
			filenameTemplateVideo: customVidTemplate,
			filenameTemplateAudio: customAudTemplate,
		});
		electronApp = res.app;
		page = res.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		// Video Download
		await triggerClick(page, "videoDownload");

		let commands = await getExecutedCommands(page);
		let downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		let oIndex = downloadCmd.indexOf("-o");
		expect(oIndex).not.toBe(-1);
		expect(downloadCmd[oIndex + 1]).toBe(customVidTemplate);

		// Audio Download
		await triggerClick(page, "audioToggle");
		await page.evaluate(() => {
			const sel = document.getElementById("audioFormatSelect");
			if (!sel.value && sel.options.length > 0) {
				sel.value = sel.options[0].value;
			}
		});

		await clearExecutedCommands(page);
		await triggerClick(page, "audioDownload");

		commands = await getExecutedCommands(page);
		downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		oIndex = downloadCmd.indexOf("-o");
		expect(oIndex).not.toBe(-1);
		expect(downloadCmd[oIndex + 1]).toBe(customAudTemplate);
	});

	test("cookies preference is included in yt-dlp command", async () => {
		// Test browser cookies
		const resBrowser = await launchApp({
			cookieSource: "browser",
			browser: "firefox",
		});
		electronApp = resBrowser.app;
		page = resBrowser.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		expect(downloadCmd).toContain("--cookies-from-browser");
		expect(downloadCmd).toContain("firefox");
	});

	test("proxy preference is included in yt-dlp command", async () => {
		const proxyUrl = "http://127.0.0.1:8080";
		const res = await launchApp({
			proxy: proxyUrl,
		});
		electronApp = res.app;
		page = res.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		expect(downloadCmd).toContain("--proxy");
		expect(downloadCmd).toContain(proxyUrl);
	});

	test("proxy is not included when proxyMode is none", async () => {
		const proxyUrl = "http://127.0.0.1:8080";
		const res = await launchApp({
			proxyMode: "none",
			proxy: proxyUrl,
		});
		electronApp = res.app;
		page = res.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		expect(downloadCmd).not.toContain("--proxy");
	});

	test("custom yt-dlp options preference is appended to yt-dlp command", async () => {
		const customArgs = "--no-check-certificates --geo-bypass";
		const res = await launchApp({
			customYtDlpArgs: customArgs,
		});
		electronApp = res.app;
		page = res.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		expect(downloadCmd).toContain("--no-check-certificates");
		expect(downloadCmd).toContain("--geo-bypass");
	});

	test("concurrent fragments preference is included in yt-dlp command when > 1", async () => {
		const res = await launchApp({
			concurrentFragments: "4",
		});
		electronApp = res.app;
		page = res.page;

		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await page.evaluate((url) => window.electronAPI.clipboard.writeText(url), testUrl);

		await triggerClick(page, "pasteUrl");
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));

		expect(downloadCmd).toBeDefined();
		expect(downloadCmd).toContain("--concurrent-fragments");
		const fragIdx = downloadCmd.indexOf("--concurrent-fragments");
		expect(downloadCmd[fragIdx + 1]).toBe("4");
	});
});
