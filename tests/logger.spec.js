import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import os from "os";

// Logger is CommonJS module
const Logger = require("../src/logger.js");

test.describe("Logger system unit tests", () => {
	let testLogsDir;
	let logger;

	test.beforeEach(() => {
		testLogsDir = path.join(os.tmpdir(), "ytdlp_logger_test_" + Date.now() + "_" + Math.random().toString(36).slice(2));
		logger = new Logger({ logsDir: testLogsDir, maxEntries: 10 });
	});

	test.afterEach(() => {
		try {
			if (fs.existsSync(testLogsDir)) {
				fs.rmSync(testLogsDir, { recursive: true, force: true });
			}
		} catch (_) {}
	});

	test("initializes directory and creates session log header", () => {
		expect(fs.existsSync(testLogsDir)).toBe(true);
		expect(fs.existsSync(logger.sessionLogPath)).toBe(true);
		const content = fs.readFileSync(logger.sessionLogPath, "utf8");
		expect(content).toContain("=== ytDownloader Session Log Started");
	});

	test("rotates session.log to session.prev.log on reinitialization", () => {
		logger.addLog({ level: "INFO", message: "First session log" });
		expect(fs.existsSync(logger.sessionLogPath)).toBe(true);

		// Second session initialization with same dir
		const secondLogger = new Logger({ logsDir: testLogsDir });
		expect(fs.existsSync(secondLogger.prevLogPath)).toBe(true);
		expect(fs.existsSync(secondLogger.sessionLogPath)).toBe(true);

		const prevContent = fs.readFileSync(secondLogger.prevLogPath, "utf8");
		expect(prevContent).toContain("First session log");
	});

	test("adds logs and maintains in-memory ring buffer limit", () => {
		for (let i = 1; i <= 15; i++) {
			logger.addLog({
				level: "INFO",
				message: `Message #${i}`,
			});
		}

		const logs = logger.getLogs();
		expect(logs.length).toBe(10); // maxEntries is 10
		expect(logs[0].message).toBe("Message #15"); // Newest first
		expect(logs[9].message).toBe("Message #6");
	});

	test("filters logs by category level and search term", () => {
		logger.addLog({ level: "COMMAND", message: "Running yt-dlp", command: "yt-dlp https://youtu.be/abc", url: "https://youtu.be/abc" });
		logger.addLog({ level: "SUCCESS", message: "Downloaded: Cool Video", url: "https://youtu.be/abc" });
		logger.addLog({ level: "ERROR", message: "Download failed: Network error", details: "Timeout 500ms" });
		logger.addLog({ level: "INFO", message: "Fetched metadata for video" });

		expect(logger.getLogs({ level: "COMMAND" }).length).toBe(1);
		expect(logger.getLogs({ level: "SUCCESS" }).length).toBe(1);
		expect(logger.getLogs({ level: "ERROR" }).length).toBe(1);
		expect(logger.getLogs({ level: "INFO" }).length).toBe(1);

		// Search filtering
		const searchByUrl = logger.getLogs({ searchTerm: "youtu.be" });
		expect(searchByUrl.length).toBe(2);

		const searchByDetail = logger.getLogs({ searchTerm: "Timeout" });
		expect(searchByDetail.length).toBe(1);
		expect(searchByDetail[0].level).toBe("ERROR");
	});

	test("sanitizes and truncates oversized strings", () => {
		const longDetails = "A".repeat(5000);
		const longCommand = "B".repeat(3000);
		const entry = logger.addLog({
			level: "DETAIL",
			message: "Verbose trace",
			details: longDetails,
			command: longCommand,
		});

		expect(entry.details.length).toBeLessThan(3500);
		expect(entry.details).toContain("[truncated]");
		expect(entry.command.length).toBeLessThan(2500);
		expect(entry.command).toContain("[truncated]");
	});

	test("exports logs as plain text and JSON", async () => {
		logger.addLog({ level: "INFO", message: "Export test message" });

		const txt = await logger.exportLogs("txt");
		expect(txt).toContain("[INFO] Export test message");

		const jsonStr = await logger.exportLogs("json");
		const json = JSON.parse(jsonStr);
		expect(Array.isArray(json)).toBe(true);
		expect(json[0].message).toBe("Export test message");
	});

	test("clears logs correctly", async () => {
		logger.addLog({ level: "INFO", message: "To be cleared" });
		expect(logger.getLogs().length).toBe(1);

		await logger.clearLogs();
		expect(logger.getLogs().length).toBe(0);

		const content = fs.readFileSync(logger.sessionLogPath, "utf8");
		expect(content).toContain("=== ytDownloader Session Log Cleared");
	});
});
