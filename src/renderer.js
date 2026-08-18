import {
	getId as $,
	showPopup,
	formatTime,
	findFfmpeg,
	ensureFfmpegLibsLoadable,
	getJsRuntimePath,
} from "./utils.js";
import {selectVideo, selectAudio} from "./index.js";

const {
	shell,
	ipcRenderer,
	clipboard,
	YTDlpWrap,
	constants,
	homedir,
	platform,
	tmpdir,
	join,
	mkdirSync,
	accessSync,
	promises,
	existsSync,
	cpSync,
	copyFileSync,
	writeFileSync,
	unlinkSync,
	readFileSync,
	readdirSync,
	statSync,
	execSync,
	spawn,
	env,
	setEnv,
	windowsStore,
	__dirname,
	dirname,
} = window.electronAPI;

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
		MULTIPLE_MODE_SECTION: "multipleModeSection",
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
		HOME_OUTPUT_FORMAT_SELECT: "homeOutputFormatSelect",
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
		COOKIE_SOURCE: "cookieSource",
		NETSCAPE_COOKIES: "netscapeCookies",
		BROWSER_COOKIES: "browser",
		PROXY: "proxy",
		AUTO_UPDATE: "autoUpdate",
		CLOSE_TO_TRAY: "closeToTray",
		YT_DLP_CUSTOM_ARGS: "customYtDlpArgs",
		YT_DLP_SOURCE: "ytdlpSource",
		AUTO_DOWNLOAD_ON_PASTE: "autoDownloadOnPaste",
	},
	// yt-dlp source selectable in preferences.
	// "nightly": app-managed standalone binary kept on the nightly channel.
	// "system": use the yt-dlp found in PATH (managed by apt/pip/brew/etc.).
	YT_DLP_SOURCE: {
		NIGHTLY: "nightly",
		SYSTEM: "system",
	},
};

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
			isFetchingInfo: false,
			// Video metadata
			videoInfo: {
				title: "",
				channel: "",
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
				cookieSource: "none",
				cookiesPath: "",
				netscapeCookies: "",
				browserForCookies: "",
				customYtDlpArgs: "",
				videoOutputTemplate: "%(title)s.%(ext)s",
				audioOutputTemplate: "%(title)s.%(ext)s",
			},
			downloadControllers: new Map(),
			downloadedItems: new Set(),
			downloadQueue: [],
			mode: "single",
			batchQueue: [],
			batchPreset: {
				type: "video",
				quality: "1080",
				format: "mp4",
			},
			isAutoMode:
				localStorage.getItem("autoDownloadOnPaste") === "true",
			activeInfoJsonPaths: new Map(),
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
		this._configureGlobalHotkey();
		this._configureAutoUpdate();

		try {
			const isTestMode = Boolean(
				window.electronAPI && window.electronAPI.isTest,
			);
			const mockYtDlp = isTestMode ? window.__mockYtDlp : null;
			this.state.ytDlpPath = mockYtDlp
				? "mock-ytdlp"
				: await this._findOrDownloadYtDlp();
			this.state.ytDlp = mockYtDlp || YTDlpWrap.new(this.state.ytDlpPath);
			this.state.ffmpegPath = mockYtDlp
				? "ffmpeg"
				: await findFfmpeg();
			ensureFfmpegLibsLoadable(this.state.ffmpegPath);
			this.state.jsRuntimePath = mockYtDlp
				? ""
				: await getJsRuntimePath();

			window.AppBinaries = {
				ytDlpPath: this.state.ytDlpPath,
				ytDlp: this.state.ytDlp,
				ffmpegPath: this.state.ffmpegPath,
				jsRuntimePath: this.state.jsRuntimePath,
			};

			console.log("yt-dlp path:", this.state.ytDlpPath);
			console.log("ffmpeg path:", this.state.ffmpegPath);
			console.log("JS runtime:", this.state.jsRuntimePath);

			window.addEventListener("ytdownloader-reload-binaries", () => {
				this.reloadBinaries();
			});

			// Defer background cleanup of orphaned temp files so it doesn't block startup
			setTimeout(() => {
				this._cleanupTempFiles();
			}, 1000);

			// Synchronously clean up the active session's info JSON on exit
			window.addEventListener("beforeunload", () => {
				if (this.state.videoInfo?.infoJsonPath) {
					try {
						if (existsSync(this.state.videoInfo.infoJsonPath)) {
							unlinkSync(this.state.videoInfo.infoJsonPath);
						}
					} catch (_) {}
				}
			});

			this._addEventListeners();
			this._syncPresetDefaultsFromPreferences();
			this._updateAutoModeUI();
			this._updateEmptyStateUI();
		} catch (error) {
			console.error("Initialization failed:", error);
			$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = error.message;
			const pasteBtn = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);
			if (pasteBtn) pasteBtn.style.display = "none";
		}
	}

	/**
	 * Dynamically re-resolves binary paths (yt-dlp, ffmpeg) in-memory
	 * without requiring an application window reload.
	 */
	async reloadBinaries() {
		if (this._reloadingBinariesPromise) {
			await this._reloadingBinariesPromise;
		}

		this._reloadingBinariesPromise = (async () => {
			try {
				const isTestMode = Boolean(
					window.electronAPI && window.electronAPI.isTest,
				);
				const mockYtDlp = isTestMode ? window.__mockYtDlp : null;

				const ytdlpSource =
					localStorage.getItem(
						CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_SOURCE,
					) || "bundled";
				if (
					ytdlpSource === CONSTANTS.YT_DLP_SOURCE.SYSTEM ||
					ytdlpSource === "system"
				) {
					localStorage.removeItem(
						CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH,
					);
				}
				const ytDlpPath = mockYtDlp
					? "mock-ytdlp"
					: await this._findOrDownloadYtDlp();
				const ytDlp = mockYtDlp || YTDlpWrap.new(ytDlpPath);

				const ffmpegPath = mockYtDlp
					? "ffmpeg"
					: await findFfmpeg();
				ensureFfmpegLibsLoadable(ffmpegPath);

				const jsRuntimePath = mockYtDlp
					? ""
					: await getJsRuntimePath();

				// Atomic update of state once all resolvers complete
				this.state.ytDlpPath = ytDlpPath;
				this.state.ytDlp = ytDlp;
				this.state.ffmpegPath = ffmpegPath;
				this.state.jsRuntimePath = jsRuntimePath;

				window.AppBinaries = {
					ytDlpPath: this.state.ytDlpPath,
					ytDlp: this.state.ytDlp,
					ffmpegPath: this.state.ffmpegPath,
					jsRuntimePath: this.state.jsRuntimePath,
				};

				console.log(
					"Re-resolved binary paths in-memory:",
					window.AppBinaries,
				);
			} catch (error) {
				console.error("Binary re-resolution failed:", error);
			}
		})();

		try {
			await this._reloadingBinariesPromise;
		} finally {
			this._reloadingBinariesPromise = null;
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

		const pathEl = $(CONSTANTS.DOM_IDS.PATH_DISPLAY);
		if (pathEl) pathEl.textContent = this.state.downloadDir;
		this._updateHomePathDisplay();

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
	 * Restores the global hotkey setting from localStorage on startup.
	 */
	_configureGlobalHotkey() {
		if (localStorage.getItem("globalHotkeyEnabled") === "true") {
			const defaultAccel = platform() === "darwin" ? "Cmd+Shift+D" : "Ctrl+Shift+D";
			const accelerator = localStorage.getItem("globalHotkeyAccelerator") || defaultAccel;
			ipcRenderer.send("useGlobalHotkey", { enabled: true, accelerator });
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
		if (windowsStore || (env && env.YTDOWNLOADER_AUTO_UPDATES === "0")) {
			autoUpdate = false;
		}
		ipcRenderer.send("autoUpdate", autoUpdate);
	}

	/**
	 * Waits for the i18n module to load and then translates the static page content.
	 */
	async _initializeTranslations() {
		if (window.i18n && window.i18n.translations) {
			window.i18n.translatePage();
			return;
		}
		return new Promise((resolve) => {
			const handler = () => {
				if (window.i18n) window.i18n.translatePage();
				resolve();
			};
			document.addEventListener("translations-loaded", handler, {
				once: true,
			});
			setTimeout(() => {
				if (window.i18n && window.i18n.translatePage) {
					window.i18n.translatePage();
				}
				resolve();
			}, 100);
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

		let executablePath = null;

		// PRIORITY 1: Environment Variable
		if (env && env.YTDOWNLOADER_YTDLP_PATH) {
			if (existsSync(env.YTDOWNLOADER_YTDLP_PATH)) {
				executablePath = env.YTDOWNLOADER_YTDLP_PATH;
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

		// PRIORITY 3: User-selected source (Windows/Linux)
		else {
			const source =
				localStorage.getItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_SOURCE,
				) || CONSTANTS.YT_DLP_SOURCE.NIGHTLY;

			// "system": use yt-dlp from PATH (apt/pip/etc.). Falls back to the
			// managed binary if nothing is found in PATH.
			if (
				source === CONSTANTS.YT_DLP_SOURCE.SYSTEM ||
				source === "system"
			) {
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

				const releaseChannel =
					localStorage.getItem("ytdlpChannel") || "nightly";

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
				const releaseChannel =
					localStorage.getItem("ytdlpChannel") || "nightly";
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
					releaseChannel,
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
				$("popup").appendChild(tryAgainBtn);

				throw new Error("Failed to download yt-dlp.");
			}
		}
	}

	/**
	 * Loads various settings from localStorage into the application state.
	 */
	async _loadSettings(url, updateUI = true) {
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

		prefs.cookieSource =
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.COOKIE_SOURCE) ||
			(localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.BROWSER_COOKIES)
				? "browser"
				: "none");
		prefs.netscapeCookies =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.NETSCAPE_COOKIES,
			) || "";
		try {
			prefs.cookiesPath = await ipcRenderer.invoke("get-cookies-path");
			if (
				prefs.cookieSource === "file" &&
				prefs.cookiesPath &&
				prefs.netscapeCookies &&
				prefs.netscapeCookies.trim()
			) {
				writeFileSync(prefs.cookiesPath, prefs.netscapeCookies, {
					encoding: "utf8",
					mode: 0o600,
				});
			}
		} catch (e) {
			console.error("Error setting up cookies path:", e);
		}

		prefs.browserForCookies =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.BROWSER_COOKIES,
			) || "";
		prefs.customYtDlpArgs =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_CUSTOM_ARGS,
			) || "";
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

		if (updateUI) {
			const customArgsInput = $(CONSTANTS.DOM_IDS.CUSTOM_ARGS_INPUT);
			if (customArgsInput) customArgsInput.value = prefs.customYtDlpArgs;
		}

		const downloadDir = localStorage.getItem(
			CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH,
		);

		if (downloadDir) {
			this.state.downloadDir = downloadDir;
			if (updateUI) {
				const pathEl = $(CONSTANTS.DOM_IDS.PATH_DISPLAY);
				if (pathEl) pathEl.textContent = downloadDir;
				this._updateHomePathDisplay();
			}
		}

		// Sync quick preset defaults from preferences
		const qualitySelect = document.getElementById("presetQualitySelect");
		if (qualitySelect && prefs.videoQuality) {
			const matchingOpt = Array.from(qualitySelect.options).find(
				(opt) => opt.value === String(prefs.videoQuality),
			);
			if (matchingOpt) {
				qualitySelect.value = String(prefs.videoQuality);
				this.state.batchPreset.quality = String(prefs.videoQuality);
			}
		}
	}

	/**
	 * Returns yt-dlp cookie arguments based on user preference.
	 * @returns {string[]}
	 */
	_getCookieArgs() {
		const {cookieSource, browserForCookies, cookiesPath} =
			this.state.preferences;
		if (
			cookieSource === "file" &&
			cookiesPath &&
			existsSync(cookiesPath) &&
			statSync(cookiesPath).size > 0
		) {
			return ["--cookies", cookiesPath];
		}
		if (cookieSource === "browser" && browserForCookies) {
			return ["--cookies-from-browser", browserForCookies];
		}
		return [];
	}

	/**
	 * Attaches all necessary event listeners for the UI.
	 */
	_addEventListeners() {
		$(CONSTANTS.DOM_IDS.PASTE_URL_BTN)?.addEventListener("click", () =>
			this.pasteAndGetInfo(),
		);

		// Mode switcher listeners
		document
			.getElementById("modeSingleBtn")
			?.addEventListener("click", () => this._switchHomeMode("single"));
		document
			.getElementById("modeMultipleBtn")
			?.addEventListener("click", () => this._switchHomeMode("multiple"));
		document
			.getElementById("autoDownloadToggleBtn")
			?.addEventListener("click", () => {
				this.state.isAutoMode = !this.state.isAutoMode;
				localStorage.setItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.AUTO_DOWNLOAD_ON_PASTE,
					this.state.isAutoMode ? "true" : "false",
				);
				this._updateAutoModeUI();
			});
		document
			.getElementById("homePathPicker")
			?.addEventListener("click", () =>
				ipcRenderer.send("select-location-main", ""),
			);

		// Batch controls listeners
		document
			.getElementById("pasteBatchClipboardBtn")
			?.addEventListener("click", () => {
				const text = clipboard.readText();
				const textarea = document.getElementById("batchUrlsInput");
				if (textarea) textarea.value = text;
			});
		document
			.getElementById("startBatchBtn")
			?.addEventListener("click", () => this._startBatchDownloads());
		document
			.getElementById("stopBatchBtn")
			?.addEventListener("click", () => this._stopBatchDownloads());
		document
			.getElementById("presetVideoBtn")
			?.addEventListener("click", () =>
				this._setBatchPresetType("video"),
			);
		document
			.getElementById("presetAudioBtn")
			?.addEventListener("click", () =>
				this._setBatchPresetType("audio"),
			);
		document
			.getElementById("presetQualitySelect")
			?.addEventListener("change", (e) => {
				this.state.batchPreset.quality = e.target.value;
			});
		document
			.getElementById("presetFormatSelect")
			?.addEventListener("change", (e) => {
				this.state.batchPreset.format = e.target.value;
			});

		$(CONSTANTS.DOM_IDS.SEARCH_BTN)?.addEventListener("click", () => {
			const query = $(CONSTANTS.DOM_IDS.SEARCH_INPUT).value.trim();
			if (query) {
				this.searchYoutube(query);
			}
		});
		$(CONSTANTS.DOM_IDS.SEARCH_INPUT)?.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Enter") {
					const query = $(
						CONSTANTS.DOM_IDS.SEARCH_INPUT,
					).value.trim();
					if (query) {
						this.searchYoutube(query);
					}
				}
			},
		);
		document.addEventListener("keydown", (event) => {
			const viewHome = document.getElementById("view-home");
			if (!viewHome || viewHome.classList.contains("hidden")) return;

			const isCtrlV =
				(event.ctrlKey || (event.metaKey && platform() === "darwin")) &&
				(event.key?.toLowerCase() === "v" || event.code === "KeyV");

			const isInput =
				document.activeElement &&
				(document.activeElement.tagName === "INPUT" ||
					document.activeElement.tagName === "TEXTAREA" ||
					document.activeElement.isContentEditable);
			
			const isNotBatchView = this.state.mode === "single";

			if (isCtrlV && !isInput && isNotBatchView) {
				const pasteBtnInner = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);

				if (pasteBtnInner && pasteBtnInner.disabled) return;

				pasteBtnInner?.classList.add("active");

				setTimeout(() => {
					pasteBtnInner?.classList.remove("active");
				}, 150);

				this.pasteAndGetInfo();
			}
		});

		// Download buttons
		$(CONSTANTS.DOM_IDS.VIDEO_DOWNLOAD_BTN)?.addEventListener("click", () =>
			this.handleDownloadRequest("video"),
		);
		$(CONSTANTS.DOM_IDS.AUDIO_DOWNLOAD_BTN)?.addEventListener("click", () =>
			this.handleDownloadRequest("audio"),
		);
		$(CONSTANTS.DOM_IDS.EXTRACT_BTN)?.addEventListener("click", () =>
			this.handleDownloadRequest("extract"),
		);

		// UI controls
		$(CONSTANTS.DOM_IDS.CLOSE_HIDDEN_BTN)?.addEventListener("click", () =>
			this._hideInfoPanel(),
		);
		$(CONSTANTS.DOM_IDS.SELECT_LOCATION_BTN)?.addEventListener(
			"click",
			() => ipcRenderer.send("select-location-main", ""),
		);
		$(CONSTANTS.DOM_IDS.CLEAR_BTN)?.addEventListener("click", () =>
			this._clearAllDownloaded(),
		);

		// Error details
		$(CONSTANTS.DOM_IDS.ERROR_DETAILS)?.addEventListener("click", (e) => {
			// @ts-ignore
			clipboard.writeText(e.target.innerText);
			this._showPopup(i18n.__("copiedText"), false);
		});

		$(CONSTANTS.DOM_IDS.QUIT_APP_BTN)?.addEventListener("click", () => {
			ipcRenderer.send("quit", "quit");
		});

		// IPC listeners
		ipcRenderer.on("link", (event, text) => this.getInfo(text));
		ipcRenderer.on("downloadPath", (event, downloadPath) => {
			try {
				accessSync(downloadPath[0], constants.W_OK);

				const newPath = downloadPath[0];
				const pathEl = $(CONSTANTS.DOM_IDS.PATH_DISPLAY);
				if (pathEl) pathEl.textContent = newPath;
				this.state.downloadDir = newPath;
				this._updateHomePathDisplay();
			} catch (error) {
				console.log(error);
				this._showPopup(i18n.__("unableToAccessDir"), true);
			}
		});

		ipcRenderer.on("download-progress", (_event, percent) => {
			if (typeof percent === "number") {
				const popup = $(CONSTANTS.DOM_IDS.UPDATE_POPUP);
				const textEl = $(CONSTANTS.DOM_IDS.UPDATE_POPUP_PROGRESS);
				const barEl = $(CONSTANTS.DOM_IDS.UPDATE_POPUP_BAR);

				if (popup) popup.style.display = "flex";
				if (textEl) textEl.textContent = `${percent.toFixed(1)}%`;
				if (barEl) barEl.style.width = `${percent}%`;
			}
		});

		ipcRenderer.on("update-downloaded", (_event, _) => {
			$(CONSTANTS.DOM_IDS.UPDATE_POPUP).style.display = "none";
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

		const searchLoading =
			document.getElementById("loadingWrapperSearch") ||
			$(CONSTANTS.DOM_IDS.LOADING_WRAPPER);
		if (searchLoading) searchLoading.style.display = "flex";

		try {
			await this._loadSettings("https://youtube.com");
			const {proxy} = this.state.preferences;
			const args = [
				"--flat-playlist",
				"-j",
				"--no-warnings",
				...(proxy ? ["--proxy", proxy] : []),
				...this._getCookieArgs(),
				...(this.state.jsRuntimePath
					? [
							"--no-js-runtimes",
							"--js-runtime",
							this.state.jsRuntimePath,
						]
					: []),
				"--",
				`ytsearch12:${query}`,
			];

			const results = await new Promise((resolve, reject) => {
				const process = this.state.ytDlp.exec(args, {shell: false});
				let stdout = "";
				let stderr = "";

				const onBeforeUnload = () => {
					if (process && !process.killed) {
						process.kill();
					}
				};
				window.addEventListener("beforeunload", onBeforeUnload);

				process.ytDlpProcess.stdout.on("data", (data) => {
					stdout += data;
				});
				process.ytDlpProcess.stderr.on("data", (data) => {
					stderr += data;
				});

				process.on("close", () => {
					window.removeEventListener("beforeunload", onBeforeUnload);
					const items = [];
					if (stdout) {
						const lines = stdout.split(/\r?\n/);
						for (const line of lines) {
							if (line.trim()) {
								try {
									items.push(JSON.parse(line));
								} catch (e) {
									console.error(
										"Failed to parse search line:",
										e,
									);
								}
							}
						}
					}
					resolve(items);
				});

				process.on("error", (err) => {
					window.removeEventListener("beforeunload", onBeforeUnload);
					reject(err);
				});
			});

			this._renderSearchResults(results);
		} catch (error) {
			console.error("Search failed:", error);
			$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = error.message;
		} finally {
			if (searchLoading) searchLoading.style.display = "none";
			$(CONSTANTS.DOM_IDS.LOADING_WRAPPER).style.display = "none";
			const pasteBtn = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);
			if (pasteBtn) pasteBtn.disabled = false;
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
				if (window.switchView) {
					window.switchView("view-home");
				}
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
				durationBadge.textContent =
					item.duration_string ||
					this._formatTime(Math.ceil(item.duration));
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
		const pasteBtn = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);
		if (pasteBtn && pasteBtn.disabled) return;
		if (this.state.isFetchingInfo) return;
		this.getInfo(clipboard.readText());
	}

	/**
	 * Fetches video metadata from a given URL.
	 * @param {string} url The video URL.
	 */
	async getInfo(url) {
		const pasteBtn = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);
		if (pasteBtn && pasteBtn.disabled) return;
		if (this.state.isFetchingInfo) return;

		this.state.isFetchingInfo = true;
		if (pasteBtn) pasteBtn.disabled = true;

		let safeUrl;
		try {
			safeUrl = this.validateUrl(url);
		} catch {
			$(CONSTANTS.DOM_IDS.ERROR_BTN).textContent =
				i18n.__("errorDetails") + " ◀";
			this._showError(i18n.__("invalidUrl"), url);
			this.state.isFetchingInfo = false;
			if (pasteBtn) pasteBtn.disabled = false;

			return;
		}

		await this._loadSettings(safeUrl);
		this._defaultVideoToggle();
		this._resetUIForNewLink();

		this.state.videoInfo.url = safeUrl;

		try {
			const metadata = await this._fetchVideoMetadata(safeUrl);
			console.log(metadata);

			const isLive = Boolean(
				metadata.is_live ||
				metadata.live_status === "is_live" ||
				metadata.duration == null ||
				metadata.duration === 0,
			);
			const durationInt =
				metadata.duration == null || metadata.duration <= 0
					? null
					: Math.ceil(metadata.duration);

			this.state.videoInfo = {
				...this.state.videoInfo,
				id: metadata.id,
				title: metadata.title,
				channel: metadata.channel || "",
				thumbnail: metadata.thumbnail,
				duration: durationInt,
				is_live: isLive,
				extractor_key: metadata.extractor_key,
				infoJsonPath: metadata._infoJsonPath || null,
				infoJsonFetchedAt: metadata._infoJsonFetchedAt || null,
			};
			this.setVideoLength(durationInt);
			this._populateFormatSelectors(metadata.formats || []);

			if (this.state.mode === "single" && this.state.isAutoMode) {
				this.handleDownloadRequest(this.state.batchPreset.type);
			} else {
				this._displayInfoPanel();
			}
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
			this.state.isFetchingInfo = false;
			$(CONSTANTS.DOM_IDS.LOADING_WRAPPER).style.display = "none";
			if (pasteBtn) pasteBtn.disabled = false;
		}
	}

	/**
	 * Handles a download request, either starting it immediately or queuing it.
	 * @param {'video' | 'audio' | 'extract'} type The type of download.
	 */
	handleDownloadRequest(type) {
		this._updateDownloadOptionsFromUI();
		this._hideInfoPanel(true);

		const presetQuality = document.getElementById(
			"presetQualitySelect",
		)?.value;
		const presetFormat =
			document.getElementById("presetFormatSelect")?.value;
		const videoFormatVal =
			$(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT)?.value ||
			(presetQuality ? presetQuality : "1080");
		const audioFormatVal =
			$(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT)?.value ||
			presetFormat ||
			"mp3";
		const extractFormatVal =
			$(CONSTANTS.DOM_IDS.EXTRACT_SELECTION)?.value ||
			presetFormat ||
			"mp3";

		const isAuto = Boolean(
			this.state.isAutoMode && this.state.mode === "single",
		);
		const isBatch = Boolean(this.state.mode === "multiple");

		const downloadJob = {
			type: type || this.state.batchPreset.type,
			url: this.state.videoInfo.url,
			title: this.state.videoInfo.title,
			channel: this.state.videoInfo.channel,
			thumbnail: this.state.videoInfo.thumbnail,
			duration: this.state.videoInfo.duration,
			infoJsonPath: this.state.videoInfo.infoJsonPath,
			infoJsonFetchedAt: this.state.videoInfo.infoJsonFetchedAt,
			options: {...this.state.downloadOptions},
			isAuto,
			isBatch,
			presetQuality:
				presetQuality || this.state.batchPreset.quality || "1080",
			presetFormat:
				presetFormat ||
				this.state.batchPreset.format ||
				(type === "video" ? "mp4" : "mp3"),
			// Capture UI values at the moment of click
			uiSnapshot: {
				videoFormat: videoFormatVal,
				audioForVideoFormat:
					$(CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT)?.value ||
					"best",
				audioFormat: audioFormatVal,
				extractFormat: extractFormatVal,
				extractQuality:
					$(CONSTANTS.DOM_IDS.EXTRACT_QUALITY_SELECT)?.value || "0",
				outputFormat:
					$(CONSTANTS.DOM_IDS.HOME_OUTPUT_FORMAT_SELECT)?.value ||
					"auto",
			},
		};

		if (this.state.currentDownloads < this.state.maxActiveDownloads) {
			this._startDownload(downloadJob);
		} else {
			this._queueDownload(downloadJob);
		}
	}

	/**
	 * Executes yt-dlp to get video metadata in JSON format.
	 * @param {string} url The video URL.
	 * @returns {Promise<object>} A promise that resolves with the parsed JSON metadata.
	 */
	_fetchVideoMetadata(url) {
		return new Promise((resolve, reject) => {
			const {proxy} = this.state.preferences;
			const args = [
				"-j",
				"--no-playlist",
				"--no-warnings",

				...(proxy ? ["--proxy", proxy] : []),

				...this._getCookieArgs(),

				...(this.state.jsRuntimePath
					? [
							"--no-js-runtimes",
							"--js-runtime",
							this.state.jsRuntimePath,
						]
					: []),

				"--",
				url,
			];

			const process = this.state.ytDlp.exec(args, {shell: false});

			const onBeforeUnload = () => {
				if (process && !process.killed) {
					process.kill();
				}
			};
			window.addEventListener("beforeunload", onBeforeUnload);

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
				window.removeEventListener("beforeunload", onBeforeUnload);
				if (stdout) {
					try {
						const metadata = JSON.parse(stdout);
						const randomId =
							"meta_" + Math.random().toString(36).substring(2, 10);
						const safeId = (metadata.id || "video").replace(
							/[^a-zA-Z0-9_-]/g,
							"",
						);
						const infoJsonPath = join(
							tmpdir(),
							`ytdlp_info_${safeId}_${randomId}.info.json`,
						);
						try {
							writeFileSync(infoJsonPath, stdout, "utf8");
							metadata._infoJsonPath = infoJsonPath;
							metadata._infoJsonFetchedAt = Date.now();
						} catch (writeErr) {
							console.warn(
								"Failed to write temporary info.json:",
								writeErr,
							);
						}
						resolve(metadata);
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

			process.on("error", (err) => {
				window.removeEventListener("beforeunload", onBeforeUnload);
				reject(err);
			});
		});
	}

	/**
	 * Starts the download process for a given job.
	 * @param {object} job The download job object.
	 */
	_startDownload(job) {
		this.state.currentDownloads++;
		const randomId = "item_" + Math.random().toString(36).substring(2, 12);

		this._createDownloadUI(randomId, job);
		this._updateEmptyStateUI();

		const controller = new AbortController();
		controller.isBatch = !!job.isBatch;
		this.state.downloadControllers.set(randomId, controller);

		this._runDownloadProcess(randomId, job, controller);
	}

	/**
	 * Executes the yt-dlp download process with automatic fallback to live URL if --load-info-json fails.
	 * @param {string} randomId The unique identifier for the download UI item.
	 * @param {object} job The download job configuration and snapshot.
	 * @param {AbortController} controller Abort controller for cancelling the download process.
	 */
	_runDownloadProcess(randomId, job, controller) {
		const {downloadArgs, tempFilePath} = this._prepareDownloadArgs(job);

		let didRetain = false;
		if (job.usingInfoJson && !job._forceLiveUrl) {
			this._retainInfoJson(job.infoJsonPath);
			didRetain = true;
		}

		const downloadProcess = this.state.ytDlp.exec(downloadArgs, {
			shell: false,
			signal: controller.signal,
		});

		const onBeforeUnload = () => {
			if (downloadProcess && !downloadProcess.killed) {
				downloadProcess.kill();
			}
		};
		window.addEventListener("beforeunload", onBeforeUnload);

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
				window.removeEventListener("beforeunload", onBeforeUnload);
				if (existsSync(tempFilePath)) {
					try {
						const fileContent = readFileSync(
							tempFilePath,
							"utf-8",
						).trim();
						if (fileContent) {
							actualFilePath = fileContent;
						}
						unlinkSync(tempFilePath);
					} catch (e) {
						console.error("Error reading temp file:", e);
					}
				}

				if (
					code !== 0 &&
					didRetain &&
					!job._forceLiveUrl &&
					!controller.signal.aborted
				) {
					console.warn(
						`Download with --load-info-json failed (exit code ${code}). Retrying with live URL...`,
					);
					this._releaseInfoJson(job.infoJsonPath);
					didRetain = false;
					job._forceLiveUrl = true;
					const el = $(`${randomId}_prog`);
					if (el) el.textContent = i18n.__("downloading");
					this._runDownloadProcess(randomId, job, controller);
					return;
				}

				if (didRetain) {
					this._releaseInfoJson(job.infoJsonPath);
					didRetain = false;
				}
				this._handleDownloadCompletion(
					code,
					randomId,
					actualFilePath,
					job,
					controller,
				);
			})
			.once("error", (error) => {
				window.removeEventListener("beforeunload", onBeforeUnload);
				if (existsSync(tempFilePath)) {
					try {
						unlinkSync(tempFilePath);
					} catch (e) {}
				}

				if (
					didRetain &&
					!job._forceLiveUrl &&
					!controller.signal.aborted
				) {
					console.warn(
						"Download with --load-info-json encountered error. Retrying with live URL:",
						error,
					);
					this._releaseInfoJson(job.infoJsonPath);
					didRetain = false;
					job._forceLiveUrl = true;
					const el = $(`${randomId}_prog`);
					if (el) el.textContent = i18n.__("downloading");
					this._runDownloadProcess(randomId, job, controller);
					return;
				}

				if (didRetain) {
					this._releaseInfoJson(job.infoJsonPath);
					didRetain = false;
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
            <div class="item item-fade-in" id="${randomId}">
                <div class="itemIconBox">
                    <img src="${
						job.thumbnail || "../assets/images/thumb.png"
					}" alt="thumbnail" class="itemIcon" crossorigin="anonymous" onload="this.parentElement.classList.add('loaded')" onerror="this.onerror=null;this.src='../assets/images/thumb.png';this.parentElement.classList.add('loaded');">
                    ${
						this._isSafeWebUrl(job.thumbnail)
							? `<button id="${randomId}_thumbOpen" class="openThumbBtn" title="${i18n.__(
									"thumbnail",
								)}"><img src="../assets/images/external-link.png" alt="Open Thumbnail"/></button>`
							: ""
					}
                    <span class="itemType">${i18n.__(
						job.type === "video" ? "video" : "audio",
					)}</span>
                </div>
                <img src="../assets/images/close.png" class="itemClose" id="${randomId}_close">
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
					<div class="itemChannel">${job.channel}</div>
					<div class="speedContainer">
						<span class="itemSpeed" id="${randomId}_speed"></span>
					</div>
                    <div id="${randomId}_prog" class="itemProgress">${i18n.__(
						"preparing",
					)}</div>
					<button id="${randomId}_openBtn" class="openFileBtn"><img class="btnIcon" src="../assets/images/external-link.png"/>${i18n.__("openFile")}</button>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML(
			"beforeend",
			itemHTML,
		);

		$(`${randomId}_close`)?.addEventListener("click", () =>
			this._cancelDownload(randomId),
		);

		if (this._isSafeWebUrl(job.thumbnail)) {
			$(`${randomId}_thumbOpen`)?.addEventListener("click", (e) => {
				e.stopPropagation();
				try {
					const u = new URL(job.thumbnail);
					if (u.protocol === "http:" || u.protocol === "https:") {
						shell.openExternal(job.thumbnail);
					}
				} catch (err) {
					console.error("Invalid thumbnail URL:", err);
				}
			});
		}
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

			if (nextJob.isBatch && this.state.isBatchCancelled) {
				this._processQueue();
				return;
			}

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
			videoOutputTemplate,
			audioOutputTemplate,
		} = this.state.preferences;

		let format_id, ext, audioForVideoFormat_id, audioFormat;

		let template = videoOutputTemplate;

		const outputArgs = ["-P", this.state.downloadDir, "-o", template];

		const baseArgs = [
			"--no-playlist",
			"--no-mtime",

			...this._getCookieArgs(),

			...(proxy ? ["--proxy", proxy] : []),

			"--ffmpeg-location",
			this.state.ffmpegPath,

			...(this.state.jsRuntimePath
				? ["--no-js-runtimes", "--js-runtime", this.state.jsRuntimePath]
				: []),
		];

		let downloadArgs = [];

		if (job.isBatch || job.isAuto) {
			const presetQuality =
				job.presetQuality || uiSnapshot.videoFormat || "1080";
			const presetFormat =
				job.presetFormat ||
				uiSnapshot.audioFormat ||
				(type === "video" ? "mp4" : "mp3");
			const isYouTube =
				url &&
				(url.includes("youtube.com/") || url.includes("youtu.be/"));
			const canEmbedThumb = platform() !== "darwin";

			if (type === "video") {
				template = videoOutputTemplate;
				let formatArgs = [];
				if (presetFormat === "mp4") {
					formatArgs = [
						"-f",
						`bestvideo[height<=${presetQuality}]+bestaudio[ext=m4a]/best[height<=${presetQuality}]/best`,
						"--merge-output-format",
						"mp4",
						// TODO: Consider doing a smart selection between remux/recode in future
						"--recode-video",
						"mp4",
					];
				} else if (presetFormat === "webm") {
					formatArgs = [
						"-f",
						`bestvideo[height<=${presetQuality}]+bestaudio[ext=webm]/best[height<=${presetQuality}]/best`,
						"--merge-output-format",
						"webm",
						"--recode-video",
						"webm",
					];
				} else {
					formatArgs = [
						"-f",
						`bv*[height<=${presetQuality}]+ba/best[height<=${presetQuality}]/best`,
						"--merge-output-format",
						presetFormat || "mkv",
					];
				}

				baseArgs.unshift("--embed-metadata");
				if (presetFormat === "mp4" && isYouTube && canEmbedThumb) {
					baseArgs.unshift("--embed-thumbnail");
				}

				const batchOutputArgs = [
					"-P",
					this.state.downloadDir,
					"-o",
					template,
				];
				downloadArgs = [...formatArgs, ...batchOutputArgs, ...baseArgs];
			} else {
				// Audio mode in batch
				template = audioOutputTemplate;
				const batchOutputArgs = [
					"-P",
					this.state.downloadDir,
					"-o",
					template,
				];
				baseArgs.unshift("--embed-metadata");
				if (
					(presetFormat === "mp3" ||
						(presetFormat === "m4a" && isYouTube)) &&
					canEmbedThumb
				) {
					baseArgs.unshift("--embed-thumbnail");
				}

				downloadArgs = [
					"-x",
					"--audio-format",
					presetFormat,
					"--audio-quality",
					"0",
					...batchOutputArgs,
					...baseArgs,
				];
			}
		} else {
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
					if (videoCodec?.includes("avc")) ext = "mkv";
					else if (videoCodec?.includes("av01")) ext = "webm";
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
				if (platform() === "win32")
					rangeTxt = rangeTxt.replace(/:/g, "_");

				if (template.includes(".%(ext)s")) {
					template = template.replace(
						".%(ext)s",
						` [${rangeTxt}].%(ext)s`,
					);
				} else {
					template += ` [${rangeTxt}]`;
				}
			}

			const singleOutputArgs = [
				"-P",
				this.state.downloadDir,
				"-o",
				template,
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

			if (type === "extract") {
				downloadArgs = [
					"-x",
					"--audio-format",
					uiSnapshot.extractFormat,
					"--audio-quality",
					uiSnapshot.extractQuality,
					...singleOutputArgs,
					...baseArgs,
				];
			} else {
				const formatString =
					type === "video" ? `${format_id}${audioFormat}` : format_id;
				downloadArgs = [
					"-f",
					formatString,
					...singleOutputArgs,
					...baseArgs,
				];
			}
		}

		if (type === "video") {
			const targetFormat = uiSnapshot?.outputFormat;
			if (targetFormat && targetFormat !== "auto") {
				ext = targetFormat;
				downloadArgs.push("--recode-video", targetFormat);
				downloadArgs.push("--merge-output-format", targetFormat);
			}
		}

		if (subs) downloadArgs.push(...subs.split(/\s+/));
		if (subLangs) downloadArgs.push(...subLangs.split(/\s+/));
		if (rangeOption) downloadArgs.push(rangeOption, rangeCmd);

		const homeCustomArgs = ($("customArgsInputHome")?.value || "").trim();
		const prefCustomArgs = (
			$(CONSTANTS.DOM_IDS.CUSTOM_ARGS_INPUT)?.value || ""
		).trim();
		const customArgsString = homeCustomArgs || prefCustomArgs;
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
		const tmpDir = tmpdir();
		const tempFilePath = join(tmpDir, `ytdlp_path_${randomId}.txt`);

		// Tell yt-dlp to output the absolute final file path directly to the temp file
		downloadArgs.push(
			"--print-to-file",
			"after_move:filepath",
			tempFilePath,
		);

		const MAX_INFO_JSON_AGE_MS = 1 * 60 * 60 * 1000; // 1 hour
		const hasValidInfoJson =
			!job.isBatch &&
			!job._forceLiveUrl &&
			job.infoJsonPath &&
			existsSync(job.infoJsonPath) &&
			job.infoJsonFetchedAt &&
			Date.now() - job.infoJsonFetchedAt < MAX_INFO_JSON_AGE_MS;

		job.usingInfoJson = Boolean(hasValidInfoJson);

		if (hasValidInfoJson) {
			downloadArgs.push("--load-info-json", job.infoJsonPath);
		} else {
			downloadArgs.push(url);
		}

		return {downloadArgs, tempFilePath};
	}

	/**
	 * Handles the completion of a download process.
	 */
	_handleDownloadCompletion(code, randomId, actualFilePath, job, controller) {
		const wasActive = this.state.downloadControllers.delete(randomId);
		if (wasActive) {
			this.state.currentDownloads = Math.max(
				0,
				this.state.currentDownloads - 1,
			);
		}

		if (controller?.signal?.aborted) {
			if (wasActive) this._processQueue();
			return;
		}

		if (code === 0) {
			this._showDownloadSuccessUI(randomId, actualFilePath, job);
			this.state.downloadedItems.add(randomId);
			this._updateClearAllButton();
		} else if (code !== null) {
			this._handleDownloadError(
				new Error(`Download process exited with code ${code}.`),
				randomId,
			);
			return;
		}

		if (wasActive) {
			this._processQueue();
		}

		if ($(CONSTANTS.DOM_IDS.QUIT_CHECKED)?.checked) {
			ipcRenderer.send("quit", "quit");
		}
	}

	/**
	 * Handles an error during the download process.
	 */
	_handleDownloadError(error, randomId) {
		const wasActive = this.state.downloadControllers.delete(randomId);
		if (wasActive) {
			this.state.currentDownloads = Math.max(
				0,
				this.state.currentDownloads - 1,
			);
		}

		if (
			error.name === "AbortError" ||
			error.message?.includes("AbortError")
		) {
			console.log(`Download ${randomId} was aborted.`);
			if (wasActive) {
				this._processQueue();
			}
			return; // Don't treat user cancellation as an error
		}

		console.error("Download Error:", error);
		const progressEl = $(`${randomId}_prog`);
		if (progressEl) {
			progressEl.textContent = i18n.__("errorHoverForDetails");
			progressEl.title = error.message;
		}
		if (wasActive) {
			this._processQueue();
		}
	}

	/**
	 * Updates the download options state from the UI elements.
	 */
	_updateDownloadOptionsFromUI() {
		const startTime = $(CONSTANTS.DOM_IDS.START_TIME).value;
		const endTime = $(CONSTANTS.DOM_IDS.END_TIME).value;
		const duration = this.state.videoInfo.duration;
		const isLive = this.state.videoInfo.is_live;

		const startSeconds = this.parseTime(startTime);
		const endSeconds = this.parseTime(endTime);

		if (
			isLive ||
			!duration ||
			(startSeconds === 0 && (endSeconds === duration || endSeconds === 0))
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
			this.state.downloadOptions.subs =
				"--write-subs --sub-format srt/best --convert-subs srt";
			this.state.downloadOptions.subLangs = "--sub-langs all";
		} else {
			this.state.downloadOptions.subs = "";
			this.state.downloadOptions.subLangs = "";
		}
	}

	/**
	 * Increments the reference count for an active info.json temporary file.
	 * Prevents premature deletion while in-flight downloads are using it.
	 * @param {string} infoJsonPath The absolute path to the info.json file.
	 */
	_retainInfoJson(infoJsonPath) {
		if (!infoJsonPath) return;
		const current = this.state.activeInfoJsonPaths.get(infoJsonPath) || 0;
		this.state.activeInfoJsonPaths.set(infoJsonPath, current + 1);
	}

	/**
	 * Decrements the reference count for an active info.json temporary file.
	 * Deletes the file if no active downloads reference it and it is not currently loaded in the UI.
	 * @param {string} infoJsonPath The absolute path to the info.json file.
	 */
	_releaseInfoJson(infoJsonPath) {
		if (!infoJsonPath) return;
		const current = this.state.activeInfoJsonPaths.get(infoJsonPath) || 0;
		if (current <= 1) {
			this.state.activeInfoJsonPaths.delete(infoJsonPath);
			if (this.state.videoInfo?.infoJsonPath !== infoJsonPath) {
				try {
					if (existsSync(infoJsonPath)) unlinkSync(infoJsonPath);
				} catch (_) {}
			}
		} else {
			this.state.activeInfoJsonPaths.set(infoJsonPath, current - 1);
		}
	}

	/**
	 * Sweeps and removes orphan temporary files (ytdlp_info_*.info.json and ytdlp_path_*.txt)
	 * from the system temp directory on startup.
	 */
	_cleanupTempFiles() {
		try {
			const tmpDir = tmpdir();
			const active = this.state.activeInfoJsonPaths;
			const current = this.state.videoInfo?.infoJsonPath;
			const files = readdirSync(tmpDir);
			for (const file of files) {
				if (
					(file.startsWith("ytdlp_info_") &&
						file.endsWith(".info.json")) ||
					(file.startsWith("ytdlp_path_") && file.endsWith(".txt"))
				) {
					const full = join(tmpDir, file);
					if (full === current || active?.has(full)) continue;
					try {
						unlinkSync(full);
					} catch (_) {}
				}
			}
		} catch (e) {
			console.warn("Failed cleaning up temp files:", e);
		}
	}

	/**
	 * Resets the UI state for a new link.
	 */
	_resetUIForNewLink() {
		if (this.state.videoInfo?.infoJsonPath) {
			const oldPath = this.state.videoInfo.infoJsonPath;
			this.state.videoInfo.infoJsonPath = null;
			this.state.videoInfo.infoJsonFetchedAt = null;
			if (!this.state.activeInfoJsonPaths.has(oldPath)) {
				try {
					if (existsSync(oldPath)) unlinkSync(oldPath);
				} catch (_) {}
			}
		}
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
		const pasteBtn = $(CONSTANTS.DOM_IDS.PASTE_URL_BTN);
		if (pasteBtn) pasteBtn.disabled = true;
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

					if (langName) {
						audioMarkup = `
							<div class="audio-indicator">
								${speakerIconSvg}
								${langSpan}
							</div>
						`;
					} else {
						audioMarkup = `
							<div class="audio-no-bg">
								${speakerIconSvg}
								${langSpan}
							</div>
						`;
					}
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

				const formatNote = i18n.__(
					format.format_note || "unknownQuality",
				);

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
		hiddenPanel.classList.remove("scaleUp", "scale", "fade-out");
		hiddenPanel.classList.add("fade-in");
		this._updateEmptyStateUI();
	}

	/**
	 * Creates the initial UI element for a new download.
	 */
	_createDownloadUI(randomId, job) {
		const itemHTML = `
            <div class="item item-fade-in" id="${randomId}">
                <div class="itemIconBox">
                    <img src="${
						job.thumbnail || "../assets/images/thumb.png"
					}" alt="thumbnail" class="itemIcon" crossorigin="anonymous" onload="this.parentElement.classList.add('loaded')" onerror="this.onerror=null;this.src='../assets/images/thumb.png';this.parentElement.classList.add('loaded');">
                    ${
						this._isSafeWebUrl(job.thumbnail)
							? `<button id="${randomId}_thumbOpen" class="openThumbBtn" title="${i18n.__(
									"thumbnail",
								)}"><img src="../assets/images/external-link.png" alt="Open Thumbnail"/></button>`
							: ""
					}
                    <span class="itemType">${i18n.__(
						job.type === "video" ? "video" : "audio",
					)}</span>
                </div>
                <img src="../assets/images/close.png" class="itemClose" id="${randomId}_close">
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
					<div class="itemChannel">${job.channel}</div>
					<div class="speedContainer">
						<span class="itemSpeed" id="${randomId}_speed"></span>
					</div>
                    <div id="${randomId}_prog" class="itemProgress">${i18n.__(
						"preparing",
					)}</div>
					<button id="${randomId}_openBtn" class="openFileBtn"><img class="btnIcon" src="../assets/images/external-link.png"/>${i18n.__("openFile")}</button>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML(
			"beforeend",
			itemHTML,
		);

		$(`${randomId}_close`).addEventListener("click", () =>
			this._cancelDownload(randomId),
		);

		if (this._isSafeWebUrl(job.thumbnail)) {
			$(`${randomId}_thumbOpen`)?.addEventListener("click", (e) => {
				e.stopPropagation();
				try {
					const u = new URL(job.thumbnail);
					if (u.protocol === "http:" || u.protocol === "https:") {
						shell.openExternal(job.thumbnail);
					}
				} catch (err) {
					console.error("Invalid thumbnail URL:", err);
				}
			});
		}
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
	_showDownloadSuccessUI(randomId, actualFilePath, job) {
		const progressEl = $(`${randomId}_prog`);
		const openBtn = $(`${randomId}_openBtn`);
		const itemTitle = job?.title || this.state.videoInfo?.title;
		const itemUrl = job?.url || this.state.videoInfo?.url;
		const itemDuration = job?.duration ?? this.state.videoInfo?.duration;
		const thumbnail = job?.thumbnail;

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
			itemTitle
		) {
			try {
				const originalTitle = itemTitle;
				const dirFiles = readdirSync(this.state.downloadDir);
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

		if (openBtn) {
			openBtn.style.display = "flex";
			openBtn.onclick = () => {
				ipcRenderer.send("show-file", fullPath);
			};
		}

		progressEl.style.display = "none";
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
						title: itemTitle,
						url: itemUrl,
						filename: baseFilename,
						filePath: fullPath,
						fileSize: fileSize,
						format: ext,
						thumbnail: thumbnail,
						duration: itemDuration,
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
		errorDetails.textContent = "";
		const strong = document.createElement("strong");
		strong.textContent = `URL: ${url}`;
		errorDetails.appendChild(strong);
		errorDetails.appendChild(document.createElement("br"));
		errorDetails.appendChild(document.createElement("br"));
		errorDetails.appendChild(document.createTextNode(errorMessage));
		errorDetails.title = i18n.__("clickToCopy");
	}

	/**
	 * Hides the info panel with an animation.
	 */
	_hideInfoPanel(immediate = false) {
		const panel = $(CONSTANTS.DOM_IDS.HIDDEN_PANEL);
		if (panel && panel.style.display !== "none") {
			if (immediate) {
				panel.style.display = "none";
				panel.classList.remove(
					"fade-in",
					"fade-out",
					"scaleUp",
					"scale",
				);
				this._updateEmptyStateUI();
			} else {
				panel.classList.remove("fade-in");
				panel.classList.add("fade-out");
				setTimeout(() => {
					panel.style.display = "none";
					panel.classList.remove("fade-out", "scaleUp", "scale");
					this._updateEmptyStateUI();
				}, 150);
			}
		}
	}

	/**
	 * Displays a temporary popup message.
	 */
	_showPopup(text, isError = false) {
		showPopup(text, isError);
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
			item.classList.remove("item-fade-in", "scale");
			item.classList.add("item-fade-out");
			setTimeout(() => {
				item.remove();
				this._updateEmptyStateUI();
			}, 160);
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
		return formatTime(duration);
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

		const minPercent =
			sliderRange > 0 ? ((minValue - minSliderVal) / sliderRange) * 100 : 0;
		const maxPercent =
			sliderRange > 0 ? ((maxValue - minSliderVal) / sliderRange) * 100 : 0;

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
		const maxSliderVal = parseInt(maxSlider.max);
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
		const minTimeInput = $(CONSTANTS.DOM_IDS.START_TIME);
		const maxTimeInput = $(CONSTANTS.DOM_IDS.END_TIME);

		if (typeof duration !== "number" || duration < 1) {
			if (minSlider) {
				minSlider.max = 0;
				minSlider.value = 0;
				minSlider.disabled = true;
			}
			if (maxSlider) {
				maxSlider.max = 0;
				maxSlider.value = 0;
				maxSlider.disabled = true;
			}
			if (minTimeInput) {
				minTimeInput.value = "00:00";
				minTimeInput.disabled = true;
			}
			if (maxTimeInput) {
				maxTimeInput.value = "00:00";
				maxTimeInput.disabled = true;
			}

			this._updateSliderUI(null);
			return;
		}

		if (minSlider) minSlider.disabled = false;
		if (maxSlider) maxSlider.disabled = false;
		if (minTimeInput) minTimeInput.disabled = false;
		if (maxTimeInput) maxTimeInput.disabled = false;

		minSlider.max = duration;
		maxSlider.max = duration;

		const defaultMin = 0;
		const defaultMax = duration;

		minSlider.value = defaultMin;
		maxSlider.value = defaultMax;

		this._updateSliderUI(null);
	}

	/**
	 * Checks if a given URL is a valid http or https URL.
	 * @param {string} rawUrl - The URL to check.
	 * @returns {boolean}
	 */
	_isSafeWebUrl(rawUrl) {
		if (!rawUrl) return false;
		try {
			const u = new URL(rawUrl);
			return u.protocol === "http:" || u.protocol === "https:";
		} catch {
			return false;
		}
	}

	/**
	 * Validates a URL and returns the sanitized version.
	 * @param {string} rawUrl - The URL to validate.
	 * @returns {string} - The sanitized URL.
	 * @throws {Error} - If the URL is invalid.
	 */
	/**
	 * Updates the path display pill on homepage header.
	 */
	_updateHomePathDisplay() {
		const displayEl = document.getElementById("homePathDisplay");
		if (displayEl) {
			displayEl.textContent =
				this.state.downloadDir || "Select location...";
		}
	}

	/**
	 * Shows or hides the 'No downloads yet' empty state component.
	 */
	_updateEmptyStateUI() {
		const emptyCard = document.getElementById("emptyStateHome");
		const hiddenPanel = $(CONSTANTS.DOM_IDS.HIDDEN_PANEL);
		const hiddenPanelVisible =
			hiddenPanel && hiddenPanel.style.display !== "none";
		const downloadList = $(CONSTANTS.DOM_IDS.DOWNLOAD_LIST);
		const hasDownloadsInList =
			downloadList && downloadList.children.length > 0;

		if (emptyCard) {
			if (
				hiddenPanelVisible ||
				hasDownloadsInList ||
				this.state.isBatchRunning
			) {
				emptyCard.style.display = "none";
			} else {
				emptyCard.style.display = "flex";
			}
		}
	}

	/**
	 * Switches homepage download mode ('single' vs 'multiple').
	 * @param {'single' | 'multiple'} mode
	 */
	_switchHomeMode(mode) {
		this.state.mode = mode;
		const singleBtn = document.getElementById("modeSingleBtn");
		const multipleBtn = document.getElementById("modeMultipleBtn");
		const singleSec = document.getElementById("singleModeSection");
		const multipleSec = document.getElementById("multipleModeSection");
		const pathPicker = document.getElementById("homePathPicker");
		const hiddenPanel = $(CONSTANTS.DOM_IDS.HIDDEN_PANEL);

		if (mode === "single") {
			singleBtn?.classList.add("active");
			multipleBtn?.classList.remove("active");
			if (singleSec) singleSec.style.display = "block";
			if (multipleSec) multipleSec.style.display = "none";
			if (pathPicker) pathPicker.style.display = "inline-flex";
		} else {
			multipleBtn?.classList.add("active");
			singleBtn?.classList.remove("active");
			if (singleSec) singleSec.style.display = "none";
			if (multipleSec) multipleSec.style.display = "block";
			if (pathPicker) pathPicker.style.display = "inline-flex";
			if (hiddenPanel) hiddenPanel.style.display = "none";
		}
		this._updateAutoModeUI();
		this._updateEmptyStateUI();
	}

	/**
	 * Updates the Auto Mode button and Quick Preset Bar visibility on the homepage.
	 */
	_updateAutoModeUI() {
		const autoBtn = document.getElementById("autoDownloadToggleBtn");
		const presetBar = document.getElementById("quickPresetBar");
		if (autoBtn) {
			autoBtn.classList.toggle("active", Boolean(this.state.isAutoMode));
		}
		if (presetBar) {
			if (
				this.state.mode === "multiple" ||
				(this.state.mode === "single" && this.state.isAutoMode)
			) {
				presetBar.style.display = "flex";
				this._syncPresetDefaultsFromPreferences();
			} else {
				presetBar.style.display = "none";
			}
		}
	}

	/**
	 * Syncs quick preset bar (quality & format) with saved user preferences.
	 */
	_syncPresetDefaultsFromPreferences() {
		const videoQuality =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_VIDEO_QUALITY,
			) ||
			localStorage.getItem("preferredVideoQuality") ||
			"1080";
		const audioQuality =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_AUDIO_QUALITY,
			) ||
			localStorage.getItem("preferredAudioQuality") ||
			localStorage.getItem("preferredAudioFormat") ||
			"mp3";

		const qualitySelect = document.getElementById("presetQualitySelect");
		if (qualitySelect && videoQuality) {
			const matchingOpt = Array.from(qualitySelect.options).find(
				(opt) => opt.value === String(videoQuality),
			);
			if (matchingOpt) {
				qualitySelect.value = String(videoQuality);
				this.state.batchPreset.quality = String(videoQuality);
			}
		}

		if (this.state.batchPreset.type === "audio") {
			this._setBatchPresetType("audio");
		} else {
			this._setBatchPresetType("video");
		}
	}

	/**
	 * Toggles batch preset mode ('video' vs 'audio').
	 * @param {'video' | 'audio'} type
	 */
	_setBatchPresetType(type) {
		this.state.batchPreset.type = type;
		const videoBtn = document.getElementById("presetVideoBtn");
		const audioBtn = document.getElementById("presetAudioBtn");
		const qualityContainer = document.getElementById(
			"presetQualityContainer",
		);
		const formatSelect = document.getElementById("presetFormatSelect");

		if (type === "video") {
			videoBtn?.classList.add("active");
			audioBtn?.classList.remove("active");
			if (qualityContainer) qualityContainer.style.display = "flex";
			if (formatSelect) {
				formatSelect.innerHTML = `
					<option value="mp4">MP4</option>
					<option value="mkv">MKV</option>
					<option value="webm">WEBM</option>
				`;
				this.state.batchPreset.format = "mp4";
			}
		} else {
			audioBtn?.classList.add("active");
			videoBtn?.classList.remove("active");
			if (qualityContainer) qualityContainer.style.display = "none";
			if (formatSelect) {
				formatSelect.innerHTML = `
					<option value="mp3">MP3</option>
					<option value="m4a">M4A</option>
					<option value="opus">OPUS</option>
					<option value="flac">FLAC</option>
					<option value="wav">WAV</option>
				`;
				const prefAudio =
					localStorage.getItem("preferredAudioQuality") ||
					localStorage.getItem("preferredAudioFormat") ||
					"mp3";
				const validAudio = [
					"mp3",
					"m4a",
					"opus",
					"flac",
					"wav",
				].includes(prefAudio.toLowerCase())
					? prefAudio.toLowerCase()
					: "mp3";
				formatSelect.value = validAudio;
				this.state.batchPreset.format = validAudio;
			}
		}
	}

	/**
	 * Parses input string to extract valid URLs.
	 * @param {string} text
	 * @returns {string[]}
	 */
	_extractUrlsFromString(text) {
		if (!text) return [];
		const lines = text.split(/\r?\n|\s+/);
		const urls = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const u = new URL(trimmed);
				if (u.protocol === "http:" || u.protocol === "https:") {
					urls.push(u.toString());
				}
			} catch (_) {}
		}
		return [...new Set(urls)];
	}

	/**
	 * Executes batch downloads one by one from textarea or clipboard text.
	 */
	async _startBatchDownloads() {
		if (this.state.isBatchRunning) return;

		const textarea = document.getElementById("batchUrlsInput");
		const text = textarea ? textarea.value : "";
		const urls = this._extractUrlsFromString(text);

		if (urls.length === 0) {
			this._showPopup(
				i18n.__("invalidUrl") || "No valid URLs found",
				true,
			);
			return;
		}

		this.state.isBatchRunning = true;
		this.state.isBatchCancelled = false;

		const startBtn = document.getElementById("startBatchBtn");
		const stopBtn = document.getElementById("stopBatchBtn");

		if (startBtn) startBtn.style.display = "none";
		if (stopBtn) stopBtn.style.display = "inline-flex";
		if (textarea) textarea.disabled = true;

		await this._loadSettings("https://youtube.com", false);

		try {
			for (const url of urls) {
				if (this.state.isBatchCancelled) {
					console.log("Batch process cancelled by user.");
					break;
				}

				let title = url;
				let thumbnail = "";
				let channel = "";

				try {
					const meta = await this._fetchVideoMetadata(url);
					if (meta && meta.title) title = meta.title;
					if (meta && meta.thumbnail) thumbnail = meta.thumbnail;
					if (meta && meta.channel) channel = meta.channel;
				} catch (e) {
					console.warn(
						"Failed fetching meta for batch item:",
						url,
						e,
					);
				}

				if (this.state.isBatchCancelled) break;

				const preset = this.state.batchPreset;
				const downloadJob = {
					type: preset.type,
					url: url,
					title: title,
					channel: channel,
					thumbnail: thumbnail,
					duration: meta?.duration ? Math.ceil(meta.duration) : null,
					isBatch: true,
					options: {
						rangeCmd: "",
						rangeOption: "",
						subs: "",
						subLangs: "",
					},
					uiSnapshot: {
						videoFormat: preset.quality,
						audioForVideoFormat: "best",
						audioFormat: preset.format,
						extractFormat: preset.format,
						extractQuality: "0",
					},
				};

				if (
					this.state.currentDownloads < this.state.maxActiveDownloads
				) {
					this._startDownload(downloadJob);
				} else {
					this._queueDownload(downloadJob);
				}

				await new Promise((resolve) => setTimeout(resolve, 300));
			}
		} catch (err) {
			console.error("Batch download error:", err);
		} finally {
			this.state.isBatchRunning = false;
			if (startBtn) startBtn.style.display = "inline-flex";
			if (stopBtn) stopBtn.style.display = "none";
			if (textarea) {
				textarea.disabled = false;
				if (!this.state.isBatchCancelled) {
					textarea.value = "";
				}
			}
			this._updateEmptyStateUI();
		}
	}

	/**
	 * Stops the active batch download process.
	 */
	_stopBatchDownloads() {
		this.state.isBatchCancelled = true;
		this.state.isBatchRunning = false;

		this.state.downloadControllers.forEach((controller) => {
			if (controller.isBatch) {
				try {
					controller.abort();
				} catch (e) {}
			}
		});

		this.state.downloadQueue = this.state.downloadQueue.filter((job) => {
			if (job.isBatch) {
				$(job.queueId)?.remove();
				return false;
			}
			return true;
		});

		const startBtn = document.getElementById("startBatchBtn");
		const stopBtn = document.getElementById("stopBatchBtn");
		const textarea = document.getElementById("batchUrlsInput");

		if (startBtn) startBtn.style.display = "inline-flex";
		if (stopBtn) stopBtn.style.display = "none";
		if (textarea) textarea.disabled = false;

		this._updateEmptyStateUI();
		this._showPopup(i18n.__("stop") || "Batch download stopped", false);
	}

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
function initApp() {
	const app = new YtDownloaderApp();
	window.app = app;
	app.initialize();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initApp);
} else {
	initApp();
}
