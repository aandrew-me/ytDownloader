/**
 * Utility functions for YTDownloader renderer process
 */

/**
 * Shorthand helper for document.getElementById
 * @param {string} id
 * @returns {HTMLElement | null}
 */
export function getId(id) {
	return document.getElementById(id);
}

/**
 * Displays a temporary popup toast notification
 * @param {string} text
 * @param {boolean} [isError=false]
 */
export function showPopup(text, isError = false) {
	let popupContainer = document.getElementById("popupContainer");
	if (!popupContainer) {
		popupContainer = document.createElement("div");
		popupContainer.id = "popupContainer";
		popupContainer.className = "popup-container";
		document.body.appendChild(popupContainer);
	}

	const popup = document.createElement("span");
	popup.textContent = text;
	popup.classList.add("popup-item");
	popup.style.background = isError ? "#ff6b6b" : "#54abde";

	if (isError) {
		popup.classList.add("popup-error");
	}

	popupContainer.appendChild(popup);

	setTimeout(() => {
		popup.style.opacity = "0";
		setTimeout(() => {
			popup.remove();
			if (popupContainer.childElementCount === 0) {
				popupContainer.remove();
			}
		}, 400);
	}, 2200);
}

/**
 * Formats a byte number into human-readable string (e.g. 1.5 MB)
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
	if (!bytes || bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Formats seconds into HH:MM:SS or MM:SS format
 * @param {number | null | undefined} duration
 * @returns {string}
 */
