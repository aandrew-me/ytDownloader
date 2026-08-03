const { _electron: electron } = require("@playwright/test");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const DEFAULT_MOCK_METADATA = {
	id: "dQw4w9WgXcQ",
	title: "Test YouTube Video Title",
	channel: "Test Channel Name",
	thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
	duration: 213,
	extractor_key: "Youtube",
	url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	webpage_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	formats: [
		{
			format_id: "137",
			ext: "mp4",
			height: 1080,
			fps: 30,
			vcodec: "avc1.640028",
			acodec: "none",
			filesize: 50000000,
		},
		{
			format_id: "248",
			ext: "webm",
			height: 1080,
			fps: 30,
			vcodec: "vp9",
			acodec: "none",
			filesize: 45000000,
		},
		{
			format_id: "22",
			ext: "mp4",
			height: 720,
			fps: 30,
			vcodec: "avc1.47001f",
			acodec: "mp4a.40.2",
			filesize: 25000000,
		},
		{
			format_id: "140",
			ext: "m4a",
			format_note: "medium",
			vcodec: "none",
			acodec: "mp4a.40.2",
			filesize: 3000000,
		},
		{
			format_id: "251",
			ext: "webm",
			format_note: "tiny",
			vcodec: "none",
			acodec: "opus",
			filesize: 3500000,
		},
	],
};

/**
 * Launches the Electron app headlessly with pre-injected yt-dlp/ffmpeg mocking script so initial config uses the mock.
 */
async function launchApp(customLocalStorage = {}, customMetadata = DEFAULT_MOCK_METADATA, targetPage = null) {
	const testUserDataDir = path.join(os.tmpdir(), `ytdownloader-test-userdata-${crypto.randomUUID()}`);
	if (!fs.existsSync(testUserDataDir)) {
		fs.mkdirSync(testUserDataDir, { recursive: true });
	}

	const app = await electron.launch({
		args: [
			path.join(__dirname, "../../main.js"),
			`--user-data-dir=${testUserDataDir}`,
			"--is-test",
			"--headless",
			"--no-sandbox",
			"--disable-gpu",
		],
		env: {
			...process.env,
			NODE_ENV: "test",
			YTDOWNLOADER_TEST: "true",
		},
	});

	const page = await app.firstWindow();

	// Inject mocking before DOMContentLoaded so app.initialize() / compressor.js picks it up immediately
	await page.addInitScript((meta) => {
		window.__executedCommands = [];
		window.__mockMetadata = meta;

		const createMockProcess = (args) => {
			window.__executedCommands.push(args);
			const callbacks = {};
			const stdoutCbs = [];
			const stderrCbs = [];

			const procWrapper = {
				ytDlpProcess: {
					spawnargs: args,
					stdout: {
						on: (event, cb) => {
							if (event === "data") stdoutCbs.push(cb);
						},
					},
					stderr: {
						on: (event, cb) => {
							if (event === "data") stderrCbs.push(cb);
						},
					},
					kill: () => {},
					killed: false,
					pid: 99999,
				},
				on: (event, cb) => {
					callbacks[event] = callbacks[event] || [];
					callbacks[event].push(cb);
					return procWrapper;
				},
				once: (event, cb) => {
					callbacks[event] = callbacks[event] || [];
					callbacks[event].push(cb);
					return procWrapper;
				},
				kill: () => {},
				killed: false,
			};

			setTimeout(() => {
				if (args.includes("-j")) {
					const jsonStr = JSON.stringify(window.__mockMetadata);
					stdoutCbs.forEach((cb) => cb(jsonStr));
					(callbacks["close"] || []).forEach((cb) => cb(0));
				} else {
					(callbacks["progress"] || []).forEach((cb) =>
						cb({ percent: 100 }),
					);
					(callbacks["ytDlpEvent"] || []).forEach((cb) => cb());
					(callbacks["close"] || []).forEach((cb) => cb(0));
				}
			}, 10);

			return procWrapper;
		};

		window.__mockYtDlp = {
			exec: (args) => createMockProcess(args),
			execPromise: async () => JSON.stringify(window.__mockMetadata),
		};

		// Mock spawn function for FFmpeg / FFprobe child processes
		const mockSpawnFn = (cmd, args = []) => {
			window.__executedCommands.push(args);
			const callbacks = {};
			const stdoutCbs = [];
			const stderrCbs = [];

			const childMock = {
				stdout: {
					on: (event, cb) => {
						if (event === "data") stdoutCbs.push(cb);
					},
				},
				stderr: {
					on: (event, cb) => {
						if (event === "data") stderrCbs.push(cb);
					},
				},
				stdin: {
					write: () => {},
				},
				on: (event, cb) => {
					callbacks[event] = callbacks[event] || [];
					callbacks[event].push(cb);
					return childMock;
				},
				once: (event, cb) => {
					callbacks[event] = callbacks[event] || [];
					callbacks[event].push(cb);
					return childMock;
				},
				kill: () => {},
				killed: false,
				pid: 88888,
			};

			setTimeout(() => {
				if (args.includes("format=duration")) {
					stdoutCbs.forEach((cb) => cb("60.0\n"));
				} else if (args.includes("stream=codec_name")) {
					stdoutCbs.forEach((cb) => cb("h264\n"));
				} else {
					stderrCbs.forEach((cb) =>
						cb(
							"Duration: 00:01:00.00, start: 0.00, bitrate: 1000 kb/s\nframe=100 fps=30 q=23.0 size=1000kB time=00:00:30.00 bitrate=270.0kbits/s speed=1.5x",
						),
					);
				}
				(callbacks["exit"] || []).forEach((cb) => cb(0));
				(callbacks["close"] || []).forEach((cb) => cb(0));
			}, 10);

			return childMock;
		};

		window.__mockSpawn = mockSpawnFn;
	}, customMetadata);

	// Apply localStorage preferences if provided
	if (Object.keys(customLocalStorage).length > 0) {
		await page.evaluate((storage) => {
			for (const [key, val] of Object.entries(storage)) {
				localStorage.setItem(key, String(val));
			}
		}, customLocalStorage);
	}

	if (targetPage) {
		await Promise.all([
			page.waitForNavigation({ waitUntil: "domcontentloaded" }),
			page.evaluate((relPath) => {
				window.electronAPI.ipcRenderer.send("load-win", relPath);
			}, targetPage),
		]);
	} else {
		await page.reload();
		await page.waitForLoadState("domcontentloaded");
	}

	return { app, page };
}

/**
 * Gets array of commands executed by yt-dlp/ffmpeg in page context.
 */
async function getExecutedCommands(page) {
	return await page.evaluate(() => window.__executedCommands || []);
}

/**
 * Clears recorded executed commands.
 */
async function clearExecutedCommands(page) {
	await page.evaluate(() => {
		window.__executedCommands = [];
	});
}

module.exports = {
	launchApp,
	getExecutedCommands,
	clearExecutedCommands,
	DEFAULT_MOCK_METADATA,
};
