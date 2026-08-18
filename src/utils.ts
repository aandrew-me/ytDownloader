/**
 * Utility functions for YTDownloader renderer process
 */

/**
 * Shorthand helper for document.getElementById
 */
export function getId<T extends HTMLElement = HTMLElement>(id: string): T | null {
	return document.getElementById(id) as T | null;
}

/**
 * Displays a temporary popup toast notification
 */
export function showPopup(text: string, isError: boolean = false): void {
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
			if (popupContainer && popupContainer.childElementCount === 0) {
				popupContainer.remove();
			}
		}, 400);
	}, 2200);
}

/**
 * Formats a byte number into human-readable string (e.g. 1.5 MB)
 */
export function formatBytes(bytes: number): string {
	if (!bytes || bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Formats seconds into HH:MM:SS or MM:SS format
 */
export function formatTime(duration: number | null | undefined): string {
	if (duration === null || duration === undefined) return "";
	const seconds = Number(duration);
	if (isNaN(seconds)) return "00:00";

	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const pad = (num: number) => String(num).padStart(2, "0");

	if (hrs > 0) {
		return `${hrs}:${pad(mins)}:${pad(secs)}`;
	}
	return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Locates the ffmpeg directory path (containing bin/ffmpeg and bin/ffprobe).
 */
export async function findFfmpeg(): Promise<string> {
	const { env, platform, execSync, __dirname, windowsStore, homedir, existsSync, cpSync, join } = window.electronAPI as any;
	const currentPlatform = typeof platform === "function" ? platform() : platform;
	const userHomeDir = typeof homedir === "function" ? homedir() : homedir;

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
			let sysPath: string;
			if (currentPlatform === "win32") {
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
				const parts = sysPath.split(/[/\\]/);
				parts.pop();
				return parts.join("/");
			}
		} catch {
			console.warn(
				"System ffmpeg not found in PATH; falling back to bundled.",
			);
		}
	}

	// Priority 3: Bundled ffmpeg
	const bundledDir = join(__dirname, "..", "ffmpeg");
	const isWin = currentPlatform === "win32";
	const ffmpegName = isWin ? "ffmpeg.exe" : "ffmpeg";
	const bundledFfmpegFile = join(bundledDir, "bin", ffmpegName);

	// MS Store packages run in a restricted WindowsApps container where executing binaries fails
	if (windowsStore) {
		const targetDir = join(userHomeDir, ".ytDownloader", "ffmpeg");
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
	const fallbackDir = join(userHomeDir, ".ytDownloader", "ffmpeg", "bin");
	if (existsSync(join(fallbackDir, ffmpegName))) {
		return fallbackDir;
	}

	return "";
}

/**
 * Ensures shared libraries are loadable on Linux by setting LD_LIBRARY_PATH
 */
export function ensureFfmpegLibsLoadable(ffmpegPath: string): void {
	const { env, platform, join, existsSync, setEnv } = window.electronAPI as any;
	const currentPlatform = typeof platform === "function" ? platform() : platform;
	if (currentPlatform !== "linux" || !ffmpegPath) {
		return;
	}

	const libDir = join(ffmpegPath, "..", "lib");
	if (!existsSync(libDir)) {
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
 */
export function getFfmpegPath(): string {
	const isTestMode = Boolean(window.electronAPI && window.electronAPI.isTest);
	if (isTestMode && (window.__mockYtDlp || window.__mockSpawn || window.__mockFfmpeg)) return "ffmpeg";

	const { env, existsSync, join, platform } = window.electronAPI as any;
	if (
		env &&
		env.YTDOWNLOADER_FFMPEG_PATH &&
		existsSync(env.YTDOWNLOADER_FFMPEG_PATH)
	) {
		return env.YTDOWNLOADER_FFMPEG_PATH;
	}

	const dir = window.AppBinaries?.ffmpegPath;
	if (!dir) return "";
	const currentPlatform = typeof platform === "function" ? platform() : platform;
	const ext = currentPlatform === "win32" ? ".exe" : "";
	return join(dir, "ffmpeg" + ext);
}

/**
 * Returns full path to the ffprobe executable.
 */
export function getFfprobePath(): string {
	const isTestMode = Boolean(window.electronAPI && window.electronAPI.isTest);
	if (isTestMode && (window.__mockYtDlp || window.__mockSpawn || window.__mockFfmpeg)) return "ffprobe";

	const { env, existsSync, join, platform } = window.electronAPI as any;
	if (
		env &&
		env.YTDOWNLOADER_FFMPEG_PATH &&
		existsSync(env.YTDOWNLOADER_FFMPEG_PATH)
	) {
		const parts = env.YTDOWNLOADER_FFMPEG_PATH.split(/[/\\]/);
		parts.pop();
		const dir = parts.join("/");
		const currentPlatform = typeof platform === "function" ? platform() : platform;
		const ext = currentPlatform === "win32" ? ".exe" : "";
		return join(dir, "ffprobe" + ext);
	}

	const dir = window.AppBinaries?.ffmpegPath;
	if (!dir) return "";
	const currentPlatform = typeof platform === "function" ? platform() : platform;
	const ext = currentPlatform === "win32" ? ".exe" : "";
	return join(dir, "ffprobe" + ext);
}

/**
 * Determines the JavaScript runtime path for yt-dlp.
 */
export async function getJsRuntimePath(): Promise<string> {
	const { env, platform, __dirname, windowsStore, homedir, existsSync, copyFileSync, mkdirSync, join } = window.electronAPI as any;
	const currentPlatform = typeof platform === "function" ? platform() : platform;
	const userHomeDir = typeof homedir === "function" ? homedir() : homedir;
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
	if (currentPlatform === "darwin") {
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
	const isWin = currentPlatform === "win32";
	const nodeName = isWin ? "node.exe" : "node";

	const bundledNodePath = join(__dirname, "..", nodeName);

	// MS Store packages run in a restricted WindowsApps container
	if (windowsStore) {
		const targetDir = join(userHomeDir, ".ytDownloader");
		const targetNodeFile = join(targetDir, nodeName);

		if (existsSync(targetNodeFile)) {
			return `${exeName}:${targetNodeFile}`;
		}

		if (existsSync(bundledNodePath)) {
			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, { recursive: true });
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

	const fallbackNodePath = join(userHomeDir, ".ytDownloader", nodeName);
	if (existsSync(fallbackNodePath)) {
		return `${exeName}:${fallbackNodePath}`;
	}

	return "";
}
