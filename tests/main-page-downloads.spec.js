const { test, expect } = require("@playwright/test");
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

test.describe("Main Page Download Tests", () => {
	let electronApp;
	let page;

	test.beforeEach(async () => {
		const res = await launchApp();
		electronApp = res.app;
		page = res.page;
	});

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test("paste button is disabled during link fetching and re-enabled after completion", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		// Trigger click and check disabled state immediately (synchronously set on click)
		const isDisabledDuringFetch = await page.evaluate(() => {
			const btn = document.getElementById("pasteUrl");
			btn.click();
			return btn.disabled;
		});
		expect(isDisabledDuringFetch).toBe(true);

		// Wait for info panel to be populated and displayed
		await waitForInfoPanel(page);

		// Verify paste button is re-enabled after fetching completes
		const isEnabledAfter = await page.$eval("#pasteUrl", (btn) => !btn.disabled);
		expect(isEnabledAfter).toBe(true);
	});

	test("video download produces correct yt-dlp command", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		// Click paste button to fetch info
		await page.click("#pasteUrl");

		// Wait for info panel to be populated and displayed
		await waitForInfoPanel(page);

		await clearExecutedCommands(page);

		// Trigger "Download Video"
		await triggerClick(page, "videoDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		// Retrieve executed commands
		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThan(0);

		// Find download command (the one with -f flag)
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));
		expect(downloadCmd).toBeDefined();

		// Verify command structure
		expect(downloadCmd).toContain("-f");
		expect(downloadCmd).toContain("-P");
		expect(downloadCmd).toContain("-o");
		expect(downloadCmd).toContain("--ffmpeg-location");
		expect(downloadCmd.join(" ")).toContain("dQw4w9WgXcQ");
	});

	test("audio download produces correct yt-dlp command", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		// Fetch info
		await page.click("#pasteUrl");
		await waitForInfoPanel(page);

		// Switch to Audio tab
		await page.evaluate(() => document.getElementById("audioToggle").click());

		// Ensure audio format select has a valid option value selected
		await page.evaluate(() => {
			const sel = document.getElementById("audioFormatSelect");
			if (!sel.value && sel.options.length > 0) {
				sel.value = sel.options[0].value;
			}
		});

		await clearExecutedCommands(page);

		// Trigger "Download Audio"
		await triggerClick(page, "audioDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThan(0);

		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));
		expect(downloadCmd).toBeDefined();

		// Verify audio download args
		expect(downloadCmd).toContain("-f");
		expect(downloadCmd).toContain("-P");
		expect(downloadCmd).toContain("-o");
		expect(downloadCmd.join(" ")).toContain("dQw4w9WgXcQ");
	});

	test("audio extract produces correct yt-dlp command", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		// Fetch info
		await page.click("#pasteUrl");
		await waitForInfoPanel(page);

		// Switch to Audio tab
		await page.evaluate(() => document.getElementById("audioToggle").click());

		// Select extract format mp3
		await page.evaluate(() => {
			const sel = document.getElementById("extractSelection");
			if (sel) {
				sel.value = "mp3";
				sel.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});

		await clearExecutedCommands(page);

		// Trigger Extract
		await triggerClick(page, "extractBtn");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-x"));
		});

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThan(0);

		const extractCmd = commands.find((cmd) => cmd.includes("-x"));
		expect(extractCmd).toBeDefined();

		// Verify extract args
		expect(extractCmd).toContain("-x");
		expect(extractCmd).toContain("--audio-format");
		expect(extractCmd).toContain("mp3");
		expect(extractCmd).toContain("--audio-quality");
		expect(extractCmd).toContain("--embed-thumbnail");
		expect(extractCmd).toContain("-P");
		expect(extractCmd).toContain("-o");
		expect(extractCmd.some((arg) => arg.includes("dQw4w9WgXcQ"))).toBe(true);
	});

	test("info panel hides immediately when download starts", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		await page.click("#pasteUrl");
		await waitForInfoPanel(page);

		await triggerClick(page, "videoDownload");

		const isHiddenImmediately = await page.evaluate(() => {
			const el = document.getElementById("hidden");
			return el && el.style.display === "none";
		});

		expect(isHiddenImmediately).toBe(true);
	});

	test("video download with output format selected remuxes into chosen container", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		await page.click("#pasteUrl");
		await waitForInfoPanel(page);

		// Open "More options"
		await triggerClick(page, "advancedVideoToggle");

		// Select mp4 output format
		await page.selectOption("#homeOutputFormatSelect", "mp4");

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));
		expect(downloadCmd).toBeDefined();
		expect(downloadCmd).toContain("--recode-video");
		expect(downloadCmd).toContain("mp4");
		expect(downloadCmd).toContain("--merge-output-format");
	});

	test("video download with mkv output format passes mkv container args", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		await page.click("#pasteUrl");
		await waitForInfoPanel(page);

		// Open "More options"
		await triggerClick(page, "advancedVideoToggle");

		// Select mkv output format
		await page.selectOption("#homeOutputFormatSelect", "mkv");

		await clearExecutedCommands(page);

		await triggerClick(page, "videoDownload");

		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return cmds.some((cmd) => cmd.includes("-f"));
		});

		const commands = await getExecutedCommands(page);
		const downloadCmd = commands.find((cmd) => cmd.includes("-f"));
		expect(downloadCmd).toBeDefined();
		expect(downloadCmd).toContain("--recode-video");
		expect(downloadCmd).toContain("mkv");
		expect(downloadCmd).toContain("--merge-output-format");
	});

	test("download automatically retries with live URL if --load-info-json fails", async () => {
		const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

		await page.evaluate((url) => {
			window.electronAPI.clipboard.writeText(url);
		}, testUrl);

		await page.click("#pasteUrl");
		await waitForInfoPanel(page);

		// Arm mock to fail on the first --load-info-json execution
		await page.evaluate(() => {
			window.__mockFailOnLoadInfoJson = true;
		});

		await clearExecutedCommands(page);

		// Trigger download
		await triggerClick(page, "videoDownload");

		// Wait until second command (fallback with direct URL) is executed
		await page.waitForFunction(() => {
			const cmds = window.__executedCommands || [];
			return (
				cmds.length >= 2 &&
				cmds.some(
					(cmd) =>
						cmd.includes("-f") &&
						cmd.includes("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
				)
			);
		});

		const commands = await getExecutedCommands(page);
		expect(commands.length).toBeGreaterThanOrEqual(2);

		const firstCmd = commands[0];
		const retryCmd = commands[commands.length - 1];

		// First command should have used --load-info-json
		expect(firstCmd).toContain("--load-info-json");

		// Retry command should have fallen back to URL without --load-info-json
		expect(retryCmd).not.toContain("--load-info-json");
		expect(retryCmd).toContain(testUrl);
	});
});
