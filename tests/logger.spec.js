const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const os = require("os");
const logger = require("../src/logger");
const { launchApp } = require("./helpers/electronApp");

test.describe("Logger Unit & Integration Tests", () => {
	let tempDir;

	test.beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdl-logger-test-"));
	});

	test.afterEach(() => {
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("should initialize logger and create log directory", () => {
		logger.init(tempDir);
		const logDir = logger.getLogDir();
		expect(fs.existsSync(logDir)).toBe(true);

		const logFile = path.join(logDir, "app.log");
		expect(fs.existsSync(logFile)).toBe(true);
	});

	test("should write log entries with correct formatting", () => {
		logger.init(tempDir);
		logger.info("Test info message", "TestProcess");
		logger.error("Test error message", "TestProcess");

		const logFile = path.join(logger.getLogDir(), "app.log");
		const content = fs.readFileSync(logFile, "utf8");

		expect(content).toContain("[INFO] [TestProcess] Test info message");
		expect(content).toContain("[ERROR] [TestProcess] Test error message");
	});

	test("should rotate log files when log file size exceeds limit", () => {
		logger.init(tempDir);
		const logDir = logger.getLogDir();
		const logFile = path.join(logDir, "app.log");

		// Write payload > 2 MB (5 * 500 KB = 2.5 MB)
		const largePayload = "X".repeat(500 * 1024);
		for (let i = 0; i < 5; i++) {
			logger.info(largePayload, "Test");
		}

		logger.info("Message after rotation", "Test");

		const backupFile = path.join(logDir, "app.1.log");
		expect(fs.existsSync(backupFile)).toBe(true);

		const currentContent = fs.readFileSync(logFile, "utf8");
		expect(currentContent).toContain("Message after rotation");
	});

	test("should return formatted combined log export", () => {
		logger.init(tempDir);
		logger.info("Hello World Log Entry", "Main");

		const sysInfo = {
			version: "3.22.0",
			ytDlpPath: "/usr/bin/yt-dlp",
			ffmpegPath: "/usr/bin/ffmpeg",
		};

		const exportText = logger.getCombinedLogs(sysInfo);

		expect(exportText).toContain("=== YTDownloader System Diagnostic Info ===");
		expect(exportText).toContain("App Version: 3.22.0");
		expect(exportText).toContain("yt-dlp Path: /usr/bin/yt-dlp");
		expect(exportText).toContain("=== Application Logs ===");
		expect(exportText).toContain("Hello World Log Entry");
	});

	test("should capture renderer console.log statements into combined logs via IPC", async () => {
		const { app: electronApp, page } = await launchApp();
		try {
			const marker = "RENDERER_TEST_MARKER_" + Date.now();
			await page.evaluate((m) => console.log("Test log from UI:", m), marker);

			await page.waitForTimeout(500);

			const combinedLogs = await page.evaluate(async () => {
				return await window.electronAPI.logs.getCombinedLogs();
			});

			expect(combinedLogs).toContain("Test log from UI: " + marker);
		} finally {
			if (electronApp) await electronApp.close();
		}
	});
});
