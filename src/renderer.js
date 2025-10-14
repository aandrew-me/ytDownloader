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
				durationHours: 0,
				durationMinutes: 0,
				durationSeconds: 0,
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
			ipcRenderer.send("ready-for-links");
		} catch (error) {
			console.error("Initialization failed:", error);
			$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = error.message;
			$(CONSTANTS.DOM_IDS.PASTE_URL_BTN).style.display = "none";
		}
	}

	_setupDirectories() {
		const homedir = os.homedir();
		const hiddenDir = path.join(homedir, ".ytDownloader");
		fs.mkdirSync(hiddenDir, {recursive: true});
		let defaultDownloadDir = path.join(homedir, "Downloads");
		if (os.platform() === "linux") {
			try {
				const xdgDownloadDir = cp.execSync("xdg-user-dir DOWNLOAD").toString().trim();
				if (xdgDownloadDir) defaultDownloadDir = xdgDownloadDir;
			} catch (err) {
				console.warn("Could not execute xdg-user-dir:", err.message);
			}
		}
		const savedPath = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH);
		if (savedPath) {
			try {
				fs.accessSync(savedPath, constants.W_OK);
				this.state.downloadDir = savedPath;
			} catch {
				console.warn(`Cannot write to saved path "${savedPath}". Falling back to default.`);
				this.state.downloadDir = defaultDownloadDir;
				localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.DOWNLOAD_PATH, defaultDownloadDir);
			}
		} else {
			this.state.downloadDir = defaultDownloadDir;
		}
		$(CONSTANTS.DOM_IDS.PATH_DISPLAY).textContent = this.state.downloadDir;
		fs.mkdirSync(this.state.downloadDir, {recursive: true});
	}

	_configureTray() {
		if (localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.CLOSE_TO_TRAY) === "true") {
			console.log("Tray is enabled.");
			ipcRenderer.send("useTray", true);
		}
	}

	_configureAutoUpdate() {
		let autoUpdate = true;
		if (localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.AUTO_UPDATE) === "false") autoUpdate = false;
		if (process.windowsStore || process.env.YTDOWNLOADER_AUTO_UPDATES === "0") autoUpdate = false;
		ipcRenderer.send("autoUpdate", autoUpdate);
	}

	async _findOrDownloadYtDlp() {
		const hiddenDir = path.join(os.homedir(), ".ytDownloader");
		const defaultYtDlpName = os.platform() === "win32" ? "ytdlp.exe" : "ytdlp";
		const defaultYtDlpPath = path.join(hiddenDir, defaultYtDlpName);

		if (process.env.YTDOWNLOADER_YTDLP_PATH) {
			if (fs.existsSync(process.env.YTDOWNLOADER_YTDLP_PATH)) return process.env.YTDOWNLOADER_YTDLP_PATH;
			throw new Error("YTDOWNLOADER_YTDLP_PATH is set, but no file exists there.");
		}

		if (os.platform() === "darwin") {
			const possiblePaths = ["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp"];
			const foundPath = possiblePaths.find(p => fs.existsSync(p));
			if (foundPath) return foundPath;
			$(CONSTANTS.DOM_IDS.POPUP_BOX_MAC).style.display = "block";
		} else if (os.platform() === "freebsd") {
			try { return cp.execSync("which yt-dlp").toString().trim(); }
			catch { throw new Error("No yt-dlp found in PATH on FreeBSD. Please install it."); }
		}

		const storedPath = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH);
		if (storedPath && fs.existsSync(storedPath)) {
			cp.spawn(`"${storedPath}"`, ["-U"], {shell: true})
				.on("error", err => console.error("Failed to run background yt-dlp update:", err))
				.stdout.on("data", data => console.log("yt-dlp update check:", data.toString()));
			return storedPath;
		}

		try {
			await fs.promises.access(defaultYtDlpPath);
			return defaultYtDlpPath;
		} catch {
			console.log("yt-dlp not found, downloading...");
			$(CONSTANTS.DOM_IDS.POPUP_BOX).style.display = "block";
			$(CONSTANTS.DOM_IDS.POPUP_SVG).style.display = "inline";
			document.querySelector("#popupBox p").textContent = i18n.__("Please wait, necessary files are being downloaded");
			try {
				await YTDlpWrap.downloadFromGithub(defaultYtDlpPath);
				$(CONSTANTS.DOM_IDS.POPUP_BOX).style.display = "none";
				localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.YT_DLP_PATH, defaultYtDlpPath);
				return defaultYtDlpPath;
			} catch (downloadError) {
				console.error("Failed to download yt-dlp:", downloadError);
				document.querySelector("#popupBox p").textContent = i18n.__("Failed to download necessary files. Please check your network and try again");
				$(CONSTANTS.DOM_IDS.POPUP_SVG).style.display = "none";
				throw new Error("Failed to download yt-dlp.");
			}
		}
	}

	async _findFfmpeg() {
		if (process.env.YTDOWNLOADER_FFMPEG_PATH) {
			if (fs.existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)) return process.env.YTDOWNLOADER_FFMPEG_PATH;
			throw new Error("YTDOWNLOADER_FFMPEG_PATH is set, but no file exists there.");
		}
		if (os.platform() === "freebsd") {
			try { return cp.execSync("which ffmpeg").toString().trim(); }
			catch { throw new Error("No ffmpeg found in PATH on FreeBSD. App may not work correctly."); }
		}
		return os.platform() === "win32"
			? path.join(__dirname, "..", "ffmpeg.exe")
			: path.join(__dirname, "..", "ffmpeg");
	}

	_loadSettings() {
		const prefs = this.state.preferences;
		prefs.videoQuality = Number(localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_VIDEO_QUALITY)) || 1080;
		prefs.audioQuality = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_AUDIO_QUALITY) || "";
		prefs.videoCodec = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.PREFERRED_VIDEO_CODEC) || "avc1";
		prefs.showMoreFormats = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.SHOW_MORE_FORMATS) === "true";
		prefs.proxy = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.PROXY) || "";
		prefs.browserForCookies = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.BROWSER_COOKIES) || "";
		prefs.configPath = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.CONFIG_PATH) || "";
		const maxDownloads = Number(localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.MAX_DOWNLOADS));
		this.state.maxActiveDownloads = maxDownloads >= 1 ? maxDownloads : 5;
	}

	_addEventListeners() {
		$(CONSTANTS.DOM_IDS.PASTE_URL_BTN).addEventListener("click", () => this.pasteAndGetInfo());
		document.addEventListener("keydown", (event) => {
			if (event.ctrlKey && event.key === "v" && document.activeElement.tagName !== "INPUT") {
				this.pasteAndGetInfo();
			}
		});

		$(CONSTANTS.DOM_IDS.VIDEO_DOWNLOAD_BTN).addEventListener("click", () => this.handleDownloadRequest("video"));
		$(CONSTANTS.DOM_IDS.AUDIO_DOWNLOAD_BTN).addEventListener("click", () => this.handleDownloadRequest("audio"));
		$(CONSTANTS.DOM_IDS.EXTRACT_BTN).addEventListener("click", () => this.handleDownloadRequest("extract"));

		$(CONSTANTS.DOM_IDS.CLOSE_HIDDEN_BTN).addEventListener("click", () => this._hideInfoPanel());
		$(CONSTANTS.DOM_IDS.SELECT_LOCATION_BTN).addEventListener("click", () => ipcRenderer.send("select-location-main", ""));
		$(CONSTANTS.DOM_IDS.CLEAR_BTN).addEventListener("click", () => this._clearAllDownloaded());

		$(CONSTANTS.DOM_IDS.ERROR_DETAILS).addEventListener("click", (e) => {
			clipboard.writeText(e.target.innerText);
			this._showPopup("Copied error details to clipboard.");
		});

		ipcRenderer.on("link", (event, text) => this.getInfo(text));
		ipcRenderer.on("downloadPath", (event, downloadPath) => {
			const newPath = downloadPath[0];
			$(CONSTANTS.DOM_IDS.PATH_DISPLAY).textContent = newPath;
			this.state.downloadDir = newPath;
		});

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

	pasteAndGetInfo() {
		this.getInfo(clipboard.readText());
	}

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
			if (metadata.duration) {
				this._setTimeToVideoDuration(metadata.duration);
			}
		} catch (error) {
			this._showError(error.message, url);
		} finally {
			$(CONSTANTS.DOM_IDS.LOADING_WRAPPER).style.display = "none";
		}
	}

	handleDownloadRequest(type) {
		// ✅ Validate FIRST — if invalid, DO NOT hide panel or proceed
		if (!this._validateTimeSelectionOnDownload()) {
			return; // Keep panel open, show error
		}

		// ✅ Only update options and hide panel AFTER validation passes
		this._updateDownloadOptionsFromUI();

		const downloadJob = {
			type,
			url: this.state.videoInfo.url,
			title: this.state.videoInfo.title,
			thumbnail: this.state.videoInfo.thumbnail,
			options: {...this.state.downloadOptions},
			uiSnapshot: {
				videoFormat: $(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT).value,
				audioForVideoFormat: $(CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT).value,
				audioFormat: $(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT).value,
				extractFormat: $(CONSTANTS.DOM_IDS.EXTRACT_SELECTION).value,
				extractQuality: $(CONSTANTS.DOM_IDS.EXTRACT_QUALITY_SELECT).value,
			},
		};

		if (this.state.currentDownloads < this.state.maxActiveDownloads) {
			this._startDownload(downloadJob);
		} else {
			this._queueDownload(downloadJob);
		}

		// ✅ Hide panel ONLY after successful validation and job creation
		//this._hideInfoPanel();
	}

	_fetchVideoMetadata(url) {
		return new Promise((resolve, reject) => {
			const {proxy, browserForCookies, configPath} = this.state.preferences;
			const args = [
				"-j", "--no-playlist", "--no-warnings",
				proxy ? "--proxy" : "", proxy,
				browserForCookies ? "--cookies-from-browser" : "", browserForCookies,
				configPath ? "--config-location" : "", configPath ? `"${configPath}"` : "",
				`"${url}"`
			].filter(Boolean);
			const process = this.state.ytDlp.exec(args, {shell: true});
			let stdout = "", stderr = "";
			process.ytDlpProcess.stdout.on("data", data => stdout += data);
			process.ytDlpProcess.stderr.on("data", data => stderr += data);
			process.on("close", () => {
				if (stdout) {
					try { resolve(JSON.parse(stdout)); }
					catch (e) { reject(new Error("Failed to parse yt-dlp JSON output: " + (stderr || e.message))); }
				} else {
					reject(new Error(stderr || "yt-dlp exited with a non-zero code."));
				}
			});
			process.on("error", err => reject(err));
		});
	}

	_startDownload(job) {
		this.state.currentDownloads++;
		const randomId = "item_" + Math.random().toString(36).substring(2, 12);
		const {downloadArgs, finalFilename, finalExt} = this._prepareDownloadArgs(job);
		this._createDownloadUI(randomId, job);
		const controller = new AbortController();
		this.state.downloadControllers.set(randomId, controller);
		const downloadProcess = this.state.ytDlp.exec(downloadArgs, {
			shell: true, detached: false, signal: controller.signal,
		});
		console.log("Spawned yt-dlp with args:", downloadProcess.ytDlpProcess.spawnargs.join(" "));
		downloadProcess
			.on("progress", progress => this._updateProgressUI(randomId, progress))
			.once("ytDlpEvent", () => {
				const el = $(`${randomId}_prog`);
				if (el) el.textContent = i18n.__("Downloading...");
			})
			.once("close", (code) => {
				this._handleDownloadCompletion(code, randomId, finalFilename, finalExt, job.thumbnail);
			})
			.once("error", error => {
				this._handleDownloadError(error, randomId);
			});
	}

	_queueDownload(job) {
		const randomId = "queue_" + Math.random().toString(36).substring(2, 12);
		this.state.downloadQueue.push({...job, queueId: randomId});
		const itemHTML = `
            <div class="item" id="${randomId}">
                <div class="itemIconBox">
                    <img src="${job.thumbnail || "../assets/images/thumb.png"}" alt="thumbnail" class="itemIcon" crossorigin="anonymous">
                    <span class="itemType">${i18n.__(job.type === "video" ? "Video" : "Audio")}</span>
                </div>
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
                    <p>${i18n.__("Download pending...")}</p>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML("beforeend", itemHTML);
	}

	_processQueue() {
		if (this.state.downloadQueue.length > 0 && this.state.currentDownloads < this.state.maxActiveDownloads) {
			const nextJob = this.state.downloadQueue.shift();
			$(nextJob.queueId)?.remove();
			this._startDownload(nextJob);
		}
	}

	_prepareDownloadArgs(job) {
		const {type, url, title, options, uiSnapshot} = job;
		const {rangeOption, rangeCmd, subs, subLangs} = options;
		const {proxy, browserForCookies, configPath} = this.state.preferences;
		let format_id, ext, audioForVideoFormat_id, audioFormat;

		if (type === "video") {
			const [videoFid, videoExt] = uiSnapshot.videoFormat.split("|");
			const [audioFid, audioExt] = uiSnapshot.audioForVideoFormat.split("|");
			format_id = videoFid;
			audioForVideoFormat_id = audioFid;
			const finalAudioExt = audioExt === "webm" ? "opus" : audioExt;
			ext = (videoExt === "mp4" && finalAudioExt === "opus") ||
				  (videoExt === "webm" && (finalAudioExt === "m4a" || finalAudioExt === "mp4"))
				? "mkv" : videoExt;
			audioFormat = audioForVideoFormat_id === "none" ? "" : `+${audioForVideoFormat_id}`;
		} else if (type === "audio") {
			[format_id, ext] = uiSnapshot.audioFormat.split("|");
			ext = ext === "webm" ? "opus" : ext;
		} else {
			ext = {alac: "m4a", vorbis: "ogg"}[uiSnapshot.extractFormat] || uiSnapshot.extractFormat;
		}

		const invalidChars = os.platform() === "win32" ? /[<>:"/\\|?*[\]`#]/g : /["/`#]/g;
		let finalFilename = title.replace(invalidChars, "").trim().slice(0, 100);
		if (finalFilename.startsWith(".")) finalFilename = finalFilename.substring(1);
		if (rangeCmd) {
			let rangeTxt = rangeCmd.replace("*", "");
			if (os.platform() === "win32") rangeTxt = rangeTxt.replace(/:/g, "_");
			finalFilename += ` [${rangeTxt}]`;
		}

		const outputPath = `"${path.join(this.state.downloadDir, `${finalFilename}.${ext}`)}"`;
		const commonArgs = [
			"--no-playlist", "--embed-chapters", "--no-mtime",
			rangeOption, rangeCmd,
			browserForCookies ? "--cookies-from-browser" : "", browserForCookies,
			proxy ? "--proxy" : "", proxy,
			configPath ? "--config-location" : "", configPath ? `"${configPath}"` : "",
			"--ffmpeg-location", `"${this.state.ffmpegPath}"`,
			`"${url}"`
		].filter(Boolean);

		let downloadArgs;
		if (type === "extract") {
			downloadArgs = ["-x", "--audio-format", uiSnapshot.extractFormat, "--audio-quality", uiSnapshot.extractQuality, "-o", outputPath, ...commonArgs];
		} else {
			const formatString = type === "video" ? `${format_id}${audioFormat}` : format_id;
			downloadArgs = ["-f", formatString, "-o", outputPath, subs, subLangs, ...commonArgs];
		}
		return {downloadArgs, finalFilename, finalExt: ext};
	}

	_handleDownloadCompletion(code, randomId, filename, ext, thumbnail) {
		this.state.currentDownloads--;
		this.state.downloadControllers.delete(randomId);
		if (code === 0) {
			this._showDownloadSuccessUI(randomId, filename, ext, thumbnail);
			this.state.downloadedItems.add(randomId);
			this._updateClearAllButton();
		} else if (code !== null) {
			this._handleDownloadError(new Error(`Download process exited with code ${code}.`), randomId);
		}
		this._processQueue();
		if ($(CONSTANTS.DOM_IDS.QUIT_CHECKED).checked) {
			ipcRenderer.send("quit", "quit");
		}
	}

	_handleDownloadError(error, randomId) {
		if (error.name === "AbortError" || error.message.includes("AbortError")) {
			console.log(`Download ${randomId} was aborted.`);
			this.state.currentDownloads = Math.max(0, this.state.currentDownloads - 1);
			this.state.downloadControllers.delete(randomId);
			this._processQueue();
			return;
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

	_initTimeDropdowns() {
		const startHour = $("startHour"), endHour = $("endHour");
		startHour.innerHTML = ""; endHour.innerHTML = "";
		for (let i = 0; i <= 23; i++) {
			const v = i.toString().padStart(2, '0');
			startHour.innerHTML += `<option value="${v}">${v}</option>`;
			endHour.innerHTML += `<option value="${v}">${v}</option>`;
		}
		const startMinute = $("startMinute"), endMinute = $("endMinute");
		const startSecond = $("startSecond"), endSecond = $("endSecond");
		startMinute.innerHTML = ""; endMinute.innerHTML = "";
		startSecond.innerHTML = ""; endSecond.innerHTML = "";
		for (let i = 0; i <= 59; i++) {
			const v = i.toString().padStart(2, '0');
			startMinute.innerHTML += `<option value="${v}">${v}</option>`;
			endMinute.innerHTML += `<option value="${v}">${v}</option>`;
			startSecond.innerHTML += `<option value="${v}">${v}</option>`;
			endSecond.innerHTML += `<option value="${v}">${v}</option>`;
		}
	}

	_updateDownloadOptionsFromUI() {
		const startHour = $("startHour").value;
		const startMinute = $("startMinute").value;
		const startSecond = $("startSecond").value;
		const endHour = $("endHour").value;
		const endMinute = $("endMinute").value;
		const endSecond = $("endSecond").value;
		const startTime = startHour || startMinute || startSecond ? `${startHour}:${startMinute}:${startSecond}` : "";
		const endTime = endHour || endMinute || endSecond ? `${endHour}:${endMinute}:${endSecond}` : "";
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

	_formatTime(duration) {
		const hrs = ~~(duration / 3600);
		const mins = ~~((duration % 3600) / 60);
		const secs = ~~duration % 60;
		let ret = "";
		if (hrs > 0) ret += `${hrs}:${mins < 10 ? "0" : ""}`;
		ret += `${mins}:${secs < 10 ? "0" : ""}${secs}`;
		return ret;
	}

	_setTimeToVideoDuration(duration) {
		const hours = Math.floor(duration / 3600);
		const minutes = Math.floor((duration % 3600) / 60);
		const seconds = Math.floor(duration % 60);
		this.state.videoInfo.durationHours = hours;
		this.state.videoInfo.durationMinutes = minutes;
		this.state.videoInfo.durationSeconds = seconds;
		this._populateHourDropdowns(hours);
		this._populateMinuteDropdowns(hours, minutes);
		this._populateSecondDropdowns(hours, minutes, seconds);
		$(CONSTANTS.DOM_IDS.END_HOUR).value = hours.toString().padStart(2, '0');
		$(CONSTANTS.DOM_IDS.END_MINUTE).value = minutes.toString().padStart(2, '0');
		$(CONSTANTS.DOM_IDS.END_SECOND).value = seconds.toString().padStart(2, '0');
		// ⚠️ REMOVED: this._addTimeValidationListeners();
	}

	_populateHourDropdowns(maxHours) {
		const sh = $(CONSTANTS.DOM_IDS.START_HOUR), eh = $(CONSTANTS.DOM_IDS.END_HOUR);
		sh.innerHTML = ''; eh.innerHTML = '';
		sh.appendChild(new Option('00', '00', true, true));
		eh.appendChild(new Option('00', '00', true, true));
		if (maxHours > 0) {
			for (let i = 1; i <= maxHours; i++) {
				const v = i.toString().padStart(2, '0');
				sh.appendChild(new Option(v, v));
				eh.appendChild(new Option(v, v));
			}
		}
	}

	_populateMinuteDropdowns(hours, maxMinutes) {
		const sm = $(CONSTANTS.DOM_IDS.START_MINUTE), em = $(CONSTANTS.DOM_IDS.END_MINUTE);
		sm.innerHTML = ''; em.innerHTML = '';
		const limit = hours > 0 ? 59 : maxMinutes;
		for (let i = 0; i <= limit; i++) {
			const v = i.toString().padStart(2, '0');
			sm.appendChild(new Option(v, v));
			em.appendChild(new Option(v, v));
		}
	}

	_populateSecondDropdowns(hours, minutes, maxSeconds) {
		const ss = $(CONSTANTS.DOM_IDS.START_SECOND), es = $(CONSTANTS.DOM_IDS.END_SECOND);
		ss.innerHTML = ''; es.innerHTML = '';
		const limit = (hours > 0 || minutes > 0) ? 59 : maxSeconds;
		for (let i = 0; i <= limit; i++) {
			const v = i.toString().padStart(2, '0');
			ss.appendChild(new Option(v, v));
			es.appendChild(new Option(v, v));
		}
	}

	_validateTimeSelectionOnDownload() {
		if (!this.state.videoInfo.duration) return true;

		const startHour = parseInt($(CONSTANTS.DOM_IDS.START_HOUR).value) || 0;
		const startMinute = parseInt($(CONSTANTS.DOM_IDS.START_MINUTE).value) || 0;
		const startSecond = parseInt($(CONSTANTS.DOM_IDS.START_SECOND).value) || 0;
		const endHour = parseInt($(CONSTANTS.DOM_IDS.END_HOUR).value) || 0;
		const endMinute = parseInt($(CONSTANTS.DOM_IDS.END_MINUTE).value) || 0;
		const endSecond = parseInt($(CONSTANTS.DOM_IDS.END_SECOND).value) || 0;

		const { durationHours, durationMinutes, durationSeconds } = this.state.videoInfo;
		const durationInSeconds = durationHours * 3600 + durationMinutes * 60 + durationSeconds;
		const startTimeInSeconds = startHour * 3600 + startMinute * 60 + startSecond;
		const endTimeInSeconds = endHour * 3600 + endMinute * 60 + endSecond;

		if (endTimeInSeconds > durationInSeconds) {
			this._showPopup("End time cannot exceed video duration.");
			return false;
		}

		if (endTimeInSeconds > 0 && startTimeInSeconds >= endTimeInSeconds) {
			this._showPopup("Start time must be less than end time.");
			return false;
		}

		return true;
	}

	_resetUIForNewLink() {
		this._hideInfoPanel();
		$(CONSTANTS.DOM_IDS.LOADING_WRAPPER).style.display = "flex";
		$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = "";
		$(CONSTANTS.DOM_IDS.ERROR_BTN).style.display = "none";
		$(CONSTANTS.DOM_IDS.ERROR_DETAILS).style.display = "none";
		$(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT).innerHTML = "";
		$(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT).innerHTML = "";
		$(CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT).innerHTML = '<option value="none|none">No Audio</option>';
	}

	_populateFormatSelectors(formats) {
		const videoSelect = $(CONSTANTS.DOM_IDS.VIDEO_FORMAT_SELECT);
		const audioSelect = $(CONSTANTS.DOM_IDS.AUDIO_FORMAT_SELECT);
		const audioForVideoSelect = $(CONSTANTS.DOM_IDS.AUDIO_FOR_VIDEO_FORMAT_SELECT);
		const {videoQuality, videoCodec, showMoreFormats} = this.state.preferences;
		let bestMatchHeight = 0;
		formats.forEach(f => {
			if (f.height && f.height <= videoQuality && f.height > bestMatchHeight && f.video_ext !== "none") {
				bestMatchHeight = f.height;
			}
		});
		if (bestMatchHeight === 0 && formats.length > 0) {
			bestMatchHeight = Math.max(...formats.filter(f => f.height).map(f => f.height));
		}
		const availableCodecs = new Set(
			formats.filter(f => f.height === bestMatchHeight && f.vcodec)
				.map(f => f.vcodec.split(".")[0])
		);
		const finalCodec = availableCodecs.has(videoCodec) ? videoCodec : [...availableCodecs].pop();
		let isAVideoSelected = false;
		formats.forEach(format => {
			const size = format.filesize || format.filesize_approx;
			const displaySize = size ? `${(size / 1000000).toFixed(2)} MB` : i18n.__("Unknown size");
			if (format.video_ext !== "none" && format.vcodec !== "none") {
				if (!showMoreFormats && (format.ext === "webm" || format.vcodec?.startsWith("vp"))) return;
				let isSelected = false;
				if (!isAVideoSelected && format.height === bestMatchHeight && format.vcodec?.startsWith(finalCodec)) {
					isSelected = true;
					isAVideoSelected = true;
				}
				const quality = `${format.height || "???"}p${format.fps === 60 ? "60" : ""}`;
				const vcodec = showMoreFormats ? `| ${format.vcodec?.split(".")[0]}` : "";
				const hasAudio = format.acodec !== "none" ? " 🔊" : "";
				const option = `<option value="${format.format_id}|${format.ext}|${format.height}" ${isSelected ? "selected" : ""}>${quality.padEnd(9, " ")} | ${format.ext.padEnd(5, " ")} ${vcodec} | ${displaySize} ${hasAudio}</option>`;
				videoSelect.innerHTML += option;
			} else if (format.acodec !== "none" && format.video_ext === "none") {
				if (!showMoreFormats && format.ext === "webm") return;
				const audioExt = format.ext === "webm" ? "opus" : format.ext;
				const formatNote = i18n.__(format.format_note) || i18n.__("Unknown quality");
				const option = `<option value="${format.format_id}|${audioExt}">${formatNote.padEnd(15, " ")} | ${audioExt.padEnd(5, " ")} | ${displaySize}</option>`;
				audioSelect.innerHTML += option;
				audioForVideoSelect.innerHTML += option;
			}
		});
		if (formats.every(f => f.acodec === "none" || f.acodec === undefined)) {
			$(CONSTANTS.DOM_IDS.AUDIO_PRESENT_SECTION).style.display = "none";
		} else {
			$(CONSTANTS.DOM_IDS.AUDIO_PRESENT_SECTION).style.display = "block";
		}
	}

	_displayInfoPanel() {
		const info = this.state.videoInfo;
		const titleContainer = $(CONSTANTS.DOM_IDS.TITLE_CONTAINER);
		titleContainer.innerHTML = "";
		titleContainer.append(
			Object.assign(document.createElement("b"), { textContent: i18n.__("Title ") + ": " }),
			Object.assign(document.createElement("input"), {
				className: "title",
				id: CONSTANTS.DOM_IDS.TITLE_INPUT,
				type: "text",
				value: `${info.title} [${info.id}]`,
				onchange: e => this.state.videoInfo.title = e.target.value
			})
		);
		document.querySelectorAll(CONSTANTS.DOM_IDS.URL_INPUTS).forEach(el => el.value = info.url);
		const hiddenPanel = $(CONSTANTS.DOM_IDS.HIDDEN_PANEL);
		hiddenPanel.style.display = "inline-block";
		hiddenPanel.classList.add("scaleUp");
	}

	_createDownloadUI(randomId, job) {
		const itemHTML = `
            <div class="item" id="${randomId}">
                <div class="itemIconBox">
                    <img src="${job.thumbnail || "../assets/images/thumb.png"}" alt="thumbnail" class="itemIcon" crossorigin="anonymous">
                    <span class="itemType">${i18n.__(job.type === "video" ? "Video" : "Audio")}</span>
                </div>
                <img src="../assets/images/close.png" class="itemClose" id="${randomId}_close">
                <div class="itemBody">
                    <div class="itemTitle">${job.title}</div>
                    <strong class="itemSpeed" id="${randomId}_speed"></strong>
                    <div id="${randomId}_prog" class="itemProgress">${i18n.__("Preparing...")}</div>
                </div>
            </div>`;
		$(CONSTANTS.DOM_IDS.DOWNLOAD_LIST).insertAdjacentHTML("beforeend", itemHTML);
		$(`${randomId}_close`).addEventListener("click", () => this._cancelDownload(randomId));
	}

	_updateProgressUI(randomId, progress) {
		const speedEl = $(`${randomId}_speed`);
		const progEl = $(`${randomId}_prog`);
		if (!speedEl || !progEl) return;
		if (progress.percent === 100) {
			speedEl.textContent = "";
			progEl.textContent = i18n.__("Processing...");
			ipcRenderer.send("progress", 0);
		} else {
			speedEl.textContent = `${i18n.__("Speed")}: ${progress.currentSpeed || "0 B/s"}`;
			progEl.innerHTML = `<progress class="progressBar" value="${progress.percent}" max="100"></progress>`;
			ipcRenderer.send("progress", progress.percent / 100);
		}
	}

	_showDownloadSuccessUI(randomId, filename, ext, thumbnail) {
		const progressEl = $(`${randomId}_prog`);
		if (!progressEl) return;
		const fullFilename = `${filename}.${ext}`;
		const fullPath = path.join(this.state.downloadDir, fullFilename);
		progressEl.innerHTML = "";
		const link = document.createElement("b");
		link.textContent = i18n.__("File saved. Click to Open");
		link.style.cursor = "pointer";
		link.onclick = () => shell.showItemInFolder(fullPath);
		progressEl.appendChild(link);
		$(`${randomId}_speed`).textContent = "";
		new Notification("ytDownloader", {
			body: fullFilename,
			icon: thumbnail,
		}).onclick = () => shell.showItemInFolder(fullPath);
	}

	_showError(errorMessage, url) {
		$(CONSTANTS.DOM_IDS.INCORRECT_MSG).textContent = i18n.__("An error occurred. Check your network and URL.");
		$(CONSTANTS.DOM_IDS.ERROR_BTN).style.display = "inline-block";
		const errorDetails = $(CONSTANTS.DOM_IDS.ERROR_DETAILS);
		errorDetails.innerHTML = `<strong>URL: ${url}</strong><br><br>${errorMessage}`;
		errorDetails.title = i18n.__("Click to copy details");
	}

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

	_showPopup(text) {
		const popup = $(CONSTANTS.DOM_IDS.POPUP_TEXT);
		popup.textContent = text;
		popup.style.display = "inline-block";
		setTimeout(() => popup.style.display = "none", 2200);
	}

	_closeMenu() {
		$(CONSTANTS.DOM_IDS.MENU_ICON).style.transform = "rotate(0deg)";
		$(CONSTANTS.DOM_IDS.MENU).style.opacity = "0";
		setTimeout(() => $(CONSTANTS.DOM_IDS.MENU).style.display = "none", 500);
	}

	_cancelDownload(id) {
		if (this.state.downloadControllers.has(id)) {
			this.state.downloadControllers.get(id).abort();
		}
		this.state.downloadQueue = this.state.downloadQueue.filter(job => job.queueId !== id);
		this._fadeAndRemoveItem(id);
	}

	_fadeAndRemoveItem(id) {
		const item = $(id);
		if (item) {
			item.classList.add("scale");
			setTimeout(() => item.remove(), 500);
		}
	}

	_clearAllDownloaded() {
		this.state.downloadedItems.forEach(id => this._fadeAndRemoveItem(id));
		this.state.downloadedItems.clear();
		this._updateClearAllButton();
	}

	_updateClearAllButton() {
		const btn = $(CONSTANTS.DOM_IDS.CLEAR_BTN);
		btn.style.display = this.state.downloadedItems.size > 1 ? "inline-block" : "none";
	}

	_defaultVideoToggle() {
		let defaultWindow = localStorage.getItem("defaultWindow") || "video";
		if (defaultWindow == "video") selectVideo();
		else selectAudio();
	}
}

document.addEventListener("DOMContentLoaded", () => {
	const app = new YtDownloaderApp();
	app.initialize();
});
