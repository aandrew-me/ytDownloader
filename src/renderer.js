const {shell, ipcRenderer, clipboard} = require("electron");
const {default: YTDlpWrap} = require("yt-dlp-wrap-plus");
const {constants} = require("fs/promises");
const {homedir, platform} = require("os");
const {join} = require("path");
const {
	mkdirSync,
	accessSync,
	promises,
	existsSync,
	cpSync,
	copyFileSync,
} = require("fs");
const {execSync, spawn} = require("child_process");

const CONSTANTS = {
	DOM_IDS: {
		// Main UI
		PASTE_URL_BTN: "pasteUrl",
		SEARCH_INPUT: "searchQuery",
		SEARCH_BTN: "searchBtn",
		SEARCH_RESULTS: "searchResults",
		LOADING_WRAPPER: "loadingWrapper",
		INCORRECT_MSG: "incorrectMsg",
		ERROR_BTN: "errorBtn",
		ERROR_DETAILS: "errorDetails",
		PATH_DISPLAY: "path",
		SELECT_LOCATION_BTN: "selectLocation",
		DOWNLOAD_LIST: "list",
		CLEAR_BTN: "clearBtn",
		// Hidden Info Panel
		HIDDEN_PANEL: "hidden",
		CLOSE_HIDDEN_BTN: "closeHidden",
		TITLE_CONTAINER: "title",
		TITLE_INPUT: "titleName",
		URL_INPUTS: ".url",
		AUDIO_PRESENT_SECTION: "audioPresent",
		QUIT_APP_BTN: "quitAppBtn",
		// Format Selectors
		VIDEO_FORMAT_SELECT: "videoFormatSelect",
		AUDIO_FORMAT_SELECT: "audioFormatSelect",
		AUDIO_FOR_VIDEO_FORMAT_SELECT: "audioForVideoFormatSelect",
		// Download Buttons
		VIDEO_DOWNLOAD_BTN: "videoDownload",
		AUDIO_DOWNLOAD_BTN: "audioDownload",
		EXTRACT_BTN: "extractBtn",
		// Audio Extraction
		EXTRACT_SELECTION: "extractSelection",
		EXTRACT_QUALITY_SELECT: "extractQualitySelect",
		// Advanced Options
		CUSTOM_ARGS_INPUT: "customArgsInput", // Add this line
		START_TIME: "min-time",
		END_TIME: "max-time",
		MIN_SLIDER: "min-slider",
		MAX_SLIDER: "max-slider",
		SLIDER_RANGE_HIGHLIGHT: "range-highlight",
		SUB_CHECKED: "subChecked",
		QUIT_CHECKED: "quitChecked",
		// Popups
		POPUP_BOX: "popupBox",
		POPUP_BOX_MAC: "popupBoxMac",
		POPUP_TEXT: "popupText",
		POPUP_SVG: "popupSvg",
		YTDLP_DOWNLOAD_PROGRESS: "ytDlpDownloadProgress",
		UPDATE_POPUP: "updatePopup",
		UPDATE_POPUP_PROGRESS: "updateProgress",
		UPDATE_POPUP_BAR: "progressBarFill",
		// Menu
		MENU_ICON: "menuIcon",
		MENU: "menu",
		PREFERENCE_WIN: "preferenceWin",
		ABOUT_WIN: "aboutWin",
		PLAYLIST_WIN: "playlistWin",
		HISTORY_WIN: "historyWin",
		COMPRESSOR_WIN: "compressorWin",
		SEARCH_WIN: "searchWin",
		HOME_WIN: "homeWin",
	},
	LOCAL_STORAGE_KEYS: {
		DOWNLOAD_PATH: "downloadPath",
		YT_DLP_PATH: "ytdlp",
		MAX_DOWNLOADS: "maxActiveDownloads",
		PREFERRED_VIDEO_QUALITY: "preferredVideoQuality",
		PREFERRED_AUDIO_QUALITY: "preferredAudioQuality",
		PREFERRED_VIDEO_CODEC: "preferredVideoCodec",
		SHOW_MORE_FORMATS: "showMoreFormats",
		BROWSER_COOKIES: "browser",
		PROXY: "proxy",
		CONFIG_PATH: "configPath",
		AUTO_UPDATE: "autoUpdate",
		CLOSE_TO_TRAY: "closeToTray",
		YT_DLP_CUSTOM_ARGS: "customYtDlpArgs",
		YT_DLP_SOURCE: "ytdlpSource",
	},
	// yt-dlp source selectable in preferences.
	// "nightly": app-managed standalone binary kept on the nightly channel.
	// "system": use the yt-dlp found in PATH (managed by apt/pip/brew/etc.).
	YT_DLP_SOURCE: {
		NIGHTLY: "nightly",
		SYSTEM: "system",
	},
};

/**
 * Shorthand for document.getElementById.
 * @param {string} id The ID of the DOM element.
 * @returns {HTMLElement | null}
 */
const $ = (id) => document.getElementById(id);

class YtDownloaderApp {
	constructor() {
		this.state = {
			ytDlp: null,
			ytDlpPath: "",
			ffmpegPath: "",
			jsRuntimePath: "",
			downloadDir: "",
			maxActiveDownloads: 5,
			currentDownloads: 0,
			// Video metadata
			videoInfo: {
				title: "",
				thumbnail: "",
				duration: 0,
				extractor_key: "",
				url: "",
			},
			// Download options
			downloadOptions: {
				rangeCmd: "",
				rangeOption: "",
				subs: "",
				subLangs: "",
			},
			// Preferences
			preferences: {
				videoQuality: 1080,
				audioQuality: "",
				videoCodec: "avc1",
				showMoreFormats: false,
				proxy: "",
				browserForCookies: "",
				customYtDlpArgs: "",
				videoOutputTemplate: "%(title)s.%(ext)s",
				audioOutputTemplate: "%(title)s.%(ext)s",
			},
			downloadControllers: new Map(),
			downloadedItems: new Set(),
			downloadQueue: [],
		};
	}

