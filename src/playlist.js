import { getId } from "./utils.js";

const {
	clipboard,
	ipcRenderer,
	YTDlpWrap,
	path,
	os,
	fs,
	constants,
	env,
	__dirname,
} = window.electronAPI;

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
			arg: "",
			val: "",
		},
		playlistRange: {
			start: 1,
			end: "",
		},
	},

	// DOM elements
	ui: {
		pasteLinkBtn: getId("pasteLink"),
		linkDisplay: getId("link"),
		optionsContainer: getId("options"),
		downloadList: getId("list"),

		downloadVideoBtn: getId("download"),
		downloadAudioBtn: getId("audioDownload"),
		downloadThumbnailsBtn: getId("downloadThumbnails"),
		saveLinksBtn: getId("saveLinks"),

		selectLocationBtn: getId("selectLocation"),
		pathDisplay: getId("path"),
		openDownloadsBtn: getId("openDownloads"),
		stopDownloadBtn: getId("stopDownload"),

		videoToggle: getId("videoToggle"),
		audioToggle: getId("audioToggle"),
		advancedToggle: getId("advancedToggle"),
		videoBox: getId("videoBox"),
		audioBox: getId("audioBox"),
		videoQualitySelect: getId("select"),
		videoTypeSelect: getId("videoTypeSelect"),
		typeSelectBox: getId("typeSelectBox"),
		audioTypeSelect: getId("audioSelect"),
		audioQualitySelect: getId("audioQualitySelect"),

		advancedMenu: getId("advancedMenu"),
		playlistIndexInput: getId("playlistIndex"),
		playlistEndInput: getId("playlistEnd"),
		subtitlesCheckbox: getId("subChecked"),
		closeHiddenBtn: getId("closeHidden"),

		playlistNameDisplay: getId("playlistName"),
		errorMsgDisplay: getId("incorrectMsgPlaylist"),
		errorBtn: getId("errorBtn"),
		errorDetails: getId("errorDetails"),

		menuIcon: getId("menuIcon"),
		menu: getId("menu"),
		preferenceWinBtn: getId("preferenceWin"),
		aboutWinBtn: getId("aboutWin"),
		historyWinBtn: getId("historyWin"),
		homeWinBtn: getId("homeWin"),
		compressorWinBtn: getId("compressorWin"),
		searchWinBtn: getId("searchWin"),
	},

	initUI() {
		const container = getId("view-playlist") || document;

		this.ui = {
			pasteLinkBtn: container.querySelector("#pasteLink") || container.querySelector("#pasteLinkPlaylist") || getId("pasteLink"),
			linkDisplay: container.querySelector("#link") || getId("link"),
			optionsContainer: container.querySelector("#options") || getId("options"),
			downloadList: container.querySelector("#listPlaylist") || container.querySelector("#list") || getId("list"),

			downloadVideoBtn: container.querySelector("#download") || getId("download"),
			downloadAudioBtn: container.querySelector("#audioDownloadPlaylist") || container.querySelector("#audioDownload"),
			downloadThumbnailsBtn: container.querySelector("#downloadThumbnails") || getId("downloadThumbnails"),
			saveLinksBtn: container.querySelector("#saveLinks") || getId("saveLinks"),

			selectLocationBtn: container.querySelector("#selectLocationPlaylist") || container.querySelector("#selectLocation") || getId("selectLocation"),
			pathDisplay: container.querySelector("#pathPlaylist") || container.querySelector("#path") || getId("path"),
			openDownloadsBtn: container.querySelector("#openDownloads") || getId("openDownloads"),
			stopDownloadBtn: container.querySelector("#stopDownload") || getId("stopDownload"),

			videoToggle: container.querySelector("#videoTogglePlaylist") || container.querySelector("#videoToggle") || getId("videoToggle"),
			audioToggle: container.querySelector("#audioTogglePlaylist") || container.querySelector("#audioToggle") || getId("audioToggle"),
			advancedToggle: container.querySelector("#advancedToggle") || getId("advancedToggle"),
			videoBox: container.querySelector("#videoBox") || getId("videoBox"),
			audioBox: container.querySelector("#audioBox") || getId("audioBox"),
			videoQualitySelect: container.querySelector("#select") || getId("select"),
			videoTypeSelect: container.querySelector("#videoTypeSelect") || getId("videoTypeSelect"),
			typeSelectBox: container.querySelector("#typeSelectBox") || getId("typeSelectBox"),
			audioTypeSelect: container.querySelector("#audioSelect") || getId("audioSelect"),
			audioQualitySelect: container.querySelector("#audioQualitySelect") || getId("audioQualitySelect"),

			advancedMenu: container.querySelector("#advancedMenu") || getId("advancedMenu"),
			playlistIndexInput: container.querySelector("#playlistIndex") || getId("playlistIndex"),
			playlistEndInput: container.querySelector("#playlistEnd") || getId("playlistEnd"),
			subtitlesCheckbox: container.querySelector("#subCheckedPlaylist") || container.querySelector("#subChecked") || getId("subChecked"),
			closeHiddenBtn: container.querySelector("#closeHiddenPlaylist") || container.querySelector("#closeHidden") || getId("closeHidden"),

			playlistNameDisplay: container.querySelector("#playlistName") || getId("playlistName"),
			errorMsgDisplay: container.querySelector("#incorrectMsgPlaylist") || container.querySelector("#incorrectMsg") || getId("incorrectMsg"),
			errorBtn: container.querySelector("#errorBtnPlaylist") || container.querySelector("#errorBtn") || getId("errorBtn"),
			errorDetails: container.querySelector("#errorDetailsPlaylist") || container.querySelector("#errorDetails") || getId("errorDetails"),

			menuIcon: getId("menuIcon"),
			menu: getId("menu"),
			preferenceWinBtn: getId("preferenceWin"),
			aboutWinBtn: getId("aboutWin"),
			historyWinBtn: getId("historyWin"),
			homeWinBtn: getId("homeWin"),
			compressorWinBtn: getId("compressorWin"),
			searchWinBtn: getId("searchWin"),
		};
	},

	init() {
		const setup = () => {
			this.initUI();
			this.loadInitialConfig();
			this.initEventListeners();

			if (this.ui.pathDisplay) {
				this.ui.pathDisplay.textContent = this.state.downloadDir;
			}
			if (this.ui.videoToggle) {
				this.ui.videoToggle.style.backgroundColor = "var(--box-toggleOn)";
			}
			this.updateVideoTypeVisibility();
		};

		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => setup());
		} else {
			setup();
		}

		// Load translations when ready
		document.addEventListener("translations-loaded", () => {
			if (window.i18n && window.i18n.translatePage) {
				window.i18n.translatePage();
			}
		});
	},

	loadInitialConfig() {
		if (!this.ui.videoQualitySelect || !this.ui.videoQualitySelect.options) {
			this.initUI();
		}

		const isTestMode = Boolean(window.electronAPI && window.electronAPI.isTest);
		const mockYtDlp = isTestMode ? window.__mockYtDlp : null;

		if (mockYtDlp) {
			this.state.ytDlpPath = "mock-ytdlp";
			this.state.ytDlpWrap = mockYtDlp;
			this.state.ffmpegPath = "ffmpeg";
			this.state.jsRuntimePath = "";
		} else if (window.AppBinaries) {
			this.state.ytDlpPath = window.AppBinaries.ytDlpPath;
			this.state.ytDlpWrap = window.AppBinaries.ytDlp;
			this.state.ffmpegPath = window.AppBinaries.ffmpegPath;
			this.state.jsRuntimePath = window.AppBinaries.jsRuntimePath;
		} else {
			this.state.ytDlpPath = localStorage.getItem("ytdlp") || "";
			this.state.ytDlpWrap = this.state.ytDlpPath ? YTDlpWrap.new(this.state.ytDlpPath) : null;
			this.state.ffmpegPath = "";
			this.state.jsRuntimePath = "";
		}

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

		const preferredVideo = localStorage.getItem("preferredVideoQuality");
		if (preferredVideo && this.ui.videoQualitySelect) {
			this.ui.videoQualitySelect.value = preferredVideo;
		}
		if (this.ui.videoQualitySelect && !this.ui.videoQualitySelect.value) {
			this.ui.videoQualitySelect.value = "best";
		}

		const preferredAudioFormat = localStorage.getItem("preferredAudioQuality");
		if (preferredAudioFormat && this.ui.audioTypeSelect) {
			this.ui.audioTypeSelect.value = preferredAudioFormat;
		}
		if (this.ui.audioTypeSelect && !this.ui.audioTypeSelect.value) {
			this.ui.audioTypeSelect.value = "mp3";
		}
		if (this.ui.audioQualitySelect && !this.ui.audioQualitySelect.value) {
			this.ui.audioQualitySelect.value = "auto";
		}
	},

	initEventListeners() {
		this.ui.pasteLinkBtn.addEventListener("click", () => this.pasteLink());
		document.addEventListener("keydown", (event) => {
			const viewPlaylist = getId("view-playlist");
			if (!viewPlaylist || viewPlaylist.classList.contains("hidden")) return;

			const isCtrlV =
				(event.ctrlKey || (event.metaKey && os.platform() === "darwin")) &&
				(event.key?.toLowerCase() === "v" || event.code === "KeyV");

			const isInput =
				document.activeElement &&
				(document.activeElement.tagName === "INPUT" ||
					document.activeElement.tagName === "TEXTAREA" ||
					document.activeElement.isContentEditable);

			if (isCtrlV && !isInput) {
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

			...(this.config.cookie.arg && this.config.cookie.val
				? [this.config.cookie.arg, this.config.cookie.val]
				: []),

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
			this.ui.subtitlesCheckbox.checked ? "--sub-format" : "",
			this.ui.subtitlesCheckbox.checked ? "srt/best" : "",
			this.ui.subtitlesCheckbox.checked ? "--convert-subs" : "",
			this.ui.subtitlesCheckbox.checked ? "srt" : "",
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
				this.state.currentLocalCount = count;
				this.updatePlaylistUI(videoInfo, count, type);
			}
		});

		process.on("progress", (progress) => {
			const progressElement = getId(`p${count}`);
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
		if (this.state.currentDownloadProcess) {
			try {
				if (typeof this.state.currentDownloadProcess.kill === "function") {
					this.state.currentDownloadProcess.kill();
				}
			} catch (e) {}
			if (
				this.state.currentDownloadProcess.ytDlpProcess &&
				typeof this.state.currentDownloadProcess.ytDlpProcess.kill === "function"
			) {
				try {
					this.state.currentDownloadProcess.ytDlpProcess.kill();
				} catch (e) {}
			}
		}
		this.handleCancellation(this.state.currentLocalCount || 0);
	},

	handleCancellation(count) {
		this.state.isDownloading = false;
		this.ui.stopDownloadBtn.style.display = "none";
		this.ui.pasteLinkBtn.style.display = "inline-block";
		const targetCount = count !== undefined ? count : (this.state.currentLocalCount || 0);
		const lastProgress = getId(`p${targetCount}`);
		if (lastProgress) {
			lastProgress.textContent = window.i18n ? window.i18n.__("cancel") : "Cancelled";
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
			const prevProgress = getId(`p${count - 1}`);
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

		const cookieSource =
			localStorage.getItem("cookieSource") ||
			(localStorage.getItem("browser") ? "browser" : "none");
		const cookiesPath = await ipcRenderer.invoke("get-cookies-path");

		if (
			cookieSource === "file" &&
			cookiesPath &&
			fs.existsSync(cookiesPath) &&
			fs.statSync(cookiesPath).size > 0
		) {
			this.config.cookie.arg = "--cookies";
			this.config.cookie.val = cookiesPath;
		} else if (
			cookieSource === "browser" &&
			localStorage.getItem("browser")
		) {
			this.config.cookie.arg = "--cookies-from-browser";
			this.config.cookie.val = localStorage.getItem("browser");
		} else {
			this.config.cookie.arg = "";
			this.config.cookie.val = "";
		}

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
		if (this.state.isCancelled) {
			this.handleCancellation(count);
			return;
		}
		if (!this.state.isDownloading) return;
		this.state.isDownloading = false;
		this.ui.stopDownloadBtn.style.display = "none";

		const lastProgress = getId(`p${count}`);
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
		if (this.state.isCancelled) {
			this.handleCancellation(this.state.currentLocalCount || 0);
			return;
		}
		this.state.isDownloading = false;
		this.ui.stopDownloadBtn.style.display = "none";

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
		const show = !["best", "worst"].includes(value);
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
		this.closeMenu();
		const viewMap = {
			"/index.html": "view-home",
			"/search.html": "view-search",
			"/playlist.html": "view-playlist",
			"/compressor.html": "view-compressor",
			"/history.html": "view-history",
			"/preferences.html": "view-preferences",
			"/about.html": "view-about",
		};
		if (viewMap[page] && typeof window.switchView === "function") {
			window.switchView(viewMap[page]);
			return;
		}
		const event = type === "page" ? "load-page" : "load-win";
		ipcRenderer.send(event, path.join(__dirname, page));
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

window.playlistDownloader = playlistDownloader;
playlistDownloader.init();
