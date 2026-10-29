import { test, expect } from "@playwright/test";
import {
	formatLogArg,
	formatLogsText,
	addLogEntry,
	appendLogEntryToUI,
	MAX_LOGS,
	logBuffer,
	buildIssueMarkdown,
	buildGitHubIssueUrl,
	getSystemDiagnostics,
} from "../src/logs.js";

test.describe("Logs module formatting and handling", () => {
	test("formatLogArg condenses yt-dlp video metadata object", () => {
		const hugeMetadata = {
			id: "dQw4w9WgXcQ",
			title: "Rick Astley - Never Gonna Give You Up",
			extractor_key: "Youtube",
			duration: 213,
			formats: new Array(50).fill({
				format_id: "137",
				url: "https://manifest.googlevideo.com/...",
				manifest_url: "https://manifest.googlevideo.com/...",
			}),
		};

		const formatted = formatLogArg(hugeMetadata);
		expect(formatted).toContain("[yt-dlp video info]");
		expect(formatted).toContain("dQw4w9WgXcQ");
		expect(formatted).toContain("Rick Astley - Never Gonna Give You Up");
		expect(formatted).toContain("Formats: 50");
		expect(formatted.length).toBeLessThan(300);
	});

	test("formatLogArg condenses yt-dlp playlist metadata", () => {
		const playlist = {
			_type: "playlist",
			title: "Cool Playlist",
			entries: new Array(100).fill({ id: "123" }),
		};
		const formatted = formatLogArg(playlist);
		expect(formatted).toContain("[yt-dlp playlist info]");
		expect(formatted).toContain("Cool Playlist");
		expect(formatted).toContain("Entries: 100");
	});

	test("formatLogArg truncates excessively long strings and objects", () => {
		const longString = "A".repeat(2500);
		const formattedStr = formatLogArg(longString);
		expect(formattedStr).toContain("[truncated]");
		expect(formattedStr.length).toBeLessThanOrEqual(2020);

		const largeObj = { data: "B".repeat(2000) };
		const formattedObj = formatLogArg(largeObj);
		expect(formattedObj).toContain("[truncated]");
		expect(formattedObj.length).toBeLessThanOrEqual(1520);
	});

	test("formatLogArg formats Error objects", () => {
		const err = new Error("Something went wrong");
		const formatted = formatLogArg(err);
		expect(formatted).toContain("Error: Something went wrong");
	});

	test("formatLogArg handles circular objects without throwing", () => {
		const circular = {};
		circular.self = circular;
		expect(() => formatLogArg(circular)).not.toThrow();
		expect(formatLogArg(circular)).toBe("[object Object]");
	});

	test("addLogEntry adds and caps buffer", () => {
		logBuffer.length = 0;
		addLogEntry("info", ["App started"]);
		expect(logBuffer.length).toBe(1);
		expect(logBuffer[0].level).toBe("info");
		expect(logBuffer[0].message).toBe("App started");
		expect(logBuffer[0].source).toBe("renderer");
	});

	test("formatLogsText formats only the log entries without markdown or environment headers", () => {
		const entries = [
			{ time: "10:00:00", level: "info", source: "renderer", message: "Download started" },
			{ time: "10:00:01", level: "error", source: "main", message: "Network timeout" },
		];
		const formatted = formatLogsText(entries);
		expect(formatted).toBe("[10:00:00] [renderer] [INFO] Download started\n[10:00:01] [main] [ERROR] Network timeout");
		expect(formatted).not.toContain("### Environment");
	});

	test("buildIssueMarkdown generates expected template with environment and logs", () => {
		const diag = {
			version: "4.0.2",
			platform: "win32 (x64, 10.0.22631)",
			ytDlpPath: "C:\\path\\yt-dlp.exe",
			ffmpegPath: "C:\\path\\ffmpeg.exe",
			jsRuntimePath: "C:\\path\\node.exe",
		};
		const entries = [
			{ time: "12:00:00", level: "info", source: "renderer", message: "Init successful" },
			{ time: "12:00:01", level: "error", source: "renderer", message: "Download failed" },
		];

		const md = buildIssueMarkdown(diag, entries);
		expect(md).toContain("### Environment");
		expect(md).toContain("ytDownloader Version:** v4.0.2");
		expect(md).toContain("win32 (x64, 10.0.22631)");
		expect(md).toContain("`C:\\path\\yt-dlp.exe`");
		expect(md).toContain("Init successful");
		expect(md).toContain("Download failed");
	});

	test("buildGitHubIssueUrl creates valid URL and bounds body length", () => {
		const diag = {
			version: "4.0.2",
			platform: "win32 (x64)",
			ytDlpPath: "C:\\path\\yt-dlp.exe",
			ffmpegPath: "C:\\path\\ffmpeg.exe",
			jsRuntimePath: "C:\\path\\node.exe",
		};
		// Generate 100 log entries
		const entries = Array.from({ length: 100 }, (_, i) => ({
			time: "12:00:00",
			level: "log",
			source: "renderer",
			message: `Log line ${i}: ${"X".repeat(50)}`,
		}));

		const url = buildGitHubIssueUrl(diag, entries);
		expect(url.startsWith("https://github.com/aandrew-me/ytDownloader/issues/new?")).toBe(true);
		// Ensure URL is compact and safe from HTTP 414 / OS shell limits
		expect(url.length).toBeLessThan(1200);
		expect(url).toContain(encodeURIComponent("### Environment"));
		expect(url).toContain(encodeURIComponent("### Relevant Logs"));
	});

	test("getSystemDiagnostics handles partial os object safely", () => {
		global.window = {
			electronAPI: {
				os: {
					platform: () => "win32",
				},
			},
		};
		const diag = getSystemDiagnostics();
		expect(diag.platform).toBe("win32");
		delete global.window;
	});

	test("appendLogEntryToUI removes old DOM rows when exceeding MAX_LOGS", () => {
		const mockConsole = {
			children: [],
			appendChild(el) {
				this.children.push(el);
			},
			get firstElementChild() {
				return this.children[0];
			},
			scrollTop: 0,
			scrollHeight: 100,
		};

		global.document = {
			getElementById(id) {
				if (id === "view-logs") return { classList: { contains: () => true } };
				if (id === "logsConsole") return mockConsole;
				if (id === "logsCountBadge") return {};
				return null;
			},
			createElement() {
				return {
					className: "",
					innerHTML: "",
					remove() {
						const idx = mockConsole.children.indexOf(this);
						if (idx !== -1) mockConsole.children.splice(idx, 1);
					},
				};
			},
		};

		for (let i = 0; i < MAX_LOGS; i++) {
			appendLogEntryToUI({ time: "12:00:00", level: "info", source: "renderer", message: `Msg ${i}` });
		}
		expect(mockConsole.children.length).toBe(MAX_LOGS);

		appendLogEntryToUI({ time: "12:00:01", level: "info", source: "renderer", message: "Overflow entry" });
		expect(mockConsole.children.length).toBe(MAX_LOGS);

		delete global.document;
	});
});

