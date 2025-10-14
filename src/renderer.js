const cp = require("child_process");
const os = require("os");
const fs = require("fs");
const path = require("path");
const {shell, ipcRenderer, clipboard} = require("electron");
const {default: YTDlpWrap} = require("yt-dlp-wrap-plus");
const {constants} = require("fs/promises");

const i18n = new (require("../translations/i18n"))();

const CONSTANTS = {
	DOM_IDS: {
		// Main UI
		PASTE_URL_BTN: "pasteUrl",
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
		START_HOUR: "startHour",
		START_MINUTE: "startMinute",
		START_SECOND: "startSecond",
		END_HOUR: "endHour",
		END_MINUTE: "endMinute",
		END_SECOND: "endSecond",
		SUB_CHECKED: "subChecked",
		QUIT_CHECKED: "quitChecked",
		// Popups
		POPUP_BOX: "popupBox",
		POPUP_BOX_MAC: "popupBoxMac",
		POPUP_TEXT: "popupText",
		POPUP_SVG: "popupSvg",
		// Menu
		MENU_ICON: "menuIcon",
		MENU: "menu",
		PREFERENCE_WIN: "preferenceWin",
		ABOUT_WIN: "aboutWin",
		PLAYLIST_WIN: "playlistWin",
		COMPRESSOR_WIN: "compressorWin",
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
				configPath: "",
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
		this._setupDirectories();
		this._configureTray();
		this._configureAutoUpdate();

		try {
			this.state.ytDlpPath = await this._findOrDownloadYtDlp();
			this.state.ytDlp = new YTDlpWrap(this.state.ytDlpPath);
			this.state.ffmpegPath = await this._findFfmpeg();

			console.log("yt-dlp path:", this.state.ytDlpPath);
			console.log("ffmpeg path:", this.state.ffmpegPath);

			this._loadSettings();
			this._initTimeDropdowns();
			this._addEventListeners();

			// Signal to the main process that the renderer is ready for links
			ipcRenderer.send("ready-for-links");
		} catch (error) {
			console.error("Initialization failed:", error);
			$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = error.message;
			$(CONSTANTS.DOM_IDS.PASTE_URL_BTN).style.display = "none";
		}
	}

	/**
	 * Sets up the application's hidden directory and the default download directory.
	 */
	_setupDirectories() {
		const homedir = os.homedir();
		const hiddenDir = path.join(homedir, ".ytDownloader");
		fs.mkdirSync(hiddenDir, {recursive: true});

		let defaultDownloadDir = path.join(homedir, "Downloads");
		if (os.platform() === "linux") {
			try {
				const xdgDownloadDir = cp
					.execSync("xdg-user-dir DOWNLOAD")
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
			CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH
		);
		if (savedPath) {
			try {
				fs.accessSync(savedPath, constants.W_OK);
				this.state.downloadDir = savedPath;
			} catch {
				console.warn(
					`Cannot write to saved path "${savedPath}". Falling back to default.`
				);
				this.state.downloadDir = defaultDownloadDir;
				localStorage.setItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH,
					defaultDownloadDir
				);
			}
		} else {
			this.state.downloadDir = defaultDownloadDir;
		}

		$(CONSTANTS.DOM_IDS.PATH_DISPLAY).textContent = this.state.downloadDir;
		fs.mkdirSync(this.state.downloadDir, {recursive: true});
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
	 * Locates the yt-dlp executable path from various sources or downloads it.
	 * @returns {Promise<string>} A promise that resolves with the path to yt-dlp.
	 */
	async _findOrDownloadYtDlp() {
		const hiddenDir = path.join(os.homedir(), ".ytDownloader");
		const defaultYtDlpName =
			os.platform() === "win32" ? "ytdlp.exe" : "ytdlp";
		const defaultYtDlpPath = path.join(hiddenDir, defaultYtDlpName);

		// Priority 1: Environment Variable
		if (process.env.YTDOWNLOADER_YTDLP_PATH) {
			if (fs.existsSync(process.env.YTDOWNLOADER_YTDLP_PATH)) {
				return process.env.YTDOWNLOADER_YTDLP_PATH;
			}
			throw new Error(
				"YTDOWNLOADER_YTDLP_PATH is set, but no file exists there."
			);
		}

		// Priority 2: System-installed versions (macOS, BSD)
		if (os.platform() === "darwin") {
			const possiblePaths = [
				"/opt/homebrew/bin/yt-dlp",
				"/usr/local/bin/yt-dlp",
			];
			const foundPath = possiblePaths.find((p) => fs.existsSync(p));
			if (foundPath) return foundPath;
			$(CONSTANTS.DOM_IDS.POPUP_BOX_MAC).style.display = "block";
		} else if (os.platform() === "freebsd") {
			try {
				return cp.execSync("which yt-dlp").toString().trim();
			} catch {
				throw new Error(
					"No yt-dlp found in PATH on FreeBSD. Please install it."
				);
			}
		}

		// Priority 3: localStorage
		const storedPath = localStorage.getItem(
			CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH
		);
		if (storedPath && fs.existsSync(storedPath)) {
			cp.spawn(`"${storedPath}"`, ["-U"], {shell: true})
				.on("error", (err) =>
					console.error(
						"Failed to run background yt-dlp update:",
						err
					)
				)
				.stdout.on("data", (data) =>
					console.log("yt-dlp update check:", data.toString())
				);
			return storedPath;
		}

		// Priority 4: Default location or download
		try {
			await fs.promises.access(defaultYtDlpPath);
			return defaultYtDlpPath;
		} catch {
			console.log("yt-dlp not found, downloading...");
			$(CONSTANTS.DOM_IDS.POPUP_BOX).style.display = "block";
			$(CONSTANTS.DOM_IDS.POPUP_SVG).style.display = "inline";
			document.querySelector("#popupBox p").textContent = i18n.__(
				"Please wait, necessary files are being downloaded"
			);

			try {
				await YTDlpWrap.downloadFromGithub(defaultYtDlpPath);
				$(CONSTANTS.DOM_IDS.POPUP_BOX).style.display = "none";
				localStorage.setItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH,
					defaultYtDlpPath
				);
				return defaultYtDlpPath;
			} catch (downloadError) {
				console.error("Failed to download yt-dlp:", downloadError);
				document.querySelector("#popupBox p").textContent = i18n.__(
					"Failed to download necessary files. Please check your network and try again"
				);
				$(CONSTANTS.DOM_IDS.POPUP_SVG).style.display = "none";
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
			if (fs.existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)) {
				return process.env.YTDOWNLOADER_FFMPEG_PATH;
			}
			throw new Error(
				"YTDOWNLOADER_FFMPEG_PATH is set, but no file exists there."
			);
		}

		// Priority 2: System-installed (FreeBSD)
		if (os.platform() === "freebsd") {
			try {
				return cp.execSync("which ffmpeg").toString().trim();
			} catch {
				throw new Error(
					"No ffmpeg found in PATH on FreeBSD. App may not work correctly."
				);
			}
		}

		// Priority 3: Bundled ffmpeg
		return os.platform() === "win32"
			? path.join(__dirname, "..", "ffmpeg.exe")
			: path.join(__dirname, "..", "ffmpeg");
	}

	/**
	 * Loads various settings from localStorage into the application state.
	 */
	_loadSettings() {
		const prefs = this.state.preferences;
		prefs.videoQuality =
			Number(
				localStorage.getItem(
					CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_VIDEO_QUALITY
				)
			) || 1080;
		prefs.audioQuality =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_AUDIO_QUALITY
			) || "";
		prefs.videoCodec =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_VIDEO_CODEC
			) || "avc1";
		prefs.showMoreFormats =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.SHOW_MORE_FORMATS
			) === "true";
		prefs.proxy =
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.PROXY) || "";
		prefs.browserForCookies =
			localStorage.getItem(
				CONSTANTS.LOCAL_STORAGE_KEYS.BROWSER_COOKIES
			) || "";
		prefs.configPath =
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.CONFIG_PATH) ||
			"";

		const maxDownloads = Number(
			localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.MAX_DOWNLOADS)
		);
		this.state.maxActiveDownloads = maxDownloads >= 1 ? maxDownloads : 5;
	}

	/**
	 * Attaches all necessary event listeners for the UI.
	 */
	_addEventListeners() {
		$(CONSTANTS.DOM_IDS.PASTE_URL_BTN).addEventListener("click", () =>
			this.pasteAndGetInfo()
		);
		document.addEventListener("keydown", (event) => {
			if (
				event.ctrlKey &&
				event.key === "v" &&
				document.activeElement.tagName !== "INPUT"
			) {
				this.pasteAndGetInfo();
			}
		});

		// Download buttons
		$(CONSTANTS.DOM_IDS.VIDEO_DOWNLOAD_BTN).addEventListener("click", () =>
			this.handleDownloadRequest("video")
		);
		$(CONSTANTS.DOM_IDS.AUDIO_DOWNLOAD_BTN).addEventListener("click", () =>
			this.handleDownloadRequest("audio")
		);
		$(CONSTANTS.DOM_IDS.EXTRACT_BTN).addEventListener("click", () =>
			this.handleDownloadRequest("extract")
		);

		// UI controls
		$(CONSTANTS.DOM_IDS.CLOSE_HIDDEN_BTN).addEventListener("click", () =>
			this._hideInfoPanel()
		);
		$(CONSTANTS.DOM_IDS.SELECT_LOCATION_BTN).addEventListener("click", () =>
			ipcRenderer.send("select-location-main", "")
		);
		$(CONSTANTS.DOM_IDS.CLEAR_BTN).addEventListener("click", () =>
			this._clearAllDownloaded()
		);

		// Error details
		$(CONSTANTS.DOM_IDS.ERROR_DETAILS).addEventListener("click", (e) => {
			clipboard.writeText(e.target.innerText);
			this._showPopup("Copied error details to clipboard.");
		});

		// IPC listeners
		ipcRenderer.on("link", (event, text) => this.getInfo(text));
		ipcRenderer.on("downloadPath", (event, downloadPath) => {
			const newPath = downloadPath[0];
			$(CONSTANTS.DOM_IDS.PATH_DISPLAY).textContent = newPath;
			this.state.downloadDir = newPath;
		});

		// Menu Listeners
		const menuMapping = {
			[CONSTANTS.DOM_IDS.PREFERENCE_WIN]: "/preferences.html",
			[CONSTANTS.DOM_IDS.ABOUT_WIN]: "/about.html",
		};
		const windowMapping = {
			[CONSTANTS.DOM_IDS.PLAYLIST_WIN]: "/playlist.html",
			[CONSTANTS.DOM_IDS.COMPRESSOR_WIN]: "/compressor.html",
		};

		Object.entries(menuMapping).forEach(([id, page]) => {
			$(id)?.addEventListener("click", () => {
				this._closeMenu();
				ipcRenderer.send("load-page", path.join(__dirname, page));
			});
		});

		Object.entries(windowMapping).forEach(([id, page]) => {
			$(id)?.addEventListener("click", () => {
				this._closeMenu();
				ipcRenderer.send("load-win", path.join(__dirname, page));
			});
		});
	}

	// --- Public Methods ---

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
		this._defaultVideoToggle();
		this._resetUIForNewLink();
		this.state.videoInfo.url = url;

		try {
			const metadata = await this._fetchVideoMetadata(url);
			this.state.videoInfo = {
				...this.state.videoInfo,
				id: metadata.id,
				title: metadata.title,
				thumbnail: metadata.thumbnail,
				duration: metadata.duration,
				extractor_key: metadata.extractor_key,
			};
			this._populateFormatSelectors(metadata.formats || []);
			this._displayInfoPanel();
			
			// Set end time to video duration automatically
			if (metadata.duration) {
				this._setTimeToVideoDuration(metadata.duration);
			}
		} catch (error) {
			this._showError(error.message, url);
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
					CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT
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
				proxy ? "--proxy" : "",
				proxy,
				browserForCookies ? "--cookies-from-browser" : "",
				browserForCookies,
				configPath ? "--config-location" : "",
				configPath ? `"${configPath}"` : "",
				`"${url}"`,
			].filter(Boolean);

			const process = this.state.ytDlp.exec(args, {shell: true});

			let stdout = "";
			let stderr = "";

			process.ytDlpProcess.stdout.on("data", (data) => (stdout += data));
			process.ytDlpProcess.stderr.on("data", (data) => (stderr += data));

			process.on("close", () => {
				if (stdout) {
					try {
						resolve(JSON.parse(stdout));
					} catch (e) {
						reject(
							new Error(
								"Failed to parse yt-dlp JSON output: " +
									(stderr || e.message)
							)
						);
					}
				} else {
					reject(
						new Error(
							stderr || `yt-dlp exited with a non-zero code.`
						)
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

		const {downloadArgs, finalFilename, finalExt} =
			this._prepareDownloadArgs(job);

		this._createDownloadUI(randomId, job);

		const controller = new AbortController();
		this.state.downloadControllers.set(randomId, controller);

		const downloadProcess = this.state.ytDlp.exec(downloadArgs, {
			shell: true,
			detached: false,
			signal: controller.signal,
		});

		console.log(
			"Spawned yt-dlp with args:",
			downloadProcess.ytDlpProcess.spawnargs.join(" ")
		);

		// Attach event listeners
		downloadProcess
			.on("progress", (progress) =>
				this._updateProgressUI(randomId, progress)
			)
			.once("ytDlpEvent", () => {
				const el = $(`${randomId}_prog`);
				if (el) el.textContent = i18n.__("Downloading...");
			})
			.once("close", (code) => {
				this._handleDownloadCompletion(
					code,
					randomId,
					finalFilename,
					finalExt,
					job.thumbnail
				);
			})
			.once("error", (error) => {
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
						job.type === "video" ? "Video" : "Audio"
					)}</span>
                </div>
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
                    <p>${i18n.__("Download pending...")}</p>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML(
			"beforeend",
			itemHTML
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
	 * @returns {{downloadArgs: string[], finalFilename: string, finalExt: string}}
	 */
	_prepareDownloadArgs(job) {
		const {type, url, title, options, uiSnapshot} = job;
		const {rangeOption, rangeCmd, subs, subLangs} = options;
		const {proxy, browserForCookies, configPath} = this.state.preferences;

		let format_id, ext, audioForVideoFormat_id, audioFormat;

		if (type === "video") {
			const [videoFid, videoExt] = uiSnapshot.videoFormat.split("|");
			const [audioFid, audioExt] =
				uiSnapshot.audioForVideoFormat.split("|");

			format_id = videoFid;
			audioForVideoFormat_id = audioFid;

			// Determine final container extension
			const finalAudioExt = audioExt === "webm" ? "opus" : audioExt;
			ext =
				(videoExt === "mp4" && finalAudioExt === "opus") ||
				(videoExt === "webm" &&
					(finalAudioExt === "m4a" || finalAudioExt === "mp4"))
					? "mkv"
					: videoExt;

			// Determine audio format string for yt-dlp
			audioFormat =
				audioForVideoFormat_id === "none"
					? ""
					: `+${audioForVideoFormat_id}`;
		} else if (type === "audio") {
			[format_id, ext] = uiSnapshot.audioFormat.split("|");
			ext = ext === "webm" ? "opus" : ext;
		} else {
			// type === 'extract'
			ext =
				{alac: "m4a", vorbis: "ogg"}[uiSnapshot.extractFormat] ||
				uiSnapshot.extractFormat;
		}

		// Sanitize filename
		const invalidChars =
			os.platform() === "win32" ? /[<>:"/\\|?*[\]`#]/g : /["/`#]/g;
		let finalFilename = title
			.replace(invalidChars, "")
			.trim()
			.slice(0, 100);
		if (finalFilename.startsWith(".")) {
			finalFilename = finalFilename.substring(1);
		}
		if (rangeCmd) {
			let rangeTxt = rangeCmd.replace("*", "");
			if (os.platform() === "win32")
				rangeTxt = rangeTxt.replace(/:/g, "_");
			finalFilename += ` [${rangeTxt}]`;
		}

		const outputPath = `"${path.join(
			this.state.downloadDir,
			`${finalFilename}.${ext}`
		)}"`;
		const commonArgs = [
			"--no-playlist",
			"--embed-chapters",
			"--no-mtime",
			rangeOption,
			rangeCmd,
			browserForCookies ? "--cookies-from-browser" : "",
			browserForCookies,
			proxy ? "--proxy" : "",
			proxy,
			configPath ? "--config-location" : "",
			configPath ? `"${configPath}"` : "",
			"--ffmpeg-location",
			`"${this.state.ffmpegPath}"`,
			`"${url}"`,
		].filter(Boolean);

		let downloadArgs;
		if (type === "extract") {
			downloadArgs = [
				"-x",
				"--audio-format",
				uiSnapshot.extractFormat,
				"--audio-quality",
				uiSnapshot.extractQuality,
				"-o",
				outputPath,
				...commonArgs,
			];
		} else {
			const formatString =
				type === "video" ? `${format_id}${audioFormat}` : format_id;
			downloadArgs = [
				"-f",
				formatString,
				"-o",
				outputPath,
				subs,
				subLangs,
				...commonArgs,
			];
		}

		return {downloadArgs, finalFilename, finalExt: ext};
	}

	/**
	 * Handles the completion of a download process.
	 */
	_handleDownloadCompletion(code, randomId, filename, ext, thumbnail) {
		this.state.currentDownloads--;
		this.state.downloadControllers.delete(randomId);

		if (code === 0) {
			this._showDownloadSuccessUI(randomId, filename, ext, thumbnail);
			this.state.downloadedItems.add(randomId);
			this._updateClearAllButton();
		} else if (code !== null) {
			// code is null if aborted, so only show error if it's a real exit code
			this._handleDownloadError(
				new Error(`Download process exited with code ${code}.`),
				randomId
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
				this.state.currentDownloads - 1
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
			progressEl.textContent = i18n.__("Error. Hover for details.");
			progressEl.title = error.message;
		}
		this._processQueue();
	}

	/**
	 * Initializes the time dropdown selectors.
	 */
	_initTimeDropdowns() {
		// Populate hours (0-23)
		const startHour = $("startHour");
		const endHour = $("endHour");
		startHour.innerHTML = "";
		endHour.innerHTML = "";
		for (let i = 0; i <= 23; i++) {
			const value = i.toString().padStart(2, "0");
			startHour.innerHTML += `<option value="${value}">${value}</option>`;
			endHour.innerHTML += `<option value="${value}">${value}</option>`;
		}
		
		// Populate minutes and seconds (0-59)
		const startMinute = $("startMinute");
		const endMinute = $("endMinute");
		const startSecond = $("startSecond");
		const endSecond = $("endSecond");
		startMinute.innerHTML = "";
		endMinute.innerHTML = "";
		startSecond.innerHTML = "";
		endSecond.innerHTML = "";
		
		for (let i = 0; i <= 59; i++) {
			const value = i.toString().padStart(2, "0");
			startMinute.innerHTML += `<option value="${value}">${value}</option>`;
			endMinute.innerHTML += `<option value="${value}">${value}</option>`;
			startSecond.innerHTML += `<option value="${value}">${value}</option>`;
			endSecond.innerHTML += `<option value="${value}">${value}</option>`;
		}
	}

	/**
	 * Updates the download options state from the UI elements.
	 */
	_updateDownloadOptionsFromUI() {
		const startHour = $("startHour").value;
		const startMinute = $("startMinute").value;
		const startSecond = $("startSecond").value;
		const endHour = $("endHour").value;
		const endMinute = $("endMinute").value;
		const endSecond = $("endSecond").value;
		
		const startTime = startHour || startMinute || startSecond ? 
			`${startHour}:${startMinute}:${startSecond}` : "";
		const endTime = endHour || endMinute || endSecond ? 
			`${endHour}:${endMinute}:${endSecond}` : "";
		
		const duration = this.state.videoInfo.duration;

		if (startTime || endTime) {
			const start = startTime || "0";
			const end = endTime || this._formatTime(duration);
			this.state.downloadOptions.rangeCmd = `*${start}-${end}`;
			this.state.downloadOptions.rangeOption = "--download-sections";
		} else {
			this.state.downloadOptions.rangeCmd = "";
			this.state.downloadOptions.rangeOption = "";
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
	 * Formats seconds into HH:MM:SS format.
	 * @param {number} duration in seconds.
	 * @returns {string}
	 */
	_formatTime(duration) {
		const hrs = ~~(duration / 3600);
		const mins = ~~((duration % 3600) / 60);
		const secs = ~~duration % 60;
		let ret = "";
		if (hrs > 0) {
			ret += `${hrs}:${mins < 10 ? "0" : ""}`;
		}
		ret += `${mins}:${secs < 10 ? "0" : ""}${secs}`;
		return ret;
	}
	
	/**
	 * Sets the end time dropdowns to the video duration and adds validation listeners
	 * @param {number} duration Video duration in seconds
	 */
	_setTimeToVideoDuration(duration) {
		// Calculate hours, minutes, seconds from duration
		const hours = Math.floor(duration / 3600);
		const minutes = Math.floor((duration % 3600) / 60);
		const seconds = Math.floor(duration % 60);
		
		// Store video duration for validation
		this.state.videoInfo.durationHours = hours;
		this.state.videoInfo.durationMinutes = minutes;
		this.state.videoInfo.durationSeconds = seconds;
		
		// Restrict hour dropdown options based on video duration
		this._populateHourDropdowns(hours);
		
		// Restrict minute dropdown options based on video duration
		this._populateMinuteDropdowns(hours, minutes);
		
		// Restrict second dropdown options
		this._populateSecondDropdowns(hours, minutes, seconds);
		
		// Set end time dropdowns to video duration
		$(CONSTANTS.DOM_IDS.END_HOUR).value = hours.toString().padStart(2, '0');
		$(CONSTANTS.DOM_IDS.END_MINUTE).value = minutes.toString().padStart(2, '0');
		$(CONSTANTS.DOM_IDS.END_SECOND).value = seconds.toString().padStart(2, '0');
		
		// Add validation to time dropdowns
		this._addTimeValidationListeners();
	}
	
	/**
	 * Populates hour dropdowns with options based on video duration
	 * @param {number} maxHours Maximum hours from video duration
	 */
	_populateHourDropdowns(maxHours) {
		const startHourDropdown = $(CONSTANTS.DOM_IDS.START_HOUR);
		const endHourDropdown = $(CONSTANTS.DOM_IDS.END_HOUR);
		
		// Clear existing options
		startHourDropdown.innerHTML = '';
		endHourDropdown.innerHTML = '';
		
		// Always add 00 hour option
		startHourDropdown.appendChild(new Option('00', '00', true, true));
		endHourDropdown.appendChild(new Option('00', '00', true, true));
		
		// If video has hours, add hour options up to the max
		if (maxHours > 0) {
			for (let i = 1; i <= maxHours; i++) {
				const hourStr = i.toString().padStart(2, '0');
				startHourDropdown.appendChild(new Option(hourStr, hourStr));
				endHourDropdown.appendChild(new Option(hourStr, hourStr));
			}
		}
	}
	
	/**
	 * Populates minute dropdowns with options based on video duration
	 * @param {number} hours Hours from video duration
	 * @param {number} maxMinutes Maximum minutes from video duration
	 */
	_populateMinuteDropdowns(hours, maxMinutes) {
		const startMinuteDropdown = $(CONSTANTS.DOM_IDS.START_MINUTE);
		const endMinuteDropdown = $(CONSTANTS.DOM_IDS.END_MINUTE);
		
		// Clear existing options
		startMinuteDropdown.innerHTML = '';
		endMinuteDropdown.innerHTML = '';
		
		// Add minute options
		const minuteLimit = hours > 0 ? 59 : maxMinutes;
		
		for (let i = 0; i <= minuteLimit; i++) {
			const minuteStr = i.toString().padStart(2, '0');
			startMinuteDropdown.appendChild(new Option(minuteStr, minuteStr));
			endMinuteDropdown.appendChild(new Option(minuteStr, minuteStr));
		}
	}
	
	/**
	 * Populates second dropdowns with options based on video duration
	 * @param {number} hours Hours from video duration
	 * @param {number} minutes Minutes from video duration
	 * @param {number} maxSeconds Maximum seconds from video duration
	 */
	_populateSecondDropdowns(hours, minutes, maxSeconds) {
		const startSecondDropdown = $(CONSTANTS.DOM_IDS.START_SECOND);
		const endSecondDropdown = $(CONSTANTS.DOM_IDS.END_SECOND);
		
		// Clear existing options
		startSecondDropdown.innerHTML = '';
		endSecondDropdown.innerHTML = '';
		
		// Add second options
		const secondLimit = (hours > 0 || minutes > 0) ? 59 : maxSeconds;
		
		for (let i = 0; i <= secondLimit; i++) {
			const secondStr = i.toString().padStart(2, '0');
			startSecondDropdown.appendChild(new Option(secondStr, secondStr));
			endSecondDropdown.appendChild(new Option(secondStr, secondStr));
		}
	}
	
	/**
	 * Adds event listeners to validate time selection is within video duration
	 */
	_addTimeValidationListeners() {
		const timeDropdowns = [
			$(CONSTANTS.DOM_IDS.START_HOUR),
			$(CONSTANTS.DOM_IDS.START_MINUTE),
			$(CONSTANTS.DOM_IDS.START_SECOND),
			$(CONSTANTS.DOM_IDS.END_HOUR),
			$(CONSTANTS.DOM_IDS.END_MINUTE),
			$(CONSTANTS.DOM_IDS.END_SECOND)
		];
		
		timeDropdowns.forEach(dropdown => {
			dropdown.addEventListener('change', () => {
				this._validateTimeSelection();
				
				// If hour dropdown changes, update minute options
				if (dropdown.id === CONSTANTS.DOM_IDS.START_HOUR || dropdown.id === CONSTANTS.DOM_IDS.END_HOUR) {
					const { durationHours, durationMinutes } = this.state.videoInfo;
					this._populateMinuteDropdowns(durationHours, durationMinutes);
				}
				
				// If minute dropdown changes, update second options
				if (dropdown.id === CONSTANTS.DOM_IDS.START_MINUTE || dropdown.id === CONSTANTS.DOM_IDS.END_MINUTE) {
					const { durationHours, durationMinutes, durationSeconds } = this.state.videoInfo;
					this._populateSecondDropdowns(durationHours, durationMinutes, durationSeconds);
				}
			});
		});
	}
	
	/**
	 * Validates that time selection is within video duration and start time is before end time
	 */
	_validateTimeSelection() {
		if (!this.state.videoInfo.duration) return;
		
		const startHour = parseInt($(CONSTANTS.DOM_IDS.START_HOUR).value) || 0;
		const startMinute = parseInt($(CONSTANTS.DOM_IDS.START_MINUTE).value) || 0;
		const startSecond = parseInt($(CONSTANTS.DOM_IDS.START_SECOND).value) || 0;
		
		const endHour = parseInt($(CONSTANTS.DOM_IDS.END_HOUR).value) || 0;
		const endMinute = parseInt($(CONSTANTS.DOM_IDS.END_MINUTE).value) || 0;
		const endSecond = parseInt($(CONSTANTS.DOM_IDS.END_SECOND).value) || 0;
		
		const { durationHours, durationMinutes, durationSeconds } = this.state.videoInfo;
		
		// Convert all to seconds for comparison
		const startTimeInSeconds = startHour * 3600 + startMinute * 60 + startSecond;
		const endTimeInSeconds = endHour * 3600 + endMinute * 60 + endSecond;
		const durationInSeconds = durationHours * 3600 + durationMinutes * 60 + durationSeconds;
		
		// Validate end time doesn't exceed video duration
		if (endTimeInSeconds > durationInSeconds) {
			$(CONSTANTS.DOM_IDS.END_HOUR).value = durationHours.toString().padStart(2, '0');
			$(CONSTANTS.DOM_IDS.END_MINUTE).value = durationMinutes.toString().padStart(2, '0');
			$(CONSTANTS.DOM_IDS.END_SECOND).value = durationSeconds.toString().padStart(2, '0');
			this._showPopup("End time cannot exceed video duration.");
			
			// Update dropdowns if selection changes
			this._populateMinuteDropdowns(durationHours, durationMinutes);
			this._populateSecondDropdowns(durationHours, durationMinutes, durationSeconds);
		}
		
		// Validate start time is less than end time
		if (startTimeInSeconds >= endTimeInSeconds) {
			// Set start time to one second before end time
			const newStartTimeInSeconds = Math.max(0, endTimeInSeconds - 1);
			const newStartHours = Math.floor(newStartTimeInSeconds / 3600);
			const newStartMinutes = Math.floor((newStartTimeInSeconds % 3600) / 60);
			const newStartSeconds = Math.floor(newStartTimeInSeconds % 60);
			
			$(CONSTANTS.DOM_IDS.START_HOUR).value = newStartHours.toString().padStart(2, '0');
			$(CONSTANTS.DOM_IDS.START_MINUTE).value = newStartMinutes.toString().padStart(2, '0');
			$(CONSTANTS.DOM_IDS.START_SECOND).value = newStartSeconds.toString().padStart(2, '0');
			this._showPopup("Start time must be less than end time.");
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
		$(CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT).innerHTML =
			'<option value="none|none">No Audio</option>';
	}

	/**
	 * Populates the video and audio format <select> elements.
	 * @param {Array} formats The formats array from yt-dlp metadata.
	 */
	_populateFormatSelectors(formats) {
		const videoSelect = $(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT);
		const audioSelect = $(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT);
		const audioForVideoSelect = $(
			CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT
		);

		const {videoQuality, videoCodec, showMoreFormats} =
			this.state.preferences;
		let bestMatchHeight = 0;

		// Find the best available video height based on preference
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
				...formats.filter((f) => f.height).map((f) => f.height)
			);
		}

		// Determine preferred codec for the best height
		const availableCodecs = new Set(
			formats
				.filter((f) => f.height === bestMatchHeight && f.vcodec)
				.map((f) => f.vcodec.split(".")[0])
		);
		const finalCodec = availableCodecs.has(videoCodec)
			? videoCodec
			: [...availableCodecs].pop();

		let isAVideoSelected = false;
		formats.forEach((format) => {
			const size = format.filesize || format.filesize_approx;
			const displaySize = size
				? `${(size / 1000000).toFixed(2)} MB`
				: i18n.__("Unknown size");

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

				const quality = `${format.height || "???"}p${
					format.fps === 60 ? "60" : ""
				}`;
				const vcodec = showMoreFormats
					? `| ${format.vcodec?.split(".")[0]}`
					: "";
				const hasAudio = format.acodec !== "none" ? " 🔊" : "";

				const option = `<option value="${format.format_id}|${
					format.ext
				}|${format.height}" ${
					isSelected ? "selected" : ""
				}>${quality.padEnd(9, " ")} | ${format.ext.padEnd(
					5,
					" "
				)} ${vcodec} | ${displaySize} ${hasAudio}</option>`;
				videoSelect.innerHTML += option;
			} else if (
				format.acodec !== "none" &&
				format.video_ext === "none"
			) {
				if (!showMoreFormats && format.ext === "webm") return;

				const audioExt = format.ext === "webm" ? "opus" : format.ext;
				const formatNote =
					i18n.__(format.format_note) || i18n.__("Unknown quality");
				const option = `<option value="${
					format.format_id
				}|${audioExt}">${formatNote.padEnd(
					15,
					" "
				)} | ${audioExt.padEnd(5, " ")} | ${displaySize}</option>`;
				audioSelect.innerHTML += option;
				audioForVideoSelect.innerHTML += option;
			}
		});

		if (
			formats.every((f) => f.acodec === "none" || f.acodec === undefined)
		) {
			$(CONSTANTS.DOM_IDS.AUDIO_PRESENT_SECTION).style.display = "none";
		} else {
			$(CONSTANTS.DOM_IDS.AUDIO_PRESENT_SECTION).style.display = "block";
		}
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
				textContent: i18n.__("Title ") + ": ",
			}),
			Object.assign(document.createElement("input"), {
				className: "title",
				id: CONSTANTS.DOM_IDS.TITLE_INPUT,
				type: "text",
				value: `${info.title} [${info.id}]`,
				onchange: (e) => (this.state.videoInfo.title = e.target.value),
			})
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
						job.type === "video" ? "Video" : "Audio"
					)}</span>
                </div>
                <img src="../assets/images/close.png" class="itemClose" id="${randomId}_close">
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
                    <strong class="itemSpeed" id="${randomId}_speed"></strong>
                    <div id="${randomId}_prog" class="itemProgress">${i18n.__(
			"Preparing..."
		)}</div>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML(
			"beforeend",
			itemHTML
		);

		$(`${randomId}_close`).addEventListener("click", () =>
			this._cancelDownload(randomId)
		);
	}

	/**
	 * Updates the progress bar and speed for a download item.
	 */
	_updateProgressUI(randomId, progress) {
		const speedEl = $(`${randomId}_speed`);
		const progEl = $(`${randomId}_prog`);
		if (!speedEl || !progEl) return;

		if (progress.percent === 100) {
			speedEl.textContent = "";
			progEl.textContent = i18n.__("Processing...");
			ipcRenderer.send("progress", 0);
		} else {
			speedEl.textContent = `${i18n.__("Speed")}: ${
				progress.currentSpeed || "0 B/s"
			}`;
			progEl.innerHTML = `<progress class="progressBar" value="${progress.percent}" max="100"></progress>`;
			ipcRenderer.send("progress", progress.percent / 100);
		}
	}

	/**
	 * Updates a download item's UI to show it has completed successfully.
	 */
	_showDownloadSuccessUI(randomId, filename, ext, thumbnail) {
		const progressEl = $(`${randomId}_prog`);
		if (!progressEl) return;

		const fullFilename = `${filename}.${ext}`;
		const fullPath = path.join(this.state.downloadDir, fullFilename);

		progressEl.innerHTML = ""; // Clear progress bar
		const link = document.createElement("b");
		link.textContent = i18n.__("File saved. Click to Open");
		link.style.cursor = "pointer";
		link.onclick = () => shell.showItemInFolder(fullPath);
		progressEl.appendChild(link);
		$(`${randomId}_speed`).textContent = "";

		// Send desktop notification
		new Notification("ytDownloader", {
			body: fullFilename,
			icon: thumbnail,
		}).onclick = () => {
			shell.showItemInFolder(fullPath);
		};
	}

	/**
	 * Shows an error message in the main UI.
	 */
	_showError(errorMessage, url) {
		$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = i18n.__(
			"An error occurred. Check your network and URL."
		);
		$(CONSTANTS.DOM_IDS.ERROR_BTN).style.display = "inline-block";
		const errorDetails = $(CONSTANTS.DOM_IDS.ERROR_DETAILS);
		errorDetails.innerHTML = `<strong>URL: ${url}</strong><br><br>${errorMessage}`;
		errorDetails.title = i18n.__("Click to copy details");
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
	_showPopup(text) {
		const popup = $(CONSTANTS.DOM_IDS.POPUP_TEXT);
		popup.textContent = text;
		popup.style.display = "inline-block";
		setTimeout(() => {
			popup.style.display = "none";
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
			500
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
			(job) => job.queueId !== id
		);
		this._fadeAndRemoveItem(id);
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
}

// --- Application Entry Point ---
document.addEventListener("DOMContentLoaded", () => {
	const app = new YtDownloaderApp();
	app.initialize();
});
