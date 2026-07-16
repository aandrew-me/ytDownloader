const {clipboard, ipcRenderer} = require("electron");
const {default: YTDlpWrap} = require("yt-dlp-wrap-plus");
const path = require("path");
const os = require("os");
const fs = require("fs");
const {execSync} = require("child_process");
const {constants} = require("fs/promises");

const playlistDownloader = {
	// State and config
	state: {
		url: null,
		downloadDir: null,
		ytDlpPath: null,
		ytDlpWrap: null,
		ffmpegPath: null,
		jsRuntimePath: null,
		playlistName: "",
		originalCount: 0,
		currentDownloadProcess: null,
		currentAbortController: null,
		isDownloading: false,
		isCancelled: false,
	},

	config: {
		foldernameFormat: "%(playlist_title)s",
		filenameFormat: "%(playlist_index)s.%(title)s.%(ext)s",
		proxy: "",
		cookie: {
			browser: "",
			arg: "",
		},
		configFile: {
			arg: "",
			path: "",
		},
		playlistRange: {
			start: 1,
			end: "",
		},
	},

	// DOM elements
	ui: {
		pasteLinkBtn: document.getElementById("pasteLink"),
		linkDisplay: document.getElementById("link"),
		optionsContainer: document.getElementById("options"),
		downloadList: document.getElementById("list"),

		downloadVideoBtn: document.getElementById("download"),
		downloadAudioBtn: document.getElementById("audioDownload"),
		downloadThumbnailsBtn: document.getElementById("downloadThumbnails"),
		saveLinksBtn: document.getElementById("saveLinks"),

		selectLocationBtn: document.getElementById("selectLocation"),
		pathDisplay: document.getElementById("path"),
		openDownloadsBtn: document.getElementById("openDownloads"),
		stopDownloadBtn: document.getElementById("stopDownload"),

		videoToggle: document.getElementById("videoToggle"),
		audioToggle: document.getElementById("audioToggle"),
		advancedToggle: document.getElementById("advancedToggle"),
		videoBox: document.getElementById("videoBox"),
		audioBox: document.getElementById("audioBox"),
		videoQualitySelect: document.getElementById("select"),
		videoTypeSelect: document.getElementById("videoTypeSelect"),
		typeSelectBox: document.getElementById("typeSelectBox"),
		audioTypeSelect: document.getElementById("audioSelect"),
		audioQualitySelect: document.getElementById("audioQualitySelect"),

		advancedMenu: document.getElementById("advancedMenu"),
		playlistIndexInput: document.getElementById("playlistIndex"),
		playlistEndInput: document.getElementById("playlistEnd"),
		subtitlesCheckbox: document.getElementById("subChecked"),
		closeHiddenBtn: document.getElementById("closeHidden"),

		playlistNameDisplay: document.getElementById("playlistName"),
		errorMsgDisplay: document.getElementById("incorrectMsgPlaylist"),
		errorBtn: document.getElementById("errorBtn"),
		errorDetails: document.getElementById("errorDetails"),

		menuIcon: document.getElementById("menuIcon"),
		menu: document.getElementById("menu"),
		preferenceWinBtn: document.getElementById("preferenceWin"),
		aboutWinBtn: document.getElementById("aboutWin"),
		historyWinBtn: document.getElementById("historyWin"),
		homeWinBtn: document.getElementById("homeWin"),
		compressorWinBtn: document.getElementById("compressorWin"),
		searchWinBtn: document.getElementById("searchWin"),
	},

	init() {
		this.loadInitialConfig();
		this.initEventListeners();

		// Set initial UI state
		this.ui.pathDisplay.textContent = this.state.downloadDir;
		this.ui.videoToggle.style.backgroundColor = "var(--box-toggleOn)";
		this.updateVideoTypeVisibility();

		// Load translations when ready
		document.addEventListener("translations-loaded", () => {
			window.i18n.translatePage();
		});

		console.log(`yt-dlp path: ${this.state.ytDlpPath}`);
		console.log(`ffmpeg path: ${this.state.ffmpegPath}`);
	},

	loadInitialConfig() {
		// yt-dlp path
		this.state.ytDlpPath = localStorage.getItem("ytdlp");
		this.state.ytDlpWrap = new YTDlpWrap(this.state.ytDlpPath);

		const defaultDownloadsDir = path.join(os.homedir(), "Downloads");
		let preferredDir =
			localStorage.getItem("downloadPath") || defaultDownloadsDir;
		try {
			fs.accessSync(preferredDir, constants.W_OK);
			this.state.downloadDir = preferredDir;
		} catch (err) {
			console.error(
				"Unable to write to preferred download directory. Reverting to default.",
				err,
			);
			this.state.downloadDir = defaultDownloadsDir;
			localStorage.setItem("downloadPath", defaultDownloadsDir);
		}

		// ffmpeg and js runtime path setup
		this.state.ffmpegPath = this.getFfmpegPath();
		this.state.jsRuntimePath = this.getJsRuntimePath();

		if (localStorage.getItem("preferredVideoQuality")) {
			this.ui.videoQualitySelect.value = localStorage.getItem(
				"preferredVideoQuality",
			);
		}
		if (localStorage.getItem("preferredAudioQuality")) {
			this.ui.audioQualitySelect.value = localStorage.getItem(
				"preferredAudioQuality",
			);
		}
	},

	initEventListeners() {
		this.ui.pasteLinkBtn.addEventListener("click", () => this.pasteLink());
		document.addEventListener("keydown", (event) => {
			if (
				(event.ctrlKey && event.key === "v") ||
				(event.metaKey &&
					event.key === "v" &&
					os.platform() === "darwin" &&
					document.activeElement.tagName !== "INPUT" &&
					document.activeElement.tagName !== "TEXTAREA")
			) {
				if (!this.state.isDownloading) {
					this.pasteLink();
				}
			}
		});

		this.ui.downloadVideoBtn.addEventListener("click", () =>
			this.startDownload("video"),
		);
		this.ui.downloadAudioBtn.addEventListener("click", () =>
			this.startDownload("audio"),
		);
		this.ui.downloadThumbnailsBtn.addEventListener("click", () =>
			this.startDownload("thumbnails"),
		);
		this.ui.saveLinksBtn.addEventListener("click", () =>
			this.startDownload("links"),
		);

		this.ui.videoToggle.addEventListener("click", () =>
			this.toggleDownloadType("video"),
		);
		this.ui.audioToggle.addEventListener("click", () =>
			this.toggleDownloadType("audio"),
		);
		this.ui.advancedToggle.addEventListener("click", () =>
			this.toggleAdvancedMenu(),
		);
		this.ui.videoQualitySelect.addEventListener("change", () =>
			this.updateVideoTypeVisibility(),
		);
		this.ui.selectLocationBtn.addEventListener("click", () =>
			ipcRenderer.send("select-location-main", ""),
		);
		this.ui.openDownloadsBtn.addEventListener("click", () =>
			this.openDownloadsFolder(),
		);
		this.ui.stopDownloadBtn.addEventListener("click", () =>
			this.stopDownload(),
		);
		this.ui.closeHiddenBtn.addEventListener("click", () =>
			this.hideOptions(true),
		);

		this.ui.preferenceWinBtn.addEventListener("click", () =>
			this.navigate("page", "/preferences.html"),
		);
		this.ui.aboutWinBtn.addEventListener("click", () =>
			this.navigate("page", "/about.html"),
		);
		this.ui.historyWinBtn.addEventListener("click", () =>
			this.navigate("page", "/history.html"),
		);
		this.ui.homeWinBtn.addEventListener("click", () =>
			this.navigate("win", "/index.html"),
		);
		this.ui.compressorWinBtn.addEventListener("click", () =>
			this.navigate("win", "/compressor.html"),
		);
		this.ui.searchWinBtn?.addEventListener("click", () =>
			this.navigate("win", "/search.html"),
		);

		ipcRenderer.on("downloadPath", (_event, downloadPath) => {
			if (downloadPath && downloadPath[0]) {
				this.ui.pathDisplay.textContent = downloadPath[0];
				this.state.downloadDir = downloadPath[0];
			}
		});
	},

	async startDownload(type) {
		if (this.state.isDownloading) return;

		try {
			this.state.url = this.validateUrl(this.state.url);
		} catch (_) {
			this.showError("Invalid URL");

			return;
		}

		try {
			await this.updateDynamicConfig();
			this.hideOptions();

			this.state.isDownloading = true;
			this.state.isCancelled = false;

			this.state.currentAbortController = new AbortController();
			const baseArgs = this.buildBaseArgs();
			let specificArgs = [];

			switch (type) {
				case "video":
					specificArgs = this.getVideoArgs();
					break;
				case "audio":
					specificArgs = this.getAudioArgs();
					break;
				case "thumbnails":
					specificArgs = this.getThumbnailArgs();
					break;
				case "links":
					specificArgs = this.getLinkArgs();
					break;
			}

			const allArgs = [
				...baseArgs,
				...specificArgs,
				this.state.url,
			].filter(Boolean);

			console.log(`Command: ${this.state.ytDlpPath}`, allArgs.join(" "));
			this.state.currentDownloadProcess = this.state.ytDlpWrap.exec(
				allArgs,
				{shell: false},
				this.state.currentAbortController.signal,
			);

			// TODO: Avoid duplication of event listeners
			document.addEventListener("beforeunload", () => {
				if (this.state.currentAbortController) {
					try {
						this.state.currentAbortController.abort();
					} catch (e) {}
				}
				if (
					this.state.currentDownloadProcess &&
					this.state.currentDownloadProcess.ytDlpProcess &&
					!this.state.currentDownloadProcess.ytDlpProcess.killed
				) {
					try {
						this.state.currentDownloadProcess.ytDlpProcess.kill();
					} catch (e) {}
				}
			});

			this.handleDownloadEvents(this.state.currentDownloadProcess, type);
		} catch (error) {
			this.showError(error);
		}
	},

	buildBaseArgs() {
		const {start, end} = this.config.playlistRange;
		const outputPath = path.join(
			this.state.downloadDir,
			this.config.foldernameFormat,
			this.config.filenameFormat,
		);

		return [
			"--yes-playlist",
			"-o",
			outputPath,

			"-I",
			`${start}:${end}`,

			"--ffmpeg-location",
			this.state.ffmpegPath,

			...(this.state.jsRuntimePath
				? ["--no-js-runtimes", "--js-runtime", this.state.jsRuntimePath]
				: []),

			this.config.cookie.arg,
			this.config.cookie.browser,

			this.config.configFile.arg,
			this.config.configFile.path,

			...(this.config.proxy
				? ["--no-check-certificate", "--proxy", this.config.proxy]
				: []),

			"--compat-options",
			"no-youtube-unavailable-videos",
			"--exec",
			`before_dl:echo [Item info]:::%(playlist_index)q:::%(title)q:::%(thumbnail)q`,
		];
	},

	getVideoArgs() {
		const quality = this.ui.videoQualitySelect.value;
		const videoType = this.ui.videoTypeSelect.value;
		let formatArgs = [];

		if (quality === "best") {
			formatArgs = ["-f", "bv*+ba/best"];
		} else if (quality === "worst") {
			formatArgs = ["-f", "wv+wa/worst"];
		} else if (quality === "useConfig") {
			formatArgs = [];
		} else {
			if (videoType === "mp4") {
				formatArgs = [
					"-f",
					`bestvideo[height<=${quality}]+bestaudio[ext=m4a]/best[height<=${quality}]/best`,
					"--merge-output-format",
					"mp4",
					"--recode-video",
					"mp4",
				];
			} else if (videoType === "webm") {
				formatArgs = [
					"-f",
					`bestvideo[height<=${quality}]+bestaudio[ext=webm]/best[height<=${quality}]/best`,
					"--merge-output-format",
					"webm",
					"--recode-video",
					"webm",
				];
			} else {
				formatArgs = [
					"-f",
					`bv*[height=${quality}]+ba/best[height=${quality}]/best[height<=${quality}]`,
				];
			}
		}

		const isYouTube =
			this.state.url.includes("youtube.com/") ||
			this.state.url.includes("youtu.be/");
		const canEmbedThumb = os.platform() !== "darwin";

		return [
			...formatArgs,
			"--embed-metadata",
			this.ui.subtitlesCheckbox.checked ? "--write-subs" : "",
			this.ui.subtitlesCheckbox.checked ? "--sub-langs" : "",
			this.ui.subtitlesCheckbox.checked ? "all" : "",
			videoType === "mp4" && isYouTube && canEmbedThumb
				? "--embed-thumbnail"
				: "",
		].filter(Boolean);
	},

	getAudioArgs() {
		const format = this.ui.audioTypeSelect.value;
		const quality = this.ui.audioQualitySelect.value;
		const isYouTube =
			this.state.url.includes("youtube.com/") ||
			this.state.url.includes("youtu.be/");
		const canEmbedThumb = os.platform() !== "darwin";

		if (isYouTube && format === "m4a" && quality === "auto") {
			return [
				"-f",
				`ba[ext=${format}]/ba`,
				"--embed-metadata",
				canEmbedThumb ? "--embed-thumbnail" : "",
			];
		}

		return [
			"-x",
			"--audio-format",
			format,
			"--audio-quality",
			quality,
			"--embed-metadata",
			(format === "mp3" || (format === "m4a" && isYouTube)) &&
			canEmbedThumb
				? "--embed-thumbnail"
				: "",
		];
	},

	getThumbnailArgs() {
		return [
			"--write-thumbnail",
			"--convert-thumbnails",
			"png",
			"--skip-download",
		];
	},

	getLinkArgs() {
		const linksFilePath = path.join(
			this.state.downloadDir,
			this.config.foldernameFormat,
			"links.txt",
		);
		return [
			"--skip-download",
			"--print-to-file",
			"webpage_url",
			linksFilePath,
		];
	},

	// yt-dlp event handling
	handleDownloadEvents(process, type) {
		let count = 0;

		process.on("ytDlpEvent", (_eventType, eventData) => {
			const playlistTxt = "Downloading playlist: ";
			if (eventData.includes(playlistTxt)) {
				this.state.playlistName = eventData
					.split(playlistTxt)[1]
					.trim();

				this.state.playlistName = this.state.playlistName
					.replaceAll("|", "｜")
					.replaceAll(`"`, `＂`)
					.replaceAll("*", "＊")
					.replaceAll("/", "⧸")
					.replaceAll("\\", "⧹")
					.replaceAll(":", "：")
					.replaceAll("?", "？");

				if (
					os.platform() === "win32" &&
					this.state.playlistName.endsWith(".")
				) {
					this.state.playlistName =
						this.state.playlistName.slice(0, -1) + "#";
				}

				this.ui.playlistNameDisplay.textContent = `${window.i18n.__(
					"downloadingPlaylist",
				)} ${this.state.playlistName}`;
			}

			if (eventData.includes("[Item info]")) {
				const videoInfo = {
					index: "",
					title: "",
					thumbnail: "",
				};

				try {
					const eventItems = eventData.split(":::");

					videoInfo.index = eventItems[1];
					videoInfo.title = eventItems[2];

					// The title from yt-dlp output usually has double quotes around
					if (
						typeof videoInfo.title === "string" &&
						videoInfo.title.startsWith('"') &&
						videoInfo.title.endsWith('"') &&
						videoInfo.title.length >= 2
					) {
						videoInfo.title = videoInfo.title.slice(1, -1);
					}

					videoInfo.thumbnail = eventItems[3];
				} catch (error) {}

				count++;
				this.state.originalCount++;
				this.updatePlaylistUI(videoInfo, count, type);
			}
		});

		process.on("progress", (progress) => {
			const progressElement = document.getElementById(`p${count}`);
			if (!progressElement) return;

			if (progress.percent === 100) {
				progressElement.textContent = `${window.i18n.__(
					"processing",
				)}...`;
			} else if (progress.percent) {
				progressElement.textContent = `${window.i18n.__("progress")} ${
					progress.percent
				}% | ${window.i18n.__("speed")} ${
					progress.currentSpeed || "0"
				}`;
			}
		});

		process.on("error", (error) => this.showError(error));
		process.on("close", () => this.finishDownload(count));
	},

	stopDownload() {
		this.state.isCancelled = true;
		if (this.state.currentAbortController) {
			try {
				this.state.currentAbortController.abort();
			} catch (e) {
				console.error("Failed to abort controller:", e);
			}
		}
		if (
			this.state.currentDownloadProcess &&
			this.state.currentDownloadProcess.ytDlpProcess
		) {
			try {
				this.state.currentDownloadProcess.ytDlpProcess.kill();
			} catch (e) {
				console.error("Failed to kill ytDlpProcess:", e);
			}
		}
	},

	pasteLink() {
		if (this.state.isDownloading) return;
		this.state.url = clipboard.readText();
		this.ui.linkDisplay.textContent = ` ${this.state.url}`;
		this.ui.optionsContainer.style.display = "block";
		this.ui.errorMsgDisplay.textContent = "";
		this.ui.errorBtn.style.display = "none";
	},

	updatePlaylistUI(videoInfo, count, type) {
		let itemTitle = "";
		switch (type) {
			case "thumbnails":
				itemTitle = `${window.i18n.__("thumbnail")} ${
					this.state.originalCount
				}`;
				break;
			case "links":
				itemTitle = `${window.i18n.__("link")} ${
					this.state.originalCount
				}`;
				break;
			default:
				itemTitle = `${window.i18n.__(type)} ${
					this.state.originalCount
				}`;
		}

		if (count > 1) {
			const prevProgress = document.getElementById(`p${count - 1}`);
			if (prevProgress)
				prevProgress.textContent = window.i18n.__("fileSaved");
		}

		const itemTypeLabel = window.i18n.__(
			type === "thumbnails"
				? "thumbnail"
				: type === "links"
					? "link"
					: type,
		);

		const thumbnailUrl =
			typeof videoInfo.thumbnail === "string"
				? videoInfo.thumbnail.trim()
				: "";
		const safeThumbnail =
			thumbnailUrl &&
			/^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|data:|blob:)/i.test(thumbnailUrl)
				? thumbnailUrl
				: "../assets/images/thumb.png";
		const safeAlt = videoInfo.title || "thumbnail";
		const itemTitleText = videoInfo.title
			? `${videoInfo.index ?? this.state.originalCount}. ${videoInfo.title}`
			: itemTitle;

		const itemElement = document.createElement("div");
		itemElement.className = "item";
		itemElement.id = `item-${count}`;

		const iconBox = document.createElement("div");
		iconBox.className = "itemIconBox";

		const img = document.createElement("img");
		img.src = safeThumbnail;
		img.alt = safeAlt;
		img.className = "itemIcon";
		img.crossOrigin = "anonymous";
		iconBox.appendChild(img);

		const body = document.createElement("div");
		body.className = "itemBody";

		const titleElement = document.createElement("div");
		titleElement.className = "itemTitle";
		titleElement.textContent = itemTitleText;

		const progressElement = document.createElement("p");
		progressElement.className = "itemProgress";
		progressElement.id = `p${count}`;
		progressElement.textContent = window.i18n.__("downloading");

		body.appendChild(titleElement);
		body.appendChild(progressElement);
		itemElement.appendChild(iconBox);
		itemElement.appendChild(body);
		this.ui.downloadList.appendChild(itemElement);
		window.scrollTo(0, document.body.scrollHeight);
	},

	async updateDynamicConfig() {
		// Naming formats from localStorage
		this.config.foldernameFormat =
			localStorage.getItem("foldernameFormat") || "%(playlist_title)s";
		this.config.filenameFormat =
			localStorage.getItem("filenameFormat") ||
			"%(playlist_index)s.%(title)s.%(ext)s";

		// Proxy, cookies, config file
		this.config.proxy = localStorage.getItem("proxy") || "";

		if (!this.config.proxy) {
			const proxy = await ipcRenderer.invoke("get-system-proxy");
			console.log("Using system proxy: " + proxy);

			this.config.proxy = proxy;
		}

		this.config.cookie.browser = localStorage.getItem("browser") || "";
		this.config.cookie.arg = this.config.cookie.browser
			? "--cookies-from-browser"
			: "";
		const configPath = localStorage.getItem("configPath");
		this.config.configFile.path = configPath ? `"${configPath}"` : "";
		this.config.configFile.arg = configPath ? "--config-location" : "";

		// Playlist range from UI inputs
		this.config.playlistRange.start =
			Number(this.ui.playlistIndexInput.value) || 1;
		this.config.playlistRange.end = this.ui.playlistEndInput.value || "";
		this.state.originalCount =
			this.config.playlistRange.start > 1
				? this.config.playlistRange.start - 1
				: 0;

		// Reset playlist name for new download
		this.state.playlistName = "";
	},

	hideOptions(justHide = false) {
		this.ui.optionsContainer.style.display = "none";
		this.ui.downloadList.innerHTML = "";
		this.ui.errorBtn.style.display = "none";
		this.ui.errorDetails.style.display = "none";
		this.ui.errorDetails.textContent = "";
		this.ui.errorMsgDisplay.style.display = "none";
		this.ui.stopDownloadBtn.style.display = "none";

		if (!justHide) {
			this.ui.playlistNameDisplay.textContent = `${window.i18n.__(
				"processing",
			)}...`;
			this.ui.pasteLinkBtn.style.display = "none";
			this.ui.openDownloadsBtn.style.display = "inline-block";
			this.ui.stopDownloadBtn.style.display = "inline-block";
		}
	},

	finishDownload(count) {
		if (!this.state.isDownloading) return;
		this.state.isDownloading = false;
		this.ui.stopDownloadBtn.style.display = "none";

		if (this.state.isCancelled) {
			this.state.isCancelled = false;
			const lastProgress = document.getElementById(`p${count}`);
			if (lastProgress) {
				lastProgress.textContent = window.i18n.__("cancel");
			}
			// this.ui.playlistNameDisplay.textContent = window.i18n.__("cancel");
			this.ui.pasteLinkBtn.style.display = "inline-block";
			return;
		}

		const lastProgress = document.getElementById(`p${count}`);
		if (lastProgress)
			lastProgress.textContent = window.i18n.__("fileSaved");
		this.ui.pasteLinkBtn.style.display = "inline-block";
		this.ui.openDownloadsBtn.style.display = "inline-block";

		const notify = new Notification("ytDownloader", {
			body: window.i18n.__("playlistDownloaded"),
			icon: "../assets/images/icon.png",
		});

		notify.onclick = () => this.openDownloadsFolder();
	},

	showError(error) {
		const wasDownloading = this.state.isDownloading;
		this.state.isDownloading = false;
		this.ui.stopDownloadBtn.style.display = "none";

		if (this.state.isCancelled && wasDownloading) {
			this.state.isCancelled = false;
			this.ui.pasteLinkBtn.style.display = "inline-block";
			return;
		}

		console.error("Download Error:", error.toString());
		this.ui.pasteLinkBtn.style.display = "inline-block";
		this.ui.openDownloadsBtn.style.display = "none";
		this.ui.optionsContainer.style.display = "block";
		this.ui.playlistNameDisplay.textContent = "";
		this.ui.errorMsgDisplay.textContent =
			window.i18n.__("errorNetworkOrUrl");
		this.ui.errorMsgDisplay.style.display = "block";
		this.ui.errorMsgDisplay.title = error.toString();
		this.ui.errorBtn.style.display = "inline-block";
		this.ui.errorDetails.innerHTML = `<strong>URL: ${
			this.state.url
		}</strong><br><br>${error.toString()}`;
		// this.ui.errorDetails.title = window.i18n.__("clickToCopy");
	},

	openDownloadsFolder() {
		const openPath =
			this.state.playlistName &&
			fs.existsSync(
				path.join(this.state.downloadDir, this.state.playlistName),
			)
				? path.join(this.state.downloadDir, this.state.playlistName)
				: this.state.downloadDir;

		ipcRenderer.invoke("open-folder", openPath).then((result) => {
			if (!result.success) {
				ipcRenderer.invoke("open-folder", this.state.downloadDir);
			}
		});
	},

	toggleDownloadType(type) {
		const isVideo = type === "video";
		this.ui.videoToggle.style.backgroundColor = isVideo
			? "var(--box-toggleOn)"
			: "var(--box-toggle)";
		this.ui.audioToggle.style.backgroundColor = isVideo
			? "var(--box-toggle)"
			: "var(--box-toggleOn)";
		this.ui.videoBox.style.display = isVideo ? "block" : "none";
		this.ui.audioBox.style.display = isVideo ? "none" : "block";
	},

	updateVideoTypeVisibility() {
		const value = this.ui.videoQualitySelect.value;
		const show = !["best", "worst", "useConfig"].includes(value);
		this.ui.typeSelectBox.style.display = show ? "block" : "none";
	},

	toggleAdvancedMenu() {
		const isHidden =
			this.ui.advancedMenu.style.display === "none" ||
			this.ui.advancedMenu.style.display === "";
		this.ui.advancedMenu.style.display = isHidden ? "block" : "none";
	},

	closeMenu() {
		this.ui.menuIcon.style.transform = "rotate(0deg)";
		this.ui.menu.style.opacity = "0";
		setTimeout(() => {
			this.ui.menu.style.display = "none";
		}, 300);
	},

	navigate(type, page) {
		if (this.state.isDownloading) {
			const confirmMsg = window.i18n
				? window.i18n.__("cancel_download") + "?"
				: "Are you sure you want to cancel the download?";
			const choice = confirm(confirmMsg);
			if (!choice) {
				return;
			}
			this.stopDownload();
		}
		this.closeMenu();
		const event = type === "page" ? "load-page" : "load-win";
		ipcRenderer.send(event, path.join(__dirname, page));
	},

	getFfmpegPath() {
		if (
			process.env.YTDOWNLOADER_FFMPEG_PATH &&
			fs.existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)
		) {
			console.log("Using FFMPEG from YTDOWNLOADER_FFMPEG_PATH");

			return process.env.YTDOWNLOADER_FFMPEG_PATH;
		}

		switch (os.platform()) {
			case "win32":
				return path.join(
					os.homedir(),
					".ytDownloader",
					"ffmpeg",
					"bin",
				);
			case "freebsd":
				try {
					return execSync("which ffmpeg").toString("utf8").trim();
				} catch (error) {
					console.error("ffmpeg not found on FreeBSD:", error);
					return "";
				}
			default:
				return path.join(
					os.homedir(),
					".ytDownloader",
					"ffmpeg",
					"bin",
				);
		}
	},

	getJsRuntimePath() {
		{
			const exeName = "node";

			if (process.env.YTDOWNLOADER_NODE_PATH) {
				if (fs.existsSync(process.env.YTDOWNLOADER_NODE_PATH)) {
					return `$node:${process.env.YTDOWNLOADER_NODE_PATH}`;
				}

				return "";
			}

			if (process.env.YTDOWNLOADER_DENO_PATH) {
				if (fs.existsSync(process.env.YTDOWNLOADER_DENO_PATH)) {
					return `$deno:${process.env.YTDOWNLOADER_DENO_PATH}`;
				}

				return "";
			}

			if (os.platform() === "darwin") {
				return "";
			}

			let jsRuntimePath = path.join(
				os.homedir(),
				".ytDownloader",
				exeName,
			);

			if (os.platform() === "win32") {
				jsRuntimePath = path.join(
					os.homedir(),
					".ytDownloader",
					`${exeName}.exe`,
				);
			}

			if (fs.existsSync(jsRuntimePath)) {
				return `${exeName}:${jsRuntimePath}`;
			} else {
				return "";
			}
		}
	},
	validateUrl(rawUrl) {
		const input = String(rawUrl ?? "").trim();

		let parsed;
		try {
			parsed = new URL(input);
		} catch {
			throw new Error("invalidUrl");
		}

		return parsed.toString();
	},
};

playlistDownloader.init();