export function formatTime(duration) {
	if (duration === null || duration === undefined) return "";
	const seconds = Number(duration);
	if (isNaN(seconds)) return "00:00";

	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const pad = (num) => String(num).padStart(2, "0");

	if (hrs > 0) {
		return `${hrs}:${pad(mins)}:${pad(secs)}`;
	}
	return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Locates the ffmpeg directory path (containing bin/ffmpeg and bin/ffprobe).
 * @returns {Promise<string>}
 */
export async function findFfmpeg() {
	const { env, platform, execSync, __dirname, windowsStore, homedir, fs, join, dirname } = window.electronAPI;
	const existsSync = fs.existsSync;
	const cpSync = fs.cpSync;

	// Priority 1: Environment Variable
	if (env && env.YTDOWNLOADER_FFMPEG_PATH) {
		if (existsSync(env.YTDOWNLOADER_FFMPEG_PATH)) {
			return env.YTDOWNLOADER_FFMPEG_PATH;
		}
		throw new Error(
			"YTDOWNLOADER_FFMPEG_PATH is set, but no file exists there.",
		);
	}

	// Priority 2: User-selected system ffmpeg
	const ffmpegSource = localStorage.getItem("ffmpegSource") || "bundled";
	if (ffmpegSource === "system") {
		try {
			let sysPath;
			if (platform() === "win32") {
				sysPath = execSync("where ffmpeg")
					.toString()
					.split(/\r?\n/)[0]
					.trim();
			} else {
				sysPath = execSync("command -v ffmpeg || which ffmpeg")
					.toString()
					.split(/\r?\n/)[0]
					.trim();
			}
			if (sysPath && existsSync(sysPath)) {
				return dirname(sysPath);
			}
		} catch {
			console.warn(
				"System ffmpeg not found in PATH; falling back to bundled.",
			);
		}
	}

	// Priority 3: Bundled ffmpeg
	const bundledDir = join(__dirname, "..", "ffmpeg");
	const isWin = platform() === "win32";
	const ffmpegName = isWin ? "ffmpeg.exe" : "ffmpeg";
	const bundledFfmpegFile = join(bundledDir, "bin", ffmpegName);

	// MS Store packages run in a restricted WindowsApps container where executing binaries fails
	if (windowsStore) {
		const targetDir = join(homedir(), ".ytDownloader", "ffmpeg");
		const targetFfmpegFile = join(targetDir, "bin", ffmpegName);

		if (!existsSync(targetFfmpegFile)) {
			if (existsSync(bundledDir)) {
				try {
					cpSync(bundledDir, targetDir, {
						recursive: true,
						dereference: true,
					});
				} catch {
					console.error("Failed to copy bundled ffmpeg.");
					return "";
				}
			} else {
				return "";
			}
		}

		return join(targetDir, "bin");
	}

	if (existsSync(bundledFfmpegFile)) {
		return join(bundledDir, "bin");
	}

	// Fallback if existing copy is present in ~/.ytDownloader
	const fallbackDir = join(homedir(), ".ytDownloader", "ffmpeg", "bin");
	if (existsSync(join(fallbackDir, ffmpegName))) {
		return fallbackDir;
	}

	return "";
}

/**
 * Ensures shared libraries are loadable on Linux by setting LD_LIBRARY_PATH
 * @param {string} ffmpegPath
 */
export function ensureFfmpegLibsLoadable(ffmpegPath) {
	const { env, platform, join, fs, setEnv } = window.electronAPI;
	if (platform() !== "linux" || !ffmpegPath) {
		return;
	}

	const libDir = join(ffmpegPath, "..", "lib");
	if (!fs.existsSync(libDir)) {
		return;
	}

	const current = env ? env.LD_LIBRARY_PATH : undefined;
	if (current) {
		if (!current.split(":").includes(libDir)) {
			setEnv("LD_LIBRARY_PATH", `${libDir}:${current}`);
		}
	} else {
		setEnv("LD_LIBRARY_PATH", libDir);
	}
}

/**
 * Returns full path to the ffmpeg executable.
 * @returns {string}
 */
export function getFfmpegPath() {
	const isTestMode = Boolean(window.electronAPI && window.electronAPI.isTest);
	if (isTestMode && (window.__mockYtDlp || window.__mockSpawn || window.__mockFfmpeg)) return "ffmpeg";

	const { env, fs, path, os } = window.electronAPI;
	if (
		env &&
		env.YTDOWNLOADER_FFMPEG_PATH &&
		fs.existsSync(env.YTDOWNLOADER_FFMPEG_PATH)
	) {
		return env.YTDOWNLOADER_FFMPEG_PATH;
	}

	const dir = window.AppBinaries?.ffmpegPath;
	if (!dir) return "";
	const ext = os.platform() === "win32" ? ".exe" : "";
	return path.join(dir, "ffmpeg" + ext);
}

/**
 * Returns full path to the ffprobe executable.
 * @returns {string}
 */
export function getFfprobePath() {
	const isTestMode = Boolean(window.electronAPI && window.electronAPI.isTest);
	if (isTestMode && (window.__mockYtDlp || window.__mockSpawn || window.__mockFfmpeg)) return "ffprobe";

	const { env, fs, path, os } = window.electronAPI;
	if (
		env &&
		env.YTDOWNLOADER_FFMPEG_PATH &&
		fs.existsSync(env.YTDOWNLOADER_FFMPEG_PATH)
	) {
		const dir = path.dirname(env.YTDOWNLOADER_FFMPEG_PATH);
		const ext = os.platform() === "win32" ? ".exe" : "";
		return path.join(dir, "ffprobe" + ext);
	}

	const dir = window.AppBinaries?.ffmpegPath;
	if (!dir) return "";
	const ext = os.platform() === "win32" ? ".exe" : "";
	return path.join(dir, "ffprobe" + ext);
}

/**
 * Determines the JavaScript runtime path for yt-dlp.
 * @returns {Promise<string>}
 */
export async function getJsRuntimePath() {
	const { env, platform, __dirname, windowsStore, homedir, fs, join } = window.electronAPI;
	const existsSync = fs.existsSync;
	const copyFileSync = fs.copyFileSync;
	const mkdirSync = fs.mkdirSync;
	const exeName = "node";

	// Priority 1: Environment Variable (Node)
	if (env && env.YTDOWNLOADER_NODE_PATH) {
		if (existsSync(env.YTDOWNLOADER_NODE_PATH)) {
			return `$node:${env.YTDOWNLOADER_NODE_PATH}`;
		}

		return "";
	}

	// Priority 2: Environment Variable (Deno)
	if (env && env.YTDOWNLOADER_DENO_PATH) {
		if (existsSync(env.YTDOWNLOADER_DENO_PATH)) {
			return `$deno:${env.YTDOWNLOADER_DENO_PATH}`;
		}

		return "";
	}

	// Priority 3: System-installed Deno (macOS Fallback)
	if (platform() === "darwin") {
		const possiblePaths = [
			"/opt/homebrew/bin/deno",
			"/usr/local/bin/deno",
		];

		for (const p of possiblePaths) {
			if (existsSync(p)) {
				return `deno:${p}`;
			}
		}

		console.log("No Deno installation found");

		return "";
	}

	// Priority 4: Bundled Node Runtime
	const isWin = platform() === "win32";
	const nodeName = isWin ? "node.exe" : "node";

	const bundledNodePath = join(__dirname, "..", nodeName);

	// MS Store packages run in a restricted WindowsApps container
	if (windowsStore) {
		const targetDir = join(homedir(), ".ytDownloader");
		const targetNodeFile = join(targetDir, nodeName);

		if (existsSync(targetNodeFile)) {
			return `${exeName}:${targetNodeFile}`;
		}

		if (existsSync(bundledNodePath)) {
			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, {recursive: true});
			}

			try {
				copyFileSync(bundledNodePath, targetNodeFile);
			} catch {
				console.error("Failed to copy bundled Node runtime.");
				return "";
			}

			return `${exeName}:${targetNodeFile}`;
		}

		return "";
	}

	if (existsSync(bundledNodePath)) {
		return `${exeName}:${bundledNodePath}`;
	}

	const fallbackNodePath = join(homedir(), ".ytDownloader", nodeName);
	if (existsSync(fallbackNodePath)) {
		return `${exeName}:${fallbackNodePath}`;
	}

	return "";
}