	/**
	 * Initializes the application, setting up directories, finding executables,
	 * and attaching event listeners.
	 */
	async initialize() {
		await this._initializeTranslations();

		this._setupDirectories();
		this._configureTray();
		this._configureAutoUpdate();

		try {
			this.state.ytDlpPath = await this._findOrDownloadYtDlp();
			this.state.ytDlp = new YTDlpWrap(this.state.ytDlpPath);
			this.state.ffmpegPath = await this._findFfmpeg();
			this._ensureFfmpegLibsLoadable(this.state.ffmpegPath);
			this.state.jsRuntimePath = await this._getJsRuntimePath();

			console.log("yt-dlp path:", this.state.ytDlpPath);
			console.log("ffmpeg path:", this.state.ffmpegPath);
			console.log("JS runtime:", this.state.jsRuntimePath);

			this._addEventListeners();
		} catch (error) {
			console.error("Initialization failed:", error);
			$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = error.message;
			const pasteBtn = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);
			if (pasteBtn) pasteBtn.style.display = "none";
		}
	}

	/**
	 * Sets up the application's hidden directory and the default download directory.
	 */
	_setupDirectories() {
		const userHomeDir = homedir();
		const hiddenDir = join(userHomeDir, ".ytDownloader");

		if (!existsSync(hiddenDir)) {
			try {
				mkdirSync(hiddenDir, {recursive: true});
			} catch (error) {
				console.log(error);
			}
		}

		let defaultDownloadDir = join(userHomeDir, "Downloads");
		if (platform() === "linux") {
			try {
				const xdgDownloadDir = execSync("xdg-user-dir DOWNLOAD")
					.toString()
					.trim();
				if (xdgDownloadDir) {
					defaultDownloadDir = xdgDownloadDir;
				}
			} catch (err) {
				console.warn("Could not execute xdg-user-dir:", err.message);
			}
		}

		const savedPath = localStorage.getItem(
			CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH,
		);
		if (savedPath) {
			try {
				accessSync(savedPath, constants.W_OK);
				this.state.downloadDir = savedPath;
			} catch {
				console.warn(
					`Cannot write to saved path "${savedPath}". Falling back to default.`,
				);
				this.state.downloadDir = defaultDownloadDir;
				localStorage.setItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH,
					defaultDownloadDir,
				);
			}
		} else {
			this.state.downloadDir = defaultDownloadDir;
		}

		$(CONSTANTS.DOM_IDS.PATH_DISPLAY).textContent = this.state.downloadDir;

		if (!existsSync(this.state.downloadDir)) {
			mkdirSync(this.state.downloadDir, {recursive: true});
		}
	}

	/**
	 * Checks localStorage to determine if the tray icon should be used.
	 */
	_configureTray() {
		if (
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.CLOSE_TO_TRAY) ===
			"true"
		) {
			console.log("Tray is enabled.");
			ipcRenderer.send("useTray", true);
		}
	}

	/**
	 * Checks settings to determine if auto-updates should be enabled.
	 */
	_configureAutoUpdate() {
		let autoUpdate = true;
		if (
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.AUTO_UPDATE) ===
			"false"
		) {
			autoUpdate = false;
		}
		if (
			process.windowsStore ||
			process.env.YTDOWNLOADER_AUTO_UPDATES === "0"
		) {
			autoUpdate = false;
		}
		ipcRenderer.send("autoUpdate", autoUpdate);
	}

	/**
	 * Waits for the i18n module to load and then translates the static page content.
	 */
	async _initializeTranslations() {
		return new Promise((resolve) => {
			document.addEventListener(
				"translations-loaded",
				() => {
					window.i18n.translatePage();
					resolve();
				},
				{once: true},
			);
		});
	}

	/**
	 * Locates the yt-dlp executable path from various sources or downloads it.
	 * @returns {Promise<string>} A promise that resolves with the path to yt-dlp.
	 */
	async _findOrDownloadYtDlp() {
		const hiddenDir = join(homedir(), ".ytDownloader");
		const defaultYtDlpName = platform() === "win32" ? "ytdlp.exe" : "ytdlp";
		const defaultYtDlpPath = join(hiddenDir, defaultYtDlpName);
		const isMacOS = platform() === "darwin";
		const isFreeBSD = platform() === "freebsd";

		let executablePath = null;

		// PRIORITY 1: Environment Variable
		if (process.env.YTDOWNLOADER_YTDLP_PATH) {
			if (existsSync(process.env.YTDOWNLOADER_YTDLP_PATH)) {
				executablePath = process.env.YTDOWNLOADER_YTDLP_PATH;
			} else {
				throw new Error(
					"YTDOWNLOADER_YTDLP_PATH is set, but no file exists there.",
				);
			}
		}

		// PRIORITY 2: macOS homebrew
		else if (isMacOS) {
			const possiblePaths = [
				"/opt/homebrew/bin/yt-dlp", // Apple Silicon
				"/usr/local/bin/yt-dlp", // Intel
			];

			executablePath = possiblePaths.find((p) => existsSync(p));

			// If Homebrew check fails, show popup and abort
			if (!executablePath) {
				$(CONSTANTS.DOM_IDS.POPUP_BOX_MAC).style.display = "block";
				console.warn("Homebrew yt-dlp not found. Prompting user.");

				return "";
			}
		}

		// PRIORITY 3: FreeBSD
		else if (isFreeBSD) {
			try {
				executablePath = execSync("which yt-dlp").toString().trim();
			} catch {
				throw new Error(
					"No yt-dlp found in PATH on FreeBSD. Please install it.",
				);
			}
		}

		// PRIORITY 4: User-selected source (Windows/Linux)
		else {
			// Source is chosen in preferences; defaults to the nightly,
			// app-managed binary so YouTube fixes arrive fastest.
			const source =
				localStorage.getItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_SOURCE,
				) || CONSTANTS.YT_DLP_SOURCE.NIGHTLY;

			// "system": use yt-dlp from PATH (apt/pip/etc.). Falls back to the
			// managed binary if nothing is found in PATH.
			if (source === CONSTANTS.YT_DLP_SOURCE.SYSTEM) {
				try {
					let systemPath;
					if (platform() === "win32") {
						systemPath = execSync("where yt-dlp")
							.toString()
							.split(/\r?\n/)[0]
							.trim();
					} else {
						systemPath = execSync("command -v yt-dlp")
							.toString()
							.trim();
					}
					if (systemPath && existsSync(systemPath)) {
						executablePath = systemPath;
					}
				} catch {
					// Not found in PATH; fall back to the managed binary.
				}
			}

			// "nightly" (default), or "system" fallback: use the app-managed
			// binary. A stored path is reused; otherwise it is downloaded.
			if (!executablePath) {
				const storedPath = localStorage.getItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH,
				);

				if (
					storedPath &&
					existsSync(storedPath) &&
					storedPath.startsWith(hiddenDir)
				) {
					executablePath = storedPath;
				}
				// Download if missing
				else {
					executablePath =
						await this.ensureYtDlpBinary(defaultYtDlpPath);
				}
			}
		}

		localStorage.setItem(
			CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH,
			executablePath,
		);

		// Auto update
		this._runBackgroundUpdate(executablePath, isMacOS);

		return executablePath;
	}

	/**
	 * yt-dlp background update
	 */
	_runBackgroundUpdate(executablePath, isMacOS) {
		try {
			if (isMacOS) {
				const brewPaths = [
					"/opt/homebrew/bin/brew",
					"/usr/local/bin/brew",
				];
				const brewExec = brewPaths.find((p) => existsSync(p)) || "brew";

				const brewUpdate = spawn(brewExec, ["upgrade", "yt-dlp"]);

				brewUpdate.on("error", (err) =>
					console.error("Failed to run 'brew upgrade yt-dlp':", err),
				);
				brewUpdate.stdout.on("data", (data) =>
					console.log("yt-dlp brew update:", data.toString()),
				);
			} else {
				// Only self-update binaries we manage in ~/.ytDownloader.
				// A system yt-dlp (apt/pip/etc.) rejects `-U` and is updated
				// by the system package manager instead.
				const hiddenDir = join(homedir(), ".ytDownloader");
				if (!executablePath.startsWith(hiddenDir)) {
					console.log(
						"Using system yt-dlp; skipping self-update (-U).",
					);
					return;
				}

				const releaseChannel = "nightly";

				const updateProc = spawn(executablePath, [
					"--update-to",
					releaseChannel,
				]);

				updateProc.on("error", (err) =>
					console.error(
						"Failed to run background yt-dlp update:",
						err,
					),
				);

				updateProc.stdout.on("data", (data) => {
					const output = data.toString();
					console.log("yt-dlp update check:", output);

					if (output.toLowerCase().includes("updating to")) {
						this._showPopup(i18n.__("updatingYtdlp"));
					} else if (
						output.toLowerCase().includes("updated yt-dlp to")
					) {
						this._showPopup(i18n.__("updatedYtdlp"));
					}
				});
			}
		} catch (err) {
			console.warn("Error initiating background update:", err);
		}
	}

	/**
	 * Checks for the presence of the yt-dlp binary at the default path.
	 * If not found, it attempts to download it from GitHub.
	 *
	 * @param {string} defaultYtDlpPath The expected path to the yt-dlp binary.
	 * @returns {Promise<string>} A promise that resolves with the path to the yt-dlp binary.
	 * @throws {Error} Throws an error if the download fails.
	 */
	async ensureYtDlpBinary(defaultYtDlpPath) {
		try {
			await promises.access(defaultYtDlpPath);

			return defaultYtDlpPath;
		} catch {
			console.log("yt-dlp not found, downloading...");

			$(CONSTANTS.DOM_IDS.POPUP_BOX).style.display = "block";
			$(CONSTANTS.DOM_IDS.POPUP_SVG).style.display = "inline";
			document.querySelector("#popupBox p").textContent = i18n.__(
				"downloadingNecessaryFilesWait",
			);

			try {
				await YTDlpWrap.downloadFromGithub(
					defaultYtDlpPath,
					undefined,
					undefined,
					(progress, _d, _t) => {
						$(
							CONSTANTS.DOM_IDS.YTDLP_DOWNLOAD_PROGRESS,
						).textContent =
							i18n.__("progress") +
							`: ${(progress * 100).toFixed(2)}%`;
					},
				);

				$(CONSTANTS.DOM_IDS.POPUP_BOX).style.display = "none";

				localStorage.setItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH,
					defaultYtDlpPath,
				);

				return defaultYtDlpPath;
			} catch (downloadError) {
				$(CONSTANTS.DOM_IDS.YTDLP_DOWNLOAD_PROGRESS).textContent = "";

				console.error("Failed to download yt-dlp:", downloadError);

				document.querySelector("#popupBox p").textContent = i18n.__(
					"errorFailedFileDownload",
				);
				$(CONSTANTS.DOM_IDS.POPUP_SVG).style.display = "none";

				const tryAgainBtn = document.createElement("button");
				tryAgainBtn.id = "tryBtn";
				tryAgainBtn.textContent = i18n.__("tryAgain");
				tryAgainBtn.addEventListener("click", () => {
					// TODO: Improve it
					ipcRenderer.send("reload");
				});
				document.getElementById("popup").appendChild(tryAgainBtn);

				throw new Error("Failed to download yt-dlp.");
			}
		}
	}

	/**
	 * Locates the ffmpeg executable path.
	 * @returns {Promise<string>} A promise that resolves with the path to ffmpeg.
	 */
	async _findFfmpeg() {
		// Priority 1: Environment Variable
		if (process.env.YTDOWNLOADER_FFMPEG_PATH) {
			if (existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)) {
				return process.env.YTDOWNLOADER_FFMPEG_PATH;
			}
			throw new Error(
				"YTDOWNLOADER_FFMPEG_PATH is set, but no file exists there.",
			);
		}

		// Priority 2: System-installed (FreeBSD)
		if (platform() === "freebsd") {
			try {
				return execSync("which ffmpeg").toString().trim();
			} catch {
				throw new Error(
					"No ffmpeg found in PATH on FreeBSD. App may not work correctly.",
				);
			}
		}

		// Priority 3: Bundled ffmpeg
		const bundledDir = join(__dirname, "..", "ffmpeg");
		const targetDir = join(homedir(), ".ytDownloader", "ffmpeg");

		const isWin = platform() === "win32";
		const ffmpegName = isWin ? "ffmpeg.exe" : "ffmpeg";
		const targetFfmpegFile = join(targetDir, "bin", ffmpegName);

		// Check if the folder has already been copied
		if (!existsSync(targetFfmpegFile)) {
			if (existsSync(bundledDir)) {
				try {
					cpSync(bundledDir, targetDir, {recursive: true});
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

	/**
	 * The bundled Linux ffmpeg is dynamically linked and ships its shared
	 * libraries in a sibling "lib" directory, but its RPATH is broken, so it
	 * cannot find them on its own. yt-dlp spawns ffmpeg as a child process, so
	 * we expose that lib directory via LD_LIBRARY_PATH (inherited by children).
	 * Without this, audio extraction fails with "ffprobe and ffmpeg not found".
	 * @param {string} ffmpegPath Path to the bundled ffmpeg "bin" directory.
	 */
	_ensureFfmpegLibsLoadable(ffmpegPath) {
		if (platform() !== "linux" || !ffmpegPath) {
			return;
		}

		const libDir = join(ffmpegPath, "..", "lib");
		if (!existsSync(libDir)) {
			return;
		}

		const current = process.env.LD_LIBRARY_PATH;
		if (current) {
			if (!current.split(":").includes(libDir)) {
				process.env.LD_LIBRARY_PATH = `${libDir}:${current}`;
			}
		} else {
			process.env.LD_LIBRARY_PATH = libDir;
		}
	}

	/**
	 * Determines the JavaScript runtime path for yt-dlp.
	 * @returns {Promise<string>} A promise that resolves with the JS runtime path.
	 */
	async _getJsRuntimePath() {
		const exeName = "node";

		// Priority 1: Environment Variable (Node)
		if (process.env.YTDOWNLOADER_NODE_PATH) {
			if (existsSync(process.env.YTDOWNLOADER_NODE_PATH)) {
				return `$node:${process.env.YTDOWNLOADER_NODE_PATH}`;
			}

			return "";
		}

		// Priority 2: Environment Variable (Deno)
		if (process.env.YTDOWNLOADER_DENO_PATH) {
			if (existsSync(process.env.YTDOWNLOADER_DENO_PATH)) {
				return `$deno:${process.env.YTDOWNLOADER_DENO_PATH}`;
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
		const targetDir = join(homedir(), ".ytDownloader");
		const targetNodeFile = join(targetDir, nodeName);

		// Check if folder has already been copied
		if (existsSync(targetNodeFile)) {
			return `${exeName}:${targetNodeFile}`;
		}

		// Copy to .ytDownloader
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

	/**
	 * Loads various settings from localStorage into the application state.
	 */
	async _loadSettings(url) {
		const prefs = this.state.preferences;
		prefs.videoQuality =
			Number(
				localStorage.getItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_VIDEO_QUALITY,
				),
			) || 1080;
		prefs.audioQuality =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_AUDIO_QUALITY,
			) || "";
		prefs.videoCodec =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_VIDEO_CODEC,
			) || "avc1";
		prefs.showMoreFormats =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.SHOW_MORE_FORMATS,
			) === "true";
		prefs.proxy =
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.PROXY) || "";

		if (!prefs.proxy) {
			try {
				const systemProxy = await ipcRenderer.invoke(
					"get-system-proxy",
					url,
				);
				if (systemProxy) {
					prefs.proxy = systemProxy;

					console.log("Using system proxy:", systemProxy);
				}
			} catch (err) {
				console.error("Failed to get system proxy:", err);
			}
		}

		prefs.browserForCookies =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.BROWSER_COOKIES,
			) || "";
		prefs.customYtDlpArgs =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_CUSTOM_ARGS,
			) || "";
		prefs.configPath =
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.CONFIG_PATH) ||
			"";
		prefs.videoOutputTemplate =
			localStorage.getItem("filenameTemplateVideo") ||
			"%(title)s.%(ext)s";

		prefs.audioOutputTemplate =
			localStorage.getItem("filenameTemplateAudio") ||
			"%(title)s.%(ext)s";

		const maxDownloads = Number(
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.MAX_DOWNLOADS),
		);
		this.state.maxActiveDownloads = maxDownloads >= 1 ? maxDownloads : 5;

		// Update UI with loaded settings
		$(CONSTANTS.DOM_IDS.CUSTOM_ARGS_INPUT).value = prefs.customYtDlpArgs;

		const downloadDir = localStorage.getItem(
			CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH,
		);

		if (downloadDir) {
			this.state.downloadDir = downloadDir;
			$(CONSTANTS.DOM_IDS.PATH_DISPLAY).textContent = downloadDir;
		}
	}

	/**
	 * Attaches all necessary event listeners for the UI.
	 */
	_addEventListeners() {
		$(CONSTANTS.DOM_IDS.PASTE_URL_BTN)?.addEventListener("click", () =>
			this.pasteAndGetInfo(),
		);
		$(CONSTANTS.DOM_IDS.SEARCH_BTN)?.addEventListener("click", () => {
			const query = $(CONSTANTS.DOM_IDS.SEARCH_INPUT).value.trim();
			if (query) {
				this.searchYoutube(query);
			}
		});
		$(CONSTANTS.DOM_IDS.SEARCH_INPUT)?.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				const query = $(CONSTANTS.DOM_IDS.SEARCH_INPUT).value.trim();
				if (query) {
					this.searchYoutube(query);
				}
			}
		});
		document.addEventListener("keydown", (event) => {
			if (
				((event.ctrlKey && event.key === "v") ||
					(event.metaKey &&
						event.key === "v" &&
						platform() === "darwin")) &&
				document.activeElement.tagName !== "INPUT" &&
				document.activeElement.tagName !== "TEXTAREA"
			) {
				const pasteBtnInner = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);
				pasteBtnInner?.classList.add("active");
				setTimeout(() => {
					pasteBtnInner?.classList.remove("active");
				}, 150);

				this.pasteAndGetInfo();
			}
		});

		// Download buttons
		$(CONSTANTS.DOM_IDS.VIDEO_DOWNLOAD_BTN).addEventListener("click", () =>
			this.handleDownloadRequest("video"),
		);
		$(CONSTANTS.DOM_IDS.AUDIO_DOWNLOAD_BTN).addEventListener("click", () =>
			this.handleDownloadRequest("audio"),
		);
		$(CONSTANTS.DOM_IDS.EXTRACT_BTN).addEventListener("click", () =>
			this.handleDownloadRequest("extract"),
		);

		// UI controls
		$(CONSTANTS.DOM_IDS.CLOSE_HIDDEN_BTN).addEventListener("click", () =>
			this._hideInfoPanel(),
		);
		$(CONSTANTS.DOM_IDS.SELECT_LOCATION_BTN).addEventListener("click", () =>
			ipcRenderer.send("select-location-main", ""),
		);
		$(CONSTANTS.DOM_IDS.CLEAR_BTN).addEventListener("click", () =>
			this._clearAllDownloaded(),
		);

		// Error details
		$(CONSTANTS.DOM_IDS.ERROR_DETAILS).addEventListener("click", (e) => {
			// @ts-ignore
			clipboard.writeText(e.target.innerText);
			this._showPopup(i18n.__("copiedText"), false);
		});

		$(CONSTANTS.DOM_IDS.QUIT_APP_BTN).addEventListener("click", () => {
			ipcRenderer.send("quit", "quit");
		});

		// IPC listeners
		ipcRenderer.on("link", (event, text) => this.getInfo(text));
		ipcRenderer.on("downloadPath", (event, downloadPath) => {
			try {
				accessSync(downloadPath[0], constants.W_OK);

				const newPath = downloadPath[0];
				$(CONSTANTS.DOM_IDS.PATH_DISPLAY).textContent = newPath;
				this.state.downloadDir = newPath;
			} catch (error) {
				console.log(error);
				this._showPopup(i18n.__("unableToAccessDir"), true);
			}
		});

		ipcRenderer.on("download-progress", (_event, percent) => {
			if (percent) {
				const popup = $(CONSTANTS.DOM_IDS.UPDATE_POPUP);
				const textEl = $(CONSTANTS.DOM_IDS.UPDATE_POPUP_PROGRESS);
				const barEl = $(CONSTANTS.DOM_IDS.UPDATE_POPUP_BAR);

				popup.style.display = "flex";
				textEl.textContent = `${percent.toFixed(1)}%`;
				barEl.style.width = `${percent}%`;
			}
		});

		ipcRenderer.on("update-downloaded", (_event, _) => {
			$(CONSTANTS.DOM_IDS.UPDATE_POPUP).style.display = "none";
		});

		// Menu Listeners
		const menuMapping = {
			[CONSTANTS.DOM_IDS.PREFERENCE_WIN]: "/preferences.html",
			[CONSTANTS.DOM_IDS.ABOUT_WIN]: "/about.html",
			[CONSTANTS.DOM_IDS.HISTORY_WIN]: "/history.html",
		};
		const windowMapping = {
			[CONSTANTS.DOM_IDS.PLAYLIST_WIN]: "/playlist.html",
			[CONSTANTS.DOM_IDS.COMPRESSOR_WIN]: "/compressor.html",
			[CONSTANTS.DOM_IDS.SEARCH_WIN]: "/search.html",
			[CONSTANTS.DOM_IDS.HOME_WIN]: "/index.html",
		};

		Object.entries(menuMapping).forEach(([id, page]) => {
			$(id)?.addEventListener("click", () => {
				this._closeMenu();
				ipcRenderer.send("load-page", join(__dirname, page));
			});
		});

		Object.entries(windowMapping).forEach(([id, page]) => {
			$(id)?.addEventListener("click", () => {
				this._closeMenu();
				ipcRenderer.send("load-win", join(__dirname, page));
			});
		});

		const minSlider = $(CONSTANTS.DOM_IDS.MIN_SLIDER);
		const maxSlider = $(CONSTANTS.DOM_IDS.MAX_SLIDER);

		minSlider.addEventListener("input", () =>
			this._updateSliderUI(minSlider),
		);
		maxSlider.addEventListener("input", () =>
			this._updateSliderUI(maxSlider),
		);

		$(CONSTANTS.DOM_IDS.START_TIME).addEventListener(
			"change",
			this._handleTimeInputChange,
		);
		$(CONSTANTS.DOM_IDS.END_TIME).addEventListener(
			"change",
			this._handleTimeInputChange,
		);

		this._updateSliderUI(null);
	}

	// --- Public Methods ---

	/**
	 * Searches YouTube for the given query and displays the results.
	 * @param {string} query The search terms.
	 */
	async searchYoutube(query) {
		this._resetUIForNewLink();
		$(CONSTANTS.DOM_IDS.SEARCH_RESULTS).innerHTML = "";

		try {
			await this._loadSettings("https://youtube.com");
			const {proxy, browserForCookies, configPath} = this.state.preferences;
			const args = [
				"--flat-playlist",
				"-j",
				"--no-warnings",
				...(proxy ? ["--proxy", proxy] : []),
				...(browserForCookies ? ["--cookies-from-browser", browserForCookies] : []),
				...(this.state.jsRuntimePath
					? [
							"--no-js-runtimes",
							"--js-runtime",
							this.state.jsRuntimePath,
						]
					: []),
				...(configPath ? ["--config-location", configPath] : []),
				"--",
				`ytsearch12:${query}`
			];

			const results = await new Promise((resolve, reject) => {
				const process = this.state.ytDlp.exec(args, {shell: false});
				let stdout = "";
				let stderr = "";

				window.addEventListener("beforeunload", () => {
					if (process && !process.killed) {
						process.kill();
					}
				});

				process.ytDlpProcess.stdout.on("data", (data) => {
					stdout += data;
				});
				process.ytDlpProcess.stderr.on("data", (data) => {
					stderr += data;
				});

				process.on("close", () => {
					const items = [];
					if (stdout) {
						const lines = stdout.split(/\r?\n/);
						for (const line of lines) {
							if (line.trim()) {
								try {
									items.push(JSON.parse(line));
								} catch (e) {
									console.error("Failed to parse search line:", e);
								}
							}
						}
					}
					resolve(items);
				});

				process.on("error", (err) => reject(err));
			});

			this._renderSearchResults(results);
		} catch (error) {
			console.error("Search failed:", error);
			$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = error.message;
		} finally {
			$(CONSTANTS.DOM_IDS.LOADING_WRAPPER).style.display = "none";
		}
	}

	/**
	 * Renders search results list.
	 * @param {Array} results The list of search results from yt-dlp.
	 */
	_renderSearchResults(results) {
		const container = $(CONSTANTS.DOM_IDS.SEARCH_RESULTS);
		container.innerHTML = "";

		if (!results || results.length === 0) {
			const noResults = document.createElement("div");
			noResults.style.padding = "20px";
			noResults.textContent = i18n.__("noResultsFound");
			container.appendChild(noResults);
			return;
		}

		results.forEach((item) => {
			if (!item.url && item.id) {
				item.url = `https://www.youtube.com/watch?v=${item.id}`;
			}
			if (!item.url) return;

			const card = document.createElement("div");
			card.className = "searchResultItem";
			card.addEventListener("click", () => {
				this.getInfo(item.url);
			});

			const thumbWrapper = document.createElement("div");
			thumbWrapper.className = "searchResultThumbnailWrapper";

			const img = document.createElement("img");
			img.className = "searchResultThumbnail";
			let thumbUrl = "../assets/images/icon.png";
			if (item.thumbnails && item.thumbnails.length > 0) {
				thumbUrl = item.thumbnails[0].url;
			} else if (item.thumbnail) {
				thumbUrl = item.thumbnail;
			}
			img.src = thumbUrl;
			img.onerror = () => {
				img.src = "../assets/images/icon.png";
			};
			thumbWrapper.appendChild(img);

			if (item.duration || item.duration_string) {
				const durationBadge = document.createElement("span");
				durationBadge.className = "searchResultDuration";
				durationBadge.textContent = item.duration_string || this._formatTime(Math.ceil(item.duration));
				thumbWrapper.appendChild(durationBadge);
			}

			card.appendChild(thumbWrapper);

			const info = document.createElement("div");
			info.className = "searchResultInfo";

			const title = document.createElement("span");
			title.className = "searchResultTitle";
			title.textContent = item.title || "No Title";
			info.appendChild(title);

			const channel = document.createElement("span");
			channel.className = "searchResultChannel";
			channel.textContent = item.channel || item.uploader || "";
			info.appendChild(channel);

			card.appendChild(info);
			container.appendChild(card);
		});
	}

	/**
	 * Pastes URL from clipboard and initiates fetching video info.
	 */
	pasteAndGetInfo() {
		this.getInfo(clipboard.readText());
	}

	/**
	 * Fetches video metadata from a given URL.
	 * @param {string} url The video URL.
	 */
	async getInfo(url) {
		let safeUrl;
		try {
			safeUrl = this.validateUrl(url);
		} catch {
			this._showError(i18n.__("invalidUrl"), url);

			return;
		}

		await this._loadSettings(safeUrl);
		this._defaultVideoToggle();
		this._resetUIForNewLink();

		this.state.videoInfo.url = safeUrl;

		try {
			const metadata = await this._fetchVideoMetadata(safeUrl);
			console.log(metadata);

			const durationInt =
				metadata.duration == null ? null : Math.ceil(metadata.duration);

			this.state.videoInfo = {
				...this.state.videoInfo,
				id: metadata.id,
				title: metadata.title,
				thumbnail: metadata.thumbnail,
				duration: durationInt,
				extractor_key: metadata.extractor_key,
			};
			this.setVideoLength(durationInt);
			this._populateFormatSelectors(metadata.formats || []);
			this._displayInfoPanel();
		} catch (error) {
			console.log(error);
			if (
				error.message.includes("js-runtimes") &&
				error.message.includes("no such option")
			) {
				this._showError(i18n.__("ytDlpUpdateRequired"), url);
			} else {
				this._showError(error.message, url);
			}
		} finally {
			$(CONSTANTS.DOM_IDS.LOADING_WRAPPER).style.display = "none";
		}
	}

	/**
	 * Handles a download request, either starting it immediately or queuing it.
	 * @param {'video' | 'audio' | 'extract'} type The type of download.
	 */
	handleDownloadRequest(type) {
		this._updateDownloadOptionsFromUI();

		const downloadJob = {
			type,
			url: this.state.videoInfo.url,
			title: this.state.videoInfo.title,
			thumbnail: this.state.videoInfo.thumbnail,
			options: {...this.state.downloadOptions},
			// Capture UI values at the moment of click
			uiSnapshot: {
				videoFormat: $(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT).value,
				audioForVideoFormat: $(
					CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT,
				).value,
				audioFormat: $(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT).value,
				extractFormat: $(CONSTANTS.DOM_IDS.EXTRACT_SELECTION).value,
				extractQuality: $(CONSTANTS.DOM_IDS.EXTRACT_QUALITY_SELECT)
					.value,
			},
		};

		if (this.state.currentDownloads < this.state.maxActiveDownloads) {
			this._startDownload(downloadJob);
		} else {
			this._queueDownload(downloadJob);
		}
		this._hideInfoPanel();
	}

	/**
	 * Executes yt-dlp to get video metadata in JSON format.
	 * @param {string} url The video URL.
	 * @returns {Promise<object>} A promise that resolves with the parsed JSON metadata.
	 */
	_fetchVideoMetadata(url) {
		return new Promise((resolve, reject) => {
			const {proxy, browserForCookies, configPath} =
				this.state.preferences;
			const args = [
				"-j",
				"--no-playlist",
				"--no-warnings",

				...(proxy ? ["--proxy", proxy] : []),

				...(browserForCookies
					? ["--cookies-from-browser", browserForCookies]
					: []),

				...(this.state.jsRuntimePath
					? [
							"--no-js-runtimes",
							"--js-runtime",
							this.state.jsRuntimePath,
						]
					: []),

				...(configPath ? ["--config-location", configPath] : []),

				"--",
				url,
			];

			const process = this.state.ytDlp.exec(args, {shell: false});

			window.addEventListener("beforeunload", () => {
				if (process && !process.killed) {
					process.kill();
				}
			});

			console.log(
				"Spawned yt-dlp with args:",
				process.ytDlpProcess.spawnargs.join(" "),
			);

			let stdout = "";
			let stderr = "";

			process.ytDlpProcess.stdout.on("data", (data) => {
				stdout += data;
			});
			process.ytDlpProcess.stderr.on("data", (data) => (stderr += data));

			process.on("close", () => {
				if (stdout) {
					try {
						resolve(JSON.parse(stdout));
					} catch (e) {
						reject(
							new Error(
								"Failed to parse yt-dlp JSON output: " +
									(stderr || e.message),
							),
						);
					}
				} else {
					reject(
						new Error(
							stderr || `yt-dlp exited with a non-zero code.`,
						),
					);
				}
			});

			process.on("error", (err) => reject(err));
		});
	}

	/**
	 * Starts the download process for a given job.
	 * @param {object} job The download job object.
	 */
	_startDownload(job) {
		this.state.currentDownloads++;
		const randomId = "item_" + Math.random().toString(36).substring(2, 12);

		const {downloadArgs, tempFilePath} = this._prepareDownloadArgs(job);

		this._createDownloadUI(randomId, job);

		const controller = new AbortController();
		this.state.downloadControllers.set(randomId, controller);

		const downloadProcess = this.state.ytDlp.exec(downloadArgs, {
			shell: false,
			signal: controller.signal,
		});

		window.addEventListener("beforeunload", () => {
			if (downloadProcess && !downloadProcess.killed) {
				downloadProcess.kill();
			}
		});

		console.log(
			"Spawned yt-dlp with args:",
			downloadProcess.ytDlpProcess.spawnargs.join(" "),
		);

		let actualFilePath = "";
		downloadProcess.ytDlpProcess.stdout.on("data", (data) => {
			const str = data.toString();

			const destMatch = str.match(/Destination:\s+([^\r\n]+)/);
			if (destMatch)
				actualFilePath = destMatch[1]
					.trim()
					.replace(/(^["'])|(["']$)/g, "");

			const mergeMatch = str.match(/Merging formats into\s+([^\r\n]+)/);
			if (mergeMatch)
				actualFilePath = mergeMatch[1]
					.trim()
					.replace(/(^["'])|(["']$)/g, "");

			const existMatch = str.match(
				/\[download\]\s+([^\r\n]+)\s+has already been downloaded/,
			);
			if (existMatch)
				actualFilePath = existMatch[1]
					.trim()
					.replace(/(^["'])|(["']$)/g, "");
		});

		downloadProcess
			.on("progress", (progress) => {
				this._updateProgressUI(randomId, progress);
			})
			.once("ytDlpEvent", () => {
				const el = $(`${randomId}_prog`);
				if (el) el.textContent = i18n.__("downloading");
			})
			.once("close", (code) => {
				if (existsSync(tempFilePath)) {
					try {
						const fileContent = require("fs")
							.readFileSync(tempFilePath, "utf-8")
							.trim();
						if (fileContent) {
							actualFilePath = fileContent;
						}
						require("fs").unlinkSync(tempFilePath);
					} catch (e) {
						console.error("Error reading temp file:", e);
					}
				}

				this._handleDownloadCompletion(
					code,
					randomId,
					actualFilePath,
					job.thumbnail,
				);
			})
			.once("error", (error) => {
				if (existsSync(tempFilePath)) {
					try {
						require("fs").unlinkSync(tempFilePath);
					} catch (e) {}
				}
				this.state.downloadedItems.add(randomId);
				this._updateClearAllButton();
				this._handleDownloadError(error, randomId);
			});
	}

	/**
	 * Queues a download job if the maximum number of active downloads is reached.
	 * @param {object} job The download job object.
	 */
	_queueDownload(job) {
		const randomId = "queue_" + Math.random().toString(36).substring(2, 12);
		this.state.downloadQueue.push({...job, queueId: randomId});
		const itemHTML = `
            <div class="item" id="${randomId}">
                <div class="itemIconBox">
                    <img src="${
						job.thumbnail || "../assets/images/thumb.png"
					}" alt="thumbnail" class="itemIcon" crossorigin="anonymous">
                    <span class="itemType">${i18n.__(
						job.type === "video" ? "video" : "audio",
					)}</span>
                </div>
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
                    <p>${i18n.__("preparing")}</p>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML(
			"beforeend",
			itemHTML,
		);
	}

	/**
	 * Checks the queue and starts the next download if a slot is available.
	 */
	_processQueue() {
		if (
			this.state.downloadQueue.length > 0 &&
			this.state.currentDownloads < this.state.maxActiveDownloads
		) {
			const nextJob = this.state.downloadQueue.shift();
			// Remove the pending UI element
			$(nextJob.queueId)?.remove();
			this._startDownload(nextJob);
		}
	}

	/**
	 * Prepares the command-line arguments for yt-dlp based on the download job.
	 * @param {object} job The download job object.
	 * @returns {{downloadArgs: string[], tempFilePath: string}}
	 */
	_prepareDownloadArgs(job) {
		const {type, url, title, options, uiSnapshot} = job;
		const {rangeOption, rangeCmd, subs, subLangs} = options;
		const {
			proxy,
			browserForCookies,
			configPath,
			videoOutputTemplate,
			audioOutputTemplate,
		} = this.state.preferences;

		let format_id, ext, audioForVideoFormat_id, audioFormat;

		let template = videoOutputTemplate;

		if (type === "video") {
			const [videoFid, videoExt, _, videoCodec] =
				uiSnapshot.videoFormat.split("|");
			const [audioFid, audioExt] =
				uiSnapshot.audioForVideoFormat.split("|");
			format_id = videoFid;
			audioForVideoFormat_id = audioFid;
			const finalAudioExt = audioExt === "webm" ? "opus" : audioExt;
			ext = videoExt;
			if (videoExt === "mp4" && finalAudioExt === "opus") {
				if (videoCodec.includes("avc")) ext = "mkv";
				else if (videoCodec.includes("av01")) ext = "webm";
			} else if (
				videoExt === "webm" &&
				["m4a", "mp4"].includes(finalAudioExt)
			) {
				ext = "mkv";
			}
			audioFormat =
				audioForVideoFormat_id === "none"
					? ""
					: `+${audioForVideoFormat_id}`;
		} else if (type === "audio") {
			[format_id, ext] = uiSnapshot.audioFormat.split("|");
			ext = ext === "webm" ? "opus" : ext;

			template = audioOutputTemplate;
		} else {
			ext =
				{alac: "m4a"}[uiSnapshot.extractFormat] ||
				uiSnapshot.extractFormat;

			template = audioOutputTemplate;
		}

		if (rangeCmd) {
			let rangeTxt = rangeCmd.replace("*", "");
			if (platform() === "win32") rangeTxt = rangeTxt.replace(/:/g, "_");

			if (template.includes(".%(ext)s")) {
				template = template.replace(
					".%(ext)s",
					` [${rangeTxt}].%(ext)s`,
				);
			} else {
				template += ` [${rangeTxt}]`;
			}
		}

		const outputArgs = ["-P", this.state.downloadDir, "-o", template];

		const baseArgs = [
			"--no-playlist",
			"--no-mtime",

			...(browserForCookies
				? ["--cookies-from-browser", browserForCookies]
				: []),

			...(proxy ? ["--proxy", proxy] : []),

			...(configPath ? ["--config-location", configPath] : []),

			"--ffmpeg-location",
			this.state.ffmpegPath,

			...(this.state.jsRuntimePath
				? ["--no-js-runtimes", "--js-runtime", this.state.jsRuntimePath]
				: []),
		];

		if (type === "audio") {
			if (ext === "m4a" || ext === "mp3" || ext === "mp4") {
				baseArgs.unshift("--embed-thumbnail");
			}
		} else if (type === "extract") {
			if (ext === "mp3" || ext === "m4a") {
				baseArgs.unshift("--embed-thumbnail");
			}
		}

		let downloadArgs;
		if (type === "extract") {
			downloadArgs = [
				"-x",
				"--audio-format",
				uiSnapshot.extractFormat,
				"--audio-quality",
				uiSnapshot.extractQuality,
				...outputArgs,
				...baseArgs,
			];
		} else {
			const formatString =
				type === "video" ? `${format_id}${audioFormat}` : format_id;
			downloadArgs = ["-f", formatString, ...outputArgs, ...baseArgs];
		}

		if (subs) downloadArgs.push(subs);
		if (subLangs) downloadArgs.push(subLangs);
		if (rangeOption) downloadArgs.push(rangeOption, rangeCmd);

		const customArgsString = $(
			CONSTANTS.DOM_IDS.CUSTOM_ARGS_INPUT,
		).value.trim();
		if (customArgsString) {
			const customArgs = customArgsString.split(/\s+/);
			downloadArgs.push(...customArgs);
		}

		const randomId = "item_" + Math.random().toString(36).substring(2, 12);

		const sanitizedTitle = (job.title || "Unknown Title").replace(
			/"/g,
			"'",
		);
		downloadArgs.push(
			"--replace-in-metadata",
			"title",
			"^.*$",
			sanitizedTitle,
		);

		// Create a unique temporary file path to capture the exact filename from yt-dlp
		const tmpDir = require("os").tmpdir();
		const tempFilePath = join(tmpDir, `ytdlp_path_${randomId}.txt`);

		// Tell yt-dlp to output the absolute final file path directly to the temp file
		downloadArgs.push(
			"--print-to-file",
			"after_move:filepath",
			tempFilePath,
		);

		downloadArgs.push(url);

		return {downloadArgs, tempFilePath};
	}

	/**
	 * Handles the completion of a download process.
	 */
	_handleDownloadCompletion(code, randomId, actualFilePath, thumbnail) {
		this.state.currentDownloads--;
		this.state.downloadControllers.delete(randomId);

		if (code === 0) {
			this._showDownloadSuccessUI(randomId, actualFilePath, thumbnail);
			this.state.downloadedItems.add(randomId);
			this._updateClearAllButton();
		} else if (code !== null) {
			this._handleDownloadError(
				new Error(`Download process exited with code ${code}.`),
				randomId,
			);
		}

		this._processQueue();

		if ($(CONSTANTS.DOM_IDS.QUIT_CHECKED).checked) {
			ipcRenderer.send("quit", "quit");
		}
	}

	/**
	 * Handles an error during the download process.
	 */
	_handleDownloadError(error, randomId) {
		if (
			error.name === "AbortError" ||
			error.message.includes("AbortError")
		) {
			console.log(`Download ${randomId} was aborted.`);
			this.state.currentDownloads = Math.max(
				0,
				this.state.currentDownloads - 1,
			);
			this.state.downloadControllers.delete(randomId);
			this._processQueue();
			return; // Don't treat user cancellation as an error
		}
		this.state.currentDownloads--;
		this.state.downloadControllers.delete(randomId);
		console.error("Download Error:", error);
		const progressEl = $(`${randomId}_prog`);
		if (progressEl) {
			progressEl.textContent = i18n.__("errorHoverForDetails");
			progressEl.title = error.message;
		}
		this._processQueue();
	}

	/**
	 * Updates the download options state from the UI elements.
	 */
	_updateDownloadOptionsFromUI() {
		const startTime = $(CONSTANTS.DOM_IDS.START_TIME).value;
		const endTime = $(CONSTANTS.DOM_IDS.END_TIME).value;
		const duration = this.state.videoInfo.duration;

		const startSeconds = this.parseTime(startTime);
		const endSeconds = this.parseTime(endTime);

		if (
			startSeconds === 0 &&
			(endSeconds === duration || endSeconds === 0)
		) {
			this.state.downloadOptions.rangeCmd = "";
			this.state.downloadOptions.rangeOption = "";
		} else {
			const start = startTime || "0";
			const end = endTime || "inf";
			this.state.downloadOptions.rangeCmd = `*${start}-${end}`;
			this.state.downloadOptions.rangeOption = "--download-sections";
		}

		if ($(CONSTANTS.DOM_IDS.SUB_CHECKED).checked) {
			this.state.downloadOptions.subs = "--write-subs";
			this.state.downloadOptions.subLangs = "--sub-langs all";
		} else {
			this.state.downloadOptions.subs = "";
			this.state.downloadOptions.subLangs = "";
		}
	}

	/**
	 * Resets the UI state for a new link.
	 */
	_resetUIForNewLink() {
		this._hideInfoPanel();
		$(CONSTANTS.DOM_IDS.LOADING_WRAPPER).style.display = "flex";
		$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = "";
		$(CONSTANTS.DOM_IDS.ERROR_BTN).style.display = "none";
		$(CONSTANTS.DOM_IDS.ERROR_DETAILS).style.display = "none";
		$(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT).innerHTML = "";
		$(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT).innerHTML = "";
		const noAudioTxt = i18n.__("noAudio");
		$(CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT).innerHTML =
			`<option value="none|none">${noAudioTxt}</option>`;
	}

	/**
	 * Populates the video and audio format <select> elements.
	 * @param {Array} formats The formats array from yt-dlp metadata.
	 */
	_populateFormatSelectors(formats) {
		const videoSelectId = CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT;
		const audioSelectId = CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT;
		const audioForVideoSelectId =
			CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT;

		const {videoQuality, videoCodec, showMoreFormats} =
			this.state.preferences;
		let bestMatchHeight = 0;

		const speakerIconSvg = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;

		// Convert en -> English
		const langFormatter = new Intl.DisplayNames(
			[navigator.language || "en"],
			{type: "language"},
		);
		const getLanguageName = (code) => {
			if (!code) return "";
			try {
				// Split cases like "en-US"
				const baseCode = code.split("-")[0];
				const name = langFormatter.of(baseCode);
				return name
					? name.charAt(0).toUpperCase() + name.slice(1)
					: code;
			} catch (e) {
				return code;
			}
		};

		// Find the ideal match height boundary
		formats.forEach((f) => {
			if (
				f.height &&
				f.height <= videoQuality &&
				f.height > bestMatchHeight &&
				f.video_ext !== "none"
			) {
				bestMatchHeight = f.height;
			}
		});
		if (bestMatchHeight === 0 && formats.length > 0) {
			bestMatchHeight = Math.max(
				...formats.filter((f) => f.height).map((f) => f.height),
			);
		}

		const availableCodecs = new Set(
			formats
				.filter((f) => f.height === bestMatchHeight && f.vcodec)
				.map((f) => f.vcodec.split(".")[0]),
		);
		const finalCodec = availableCodecs.has(videoCodec)
			? videoCodec
			: [...availableCodecs].pop();

		let isAVideoSelected = false;

		const videoOptions = [];
		const audioOptions = [];

		formats.forEach((format) => {
			let sizeInMB = null;
			let isApprox = false;

			if (format.filesize) {
				sizeInMB = format.filesize / 1000000;
			} else if (format.filesize_approx) {
				sizeInMB = format.filesize_approx / 1000000;
				isApprox = true;
			} else if (this.state.videoInfo.duration && format.tbr) {
				sizeInMB = (this.state.videoInfo.duration * format.tbr) / 8192;
				isApprox = true;
			}

			const displaySize = sizeInMB
				? `${isApprox ? "~" : ""}${sizeInMB.toFixed(2)} MB`
				: i18n.__("unknownSize");

			if (format.video_ext !== "none" && format.vcodec !== "none") {
				if (
					!showMoreFormats &&
					(format.ext === "webm" || format.vcodec?.startsWith("vp"))
				) {
					return;
				}

				let isSelected = false;

				if (
					!isAVideoSelected &&
					format.height === bestMatchHeight &&
					format.vcodec?.startsWith(finalCodec)
				) {
					isSelected = true;
					isAVideoSelected = true;
				}

				const quality = `${format.height || "???"}p${format.fps === 60 ? "60" : ""}`;
				const vcodecText = format.vcodec?.split(".")[0] || "";

				let audioMarkup = `<div class="audio-placeholder"></div>`;
				if (format.acodec !== "none") {
					const langName = getLanguageName(format.language);
					const langSpan = langName
						? `<span class="lang-text">${langName}</span>`
						: "";
					audioMarkup = `
                    <div class="audio-indicator">
                        ${speakerIconSvg}
                        ${langSpan}
                    </div>
                `;
				}

				const codecHtml = showMoreFormats
					? `<span class="codec-text">${vcodecText}</span>`
					: "";

				const gridClass = showMoreFormats
					? "video-grid-extended"
					: "video-grid-compact";

				const optionTextFallback = showMoreFormats
					? `${quality} ${format.ext} ${vcodecText} ${displaySize}`
					: `${quality} ${format.ext} ${displaySize}`;

				const htmlContent = `
                <div class="modern-option-row ${gridClass}">
                    <span class="main-text">${quality}</span>
                    <span class="badge badge-format">${format.ext}</span>
                    ${codecHtml}
                    <span class="size-text">${displaySize}</span>
                    ${audioMarkup}
                </div>
            `;

				videoOptions.push({
					text: optionTextFallback,
					value: `${format.format_id}|${format.ext}|${format.height}|${format.vcodec}`,
					selected: isSelected,
					html: htmlContent,
				});

				// PROCESS AUDIO ONLY CHANNELS
			} else if (
				format.acodec !== "none" &&
				format.video_ext === "none"
			) {
				if (!showMoreFormats && format.ext === "webm") return;

				const audioExt = format.ext === "webm" ? "opus" : format.ext;


				const formatNote =
					(i18n.__(format.format_note) || i18n.__("unknownQuality"));

				// HTML for Audio Grid
				const htmlContent = `
                <div class="modern-option-row audio-grid">
                    <span class="main-text">${formatNote}</span>
                    <span class="badge badge-format">${audioExt}</span>
                    <span class="size-text">${displaySize}</span>
                </div>
            `;

				audioOptions.push({
					text: `${formatNote} ${audioExt} ${displaySize}`,
					value: `${format.format_id}|${audioExt}`,
					html: htmlContent,
				});
			}
		});

		const hasAudioTrack = formats.some(
			(f) =>
				f.acodec !== "none" &&
				f.acodec !== undefined &&
				f.vcodec === "none",
		);
		const audioSection = $(CONSTANTS.DOM_IDS.AUDIO_PRESENT_SECTION);

		if (audioSection) {
			audioSection.style.display = hasAudioTrack ? "block" : "none";
		}

		const videoSelectEl = $(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT);
		const audioSelectEl = $(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT);
		const audioForVideoSelectEl = $(
			CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT,
		);

		const mountSlimSelect = (domElement, optionsData) => {
			if (!domElement) return;

			if (domElement.slim) {
				domElement.slim.destroy();
			}

			domElement.slim = new SlimSelect({
				select: domElement,
				data: optionsData,
				settings: {
					showSearch: true,
					contentLocation: document.body,
				},
				events: {
					afterOpen: () => {
						document
							.querySelectorAll(".ss-option.ss-selected")
							.forEach((el) => {
								el.addEventListener(
									"click",
									() => {
										domElement.slim.close();
									},
									{once: true},
								);
							});
					},
				},
			});
		};

		if (videoOptions.length > 0) {
			mountSlimSelect(videoSelectEl, videoOptions);
		}

		if (audioOptions.length > 0) {
			mountSlimSelect(audioSelectEl, audioOptions);

			mountSlimSelect(
				audioForVideoSelectEl,
				JSON.parse(JSON.stringify(audioOptions)),
			);
		}

		const audioForVideoOptions = JSON.parse(JSON.stringify(audioOptions));
		const noAudioTxt = i18n.__("noAudio") || "No Audio";

		audioForVideoOptions.push({
			text: noAudioTxt,
			value: "none|none",
			html: `
        <div class="modern-option-row audio-grid">
            <span class="main-text">${noAudioTxt}</span>
        </div>
    `,
		});

		mountSlimSelect(audioForVideoSelectEl, audioForVideoOptions);
	}

	/**
	 * Shows the hidden panel with video information.
	 */
	_displayInfoPanel() {
		const info = this.state.videoInfo;
		const titleContainer = $(CONSTANTS.DOM_IDS.TITLE_CONTAINER);

		titleContainer.innerHTML = ""; // Clear previous content
		titleContainer.append(
			Object.assign(document.createElement("b"), {
				textContent: i18n.__("title") + ": ",
			}),
			Object.assign(document.createElement("input"), {
				className: "title",
				id: CONSTANTS.DOM_IDS.TITLE_INPUT,
				type: "text",
				value: `${info.title}`,
				onchange: (e) => (this.state.videoInfo.title = e.target.value),
			}),
		);

		document
			.querySelectorAll(CONSTANTS.DOM_IDS.URL_INPUTS)
			.forEach((el) => {
				el.value = info.url;
			});

		const hiddenPanel = $(CONSTANTS.DOM_IDS.HIDDEN_PANEL);
		hiddenPanel.style.display = "inline-block";
		hiddenPanel.classList.add("scaleUp");
	}

	/**
	 * Creates the initial UI element for a new download.
	 */
	_createDownloadUI(randomId, job) {
		const itemHTML = `
            <div class="item" id="${randomId}">
                <div class="itemIconBox">
                    <img src="${
						job.thumbnail || "../assets/images/thumb.png"
					}" alt="thumbnail" class="itemIcon" crossorigin="anonymous">
                    <span class="itemType">${i18n.__(
						job.type === "video" ? "video" : "audio",
					)}</span>
                </div>
                <img src="../assets/images/close.png" class="itemClose" id="${randomId}_close">
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
                    <strong class="itemSpeed" id="${randomId}_speed"></strong>
                    <div id="${randomId}_prog" class="itemProgress">${i18n.__(
						"preparing",
					)}</div>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML(
			"beforeend",
			itemHTML,
		);

		$(`${randomId}_close`).addEventListener("click", () =>
			this._cancelDownload(randomId),
		);
	}

	/**
	 * Updates the progress bar and speed for a download item.
	 */
	_updateProgressUI(randomId, progress) {
		const speedEl = $(`${randomId}_speed`);
		const progEl = $(`${randomId}_prog`);
		if (!speedEl || !progEl) return;

		let fillEl = progEl.querySelector(".custom-progress-fill");

		if (!fillEl) {
			progEl.innerHTML = "";

			const bar = document.createElement("div");
			bar.className = "custom-progress";

			fillEl = document.createElement("div");
			fillEl.className = "custom-progress-fill";

			bar.appendChild(fillEl);
			progEl.appendChild(bar);
		}

		if (progress.percent === 100) {
			fillEl.style.width = progress.percent + "%";
			speedEl.textContent = "";
			progEl.textContent = i18n.__("processing");
			ipcRenderer.send("progress", 0);

			return;
		}

		speedEl.textContent = `${i18n.__("speed")}: ${
			progress.currentSpeed || "0 B/s"
		}`;
		fillEl.style.width = progress.percent + "%";

		ipcRenderer.send("progress", progress.percent / 100);
	}

	/**
	 * Updates a download item's UI to show it has completed successfully.
	 */
	_showDownloadSuccessUI(randomId, actualFilePath, thumbnail) {
		const progressEl = $(`${randomId}_prog`);
		if (!progressEl) return;

		let fullPath;
		if (actualFilePath) {
			const isAbsolute =
				actualFilePath.startsWith("/") ||
				/^[a-zA-Z]:[\\\/]/.test(actualFilePath);
			fullPath = isAbsolute
				? actualFilePath
				: join(this.state.downloadDir, actualFilePath);
		}

		if (!fullPath) {
			console.error("Could not resolve downloaded file path.");

			return;
		}

		const expectedExt = fullPath.includes(".")
			? fullPath.split(".").pop()
			: "";

		// If file doesn't exist at the expected path, attempt to find it with a loose matching strategy
		if (
			!existsSync(fullPath) &&
			this.state.videoInfo &&
			this.state.videoInfo.title
		) {
			try {
				const originalTitle = this.state.videoInfo.title;
				const dirFiles = require("fs").readdirSync(
					this.state.downloadDir,
				);
				const looseTitle = originalTitle
					.replace(/[^a-zA-Z0-9]/g, "")
					.toLowerCase();

				const matchedFile = dirFiles.find((f) => {
					const cleanF = f.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
					return (
						cleanF.includes(looseTitle) &&
						(expectedExt
							? f
									.toLowerCase()
									.endsWith(expectedExt.toLowerCase())
							: true)
					);
				});

				if (matchedFile) {
					fullPath = join(this.state.downloadDir, matchedFile);
				}
			} catch (err) {
				console.error("Failed to execute loose filename recovery");
			}
		}

		// Extract just the filename
		const fullFilename = fullPath.split(/[\/\\]/).pop();
		const baseFilename =
			fullFilename.substring(0, fullFilename.lastIndexOf(".")) ||
			fullFilename;

		const ext = fullFilename.split(".").pop();

		progressEl.innerHTML = ""; // Clear progress bar
		const link = document.createElement("b");
		link.textContent = i18n.__("fileSavedClickToOpen");
		link.style.cursor = "pointer";
		link.onclick = () => {
			ipcRenderer.send("show-file", fullPath);
		};
		progressEl.appendChild(link);
		$(`${randomId}_speed`).textContent = "";

		// Send desktop notification
		new Notification("ytDownloader", {
			body: fullFilename,
			icon: thumbnail,
		}).onclick = () => {
			ipcRenderer.send("show-file", fullPath);
		};

		// Add to download history
		promises
			.stat(fullPath)
			.then((stat) => {
				const fileSize = stat.size || 0;
				ipcRenderer
					.invoke("add-to-history", {
						title: this.state.videoInfo.title,
						url: this.state.videoInfo.url,
						filename: baseFilename,
						filePath: fullPath,
						fileSize: fileSize,
						format: ext,
						thumbnail: thumbnail,
						duration: this.state.videoInfo.duration,
					})
					.catch((err) =>
						console.error("Error adding to history:", err),
					);
			})
			.catch((error) => console.error("Error saving to history:", error));
	}

	/**
	 * Shows an error message in the main UI.
	 */
	_showError(errorMessage, url) {
		$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent =
			i18n.__("errorNetworkOrUrl");
		$(CONSTANTS.DOM_IDS.ERROR_BTN).style.display = "inline-block";
		const errorDetails = $(CONSTANTS.DOM_IDS.ERROR_DETAILS);
		errorDetails.innerHTML = `<strong>URL: ${url}</strong><br><br>${errorMessage}`;
		errorDetails.title = i18n.__("clickToCopy");
	}

	/**
	 * Hides the info panel with an animation.
	 */
	_hideInfoPanel() {
		const panel = $(CONSTANTS.DOM_IDS.HIDDEN_PANEL);
		if (panel.style.display !== "none") {
			panel.classList.remove("scaleUp");
			panel.classList.add("scale");
			setTimeout(() => {
				panel.style.display = "none";
				panel.classList.remove("scale");
			}, 400);
		}
	}

	/**
	 * Displays a temporary popup message.
	 */
	_showPopup(text, isError = false) {
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
			}, 1000);
		}, 2200);
	}

	/**
	 * Hides the main menu.
	 */
	_closeMenu() {
		$(CONSTANTS.DOM_IDS.MENU_ICON).style.transform = "rotate(0deg)";
		$(CONSTANTS.DOM_IDS.MENU).style.opacity = "0";
		setTimeout(
			() => ($(CONSTANTS.DOM_IDS.MENU).style.display = "none"),
			500,
		);
	}

	/**
	 * Cancels a download in progress or removes it from the queue.
	 * @param {string} id The ID of the download item.
	 */
	_cancelDownload(id) {
		// If it's an active download
		if (this.state.downloadControllers.has(id)) {
			this.state.downloadControllers.get(id).abort();
		}
		// If it's in the queue
		this.state.downloadQueue = this.state.downloadQueue.filter(
			(job) => job.queueId !== id,
		);

		// If it has been downloaded, remove from the set
		this.state.downloadedItems.delete(id);

		this._fadeAndRemoveItem(id);
		this._updateClearAllButton();
	}

	/**
	 * Fades and removes a DOM element.
	 */
	_fadeAndRemoveItem(id) {
		const item = $(id);
		if (item) {
			item.classList.add("scale");
			setTimeout(() => item.remove(), 500);
		}
	}

	/**
	 * Removes all completed download items from the UI.
	 */
	_clearAllDownloaded() {
		this.state.downloadedItems.forEach((id) => this._fadeAndRemoveItem(id));
		this.state.downloadedItems.clear();
		this._updateClearAllButton();
	}

	/**
	 * Shows or hides the "Clear All" button based on the number of completed items.
	 */
	_updateClearAllButton() {
		const btn = $(CONSTANTS.DOM_IDS.CLEAR_BTN);
		btn.style.display =
			this.state.downloadedItems.size > 1 ? "inline-block" : "none";
	}

	/**
	 * Toggles between audio and video tabs
	 */
	_defaultVideoToggle() {
		let defaultWindow = "video";
		if (localStorage.getItem("defaultWindow")) {
			defaultWindow = localStorage.getItem("defaultWindow");
		}
		if (defaultWindow == "video") {
			selectVideo();
		} else {
			selectAudio();
		}
	}

	/**
	 * @param {string} timeString
	 */
	parseTime(timeString) {
		const parts = timeString.split(":").map((p) => parseInt(p.trim(), 10));

		let totalSeconds = 0;

		if (parts.length === 3) {
			// H:MM:SS format
			const [hrs, mins, secs] = parts;
			if (
				isNaN(hrs) ||
				isNaN(mins) ||
				isNaN(secs) ||
				mins < 0 ||
				mins > 59 ||
				secs < 0 ||
				secs > 59
			)
				return NaN;
			totalSeconds = hrs * 3600 + mins * 60 + secs;
		} else if (parts.length === 2) {
			// MM:SS format
			const [mins, secs] = parts;
			if (isNaN(mins) || isNaN(secs) || secs < 0 || secs > 59) return NaN;
			totalSeconds = mins * 60 + secs;
		} else if (parts.length === 1) {
			const [secs] = parts;
			if (isNaN(secs)) return NaN;
			totalSeconds = secs;
		} else {
			return NaN;
		}

		return totalSeconds;
	}

	_formatTime(duration) {
		if (duration === null) {
			return "";
		}

		const hrs = Math.floor(duration / 3600);
		const mins = Math.floor((duration % 3600) / 60);
		const secs = Math.floor(duration % 60);

		const paddedMins = String(mins).padStart(2, "0");
		const paddedSecs = String(secs).padStart(2, "0");

		if (hrs > 0) {
			// H:MM:SS format
			return `${hrs}:${paddedMins}:${paddedSecs}`;
		} else {
			// MM:SS format
			return `${paddedMins}:${paddedSecs}`;
		}
	}

	/**
	 * @param {HTMLElement} movedSlider
	 */
	_updateSliderUI(movedSlider) {
		const minSlider = $(CONSTANTS.DOM_IDS.MIN_SLIDER);
		const maxSlider = $(CONSTANTS.DOM_IDS.MAX_SLIDER);
		const minTimeDisplay = $(CONSTANTS.DOM_IDS.START_TIME);
		const maxTimeDisplay = $(CONSTANTS.DOM_IDS.END_TIME);
		const rangeHighlight = $(CONSTANTS.DOM_IDS.SLIDER_RANGE_HIGHLIGHT);

		let minValue = parseInt(minSlider.value);
		let maxValue = parseInt(maxSlider.value);
		const minSliderVal = parseInt(minSlider.min);
		const maxSliderVal = parseInt(minSlider.max);
		const sliderRange = maxSliderVal - minSliderVal;

		// Prevent sliders from crossing each other
		if (minValue >= maxValue) {
			if (movedSlider && movedSlider.id === "min-slider") {
				// Min must be at least 1 second less than Max
				minValue = Math.max(minSliderVal, maxValue - 1);
				minSlider.value = minValue;
			} else {
				// Max must be at least 1 second more than Min
				maxValue = Math.min(maxSliderVal, minValue + 1);
				maxSlider.value = maxValue;
			}
		}

		minTimeDisplay.value = this._formatTime(minValue);
		maxTimeDisplay.value = this._formatTime(maxValue);

		const minPercent = ((minValue - minSliderVal) / sliderRange) * 100;
		const maxPercent = ((maxValue - minSliderVal) / sliderRange) * 100;

		rangeHighlight.style.left = `${minPercent}%`;
		rangeHighlight.style.width = `${maxPercent - minPercent}%`;
	}

	/**
	 * @param {Event} e
	 */
	_handleTimeInputChange = (e) => {
		const input = e.target;
		let newSeconds = this.parseTime(input.value);
		const minSlider = $("min-slider");
		const maxSlider = $("max-slider");

		if (isNaN(newSeconds)) {
			input.value = this._formatTime(
				input.id === "min-time" ? minSlider.value : maxSlider.value,
			);
			return;
		}

		const minSliderVal = parseInt(minSlider.min);
		const maxSliderVal = parseInt(minSlider.max);
		newSeconds = Math.max(minSliderVal, Math.min(maxSliderVal, newSeconds));

		if (input.id === "min-time") {
			if (newSeconds >= parseInt(maxSlider.value)) {
				newSeconds = Math.max(
					minSliderVal,
					parseInt(maxSlider.value) - 1,
				);
			}
			minSlider.value = newSeconds;
		} else {
			if (newSeconds <= parseInt(minSlider.value)) {
				newSeconds = Math.min(
					maxSliderVal,
					parseInt(minSlider.value) + 1,
				);
			}
			maxSlider.value = newSeconds;
		}

		this._updateSliderUI(null);
	};

	/**
	 * Sets the maximum duration for the video and updates the slider's max range.
	 * @param {number} duration - The total length of the video in seconds (must be an integer >= 1).
	 */
	setVideoLength(duration) {
		const minSlider = $(CONSTANTS.DOM_IDS.MIN_SLIDER);
		const maxSlider = $(CONSTANTS.DOM_IDS.MAX_SLIDER);

		if (typeof duration !== "number" || duration < 1) {
			console.error(
				"Invalid duration provided to setVideoLength. Must be a number greater than 0.",
			);

			minSlider.max = 0;
			maxSlider.max = 0;

			minSlider.value = 0;
			maxSlider.value = 0;

			return;
		}

		minSlider.max = duration;
		maxSlider.max = duration;

		const defaultMin = 0;
		const defaultMax = duration;

		minSlider.value = defaultMin;
		maxSlider.value = defaultMax;

		this._updateSliderUI(null);
	}

	/**
	 * Validates a URL and returns the sanitized version.
	 * @param {string} rawUrl - The URL to validate.
	 * @returns {string} - The sanitized URL.
	 * @throws {Error} - If the URL is invalid.
	 */
	validateUrl(rawUrl) {
		const input = String(rawUrl ?? "").trim();

		let parsed;
		try {
			parsed = new URL(input);
		} catch {
			throw new Error("invalidUrl");
		}

		return parsed.toString();
	}
}

// --- Application Entry Point ---
document.addEventListener("DOMContentLoaded", () => {
	const app = new YtDownloaderApp();
	app.initialize();
});
