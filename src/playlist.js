import { getId, formatTime, escapeHtml } from "./utils.js";

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
		currentLocalCount: 0,
		currentMode: "batch", // "batch" or "selective"
	},

	selectiveState: {
		url: "",
		title: "",
		channel: "",
		entries: [],
		isFetching: false,
		isDownloading: false,
		isCancelled: false,
		activeControllers: [],
		bulkPreset: {
			type: "video",
			quality: "1080",
			format: "auto",
			audioExt: "mp3",
		},
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
	ui: {},

	initUI() {
		const container = getId("view-playlist") || document;

		this.ui = {
			// Mode switcher
			playlistModeBatchBtn: container.querySelector("#playlistModeBatchBtn"),
			playlistModeSelectiveBtn: container.querySelector("#playlistModeSelectiveBtn"),
			playlistBatchSection: container.querySelector("#playlistBatchSection"),
			playlistSelectiveSection: container.querySelector("#playlistSelectiveSection"),

			// Batch Mode UI
			pasteLinkBtn: container.querySelector("#pasteLink") || container.querySelector("#pasteLinkPlaylist") || getId("pasteLink"),
			linkDisplay: container.querySelector("#link") || getId("link"),
			optionsContainer: container.querySelector("#options") || getId("options"),
			downloadList: container.querySelector("#listPlaylist") || container.querySelector("#list") || getId("list"),

			downloadVideoBtn: container.querySelector("#download") || getId("download"),
			downloadAudioBtn: container.querySelector("#audioDownloadPlaylist") || container.querySelector("#audioDownload"),
			downloadThumbnailsBtn: container.querySelector("#downloadThumbnails") || getId("downloadThumbnails"),
			saveLinksBtn: container.querySelector("#saveLinks") || getId("saveLinks"),

			selectLocationBtn: container.querySelector("#playlistPathPicker") || container.querySelector("#selectLocationPlaylist") || container.querySelector("#selectLocation") || getId("selectLocation"),
			pathDisplay: container.querySelector("#playlistPathDisplay") || container.querySelector("#pathPlaylist") || container.querySelector("#path") || getId("path"),
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

			// Selective Mode UI
			pasteLinkSelectiveBtn: container.querySelector("#pasteLinkSelective"),
			selectiveLoadingWrapper: container.querySelector("#loadingWrapperPlaylistSelective"),
			selectiveIncorrectMsg: container.querySelector("#incorrectMsgSelective"),
			selectiveErrorBtn: container.querySelector("#errorBtnSelective"),
			selectiveErrorDetails: container.querySelector("#errorDetailsSelective"),
			selectiveContent: container.querySelector("#selectiveContent"),
			selectiveTitle: container.querySelector("#selectivePlaylistTitle"),
			selectiveChannel: container.querySelector("#selectivePlaylistChannel"),
			selectiveStatsBadge: container.querySelector("#selectiveStatsBadge"),
			selectiveSelectAllBtn: container.querySelector("#selectiveSelectAllBtn"),
			selectiveBulkVideoBtn: container.querySelector("#selectiveBulkVideoBtn"),
			selectiveBulkAudioBtn: container.querySelector("#selectiveBulkAudioBtn"),
			selectiveBulkVideoOptions: container.querySelector("#selectiveBulkVideoOptions"),
			selectiveBulkAudioOptions: container.querySelector("#selectiveBulkAudioOptions"),
			selectiveBulkResSelect: container.querySelector("#selectiveBulkResSelect"),
			selectiveBulkFormatSelect: container.querySelector("#selectiveBulkFormatSelect"),
			selectiveBulkAudioExtSelect: container.querySelector("#selectiveBulkAudioExtSelect"),
			selectiveApplyBulkBtn: container.querySelector("#selectiveApplyBulkBtn"),
			selectiveDownloadBtn: container.querySelector("#selectiveDownloadBtn"),
			selectiveDownloadCount: container.querySelector("#selectiveDownloadCount"),
			selectiveStopBtn: container.querySelector("#selectiveStopBtn"),
			selectiveOpenFolderBtn: container.querySelector("#selectiveOpenFolderBtn"),
			selectiveItemsList: container.querySelector("#selectiveItemsList"),
			emptyStateBatch: container.querySelector("#emptyStatePlaylist") || getId("emptyStatePlaylist"),
			emptyStateSelective: container.querySelector("#emptyStatePlaylistSelective") || getId("emptyStatePlaylistSelective"),

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
			this._updateEmptyStateUI();
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

		const preferredVideo =
			localStorage.getItem("preferredVideoQuality") || "1080";
		if (this.ui.videoQualitySelect) {
			this.ui.videoQualitySelect.value = preferredVideo;
		}
		if (this.ui.videoQualitySelect && !this.ui.videoQualitySelect.value) {
			this.ui.videoQualitySelect.value = "1080";
		}
		this.updateVideoTypeVisibility();

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

		// Sync selective bulk preset selects from saved preferences.
		const hasOption = (sel, val) =>
			sel && [...sel.options].some((o) => o.value === val);

		if (hasOption(this.ui.selectiveBulkResSelect, preferredVideo)) {
			this.ui.selectiveBulkResSelect.value = preferredVideo;
			this.selectiveState.bulkPreset.quality = preferredVideo;
		}
		const preferredAudioExt =
			localStorage.getItem("preferredAudioQuality") ||
			localStorage.getItem("preferredAudioFormat") ||
			"mp3";
		if (hasOption(this.ui.selectiveBulkAudioExtSelect, preferredAudioExt)) {
			this.ui.selectiveBulkAudioExtSelect.value = preferredAudioExt;
			this.selectiveState.bulkPreset.audioExt = preferredAudioExt;
		}
	},

	initEventListeners() {
		// Mode switching
		this.ui.playlistModeBatchBtn?.addEventListener("click", () =>
			this.switchPlaylistMode("batch"),
		);
		this.ui.playlistModeSelectiveBtn?.addEventListener("click", () =>
			this.switchPlaylistMode("selective"),
		);

		// Batch mode events
		this.ui.pasteLinkBtn?.addEventListener("click", () => this.pasteLink());

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
				if (this.state.currentMode === "batch") {
					if (!this.state.isDownloading) {
						this.pasteLink();
					}
				} else {
					if (!this.selectiveState.isFetching && !this.selectiveState.isDownloading) {
						this.pasteLinkSelective();
					}
				}
			}
		});

		this.ui.downloadVideoBtn?.addEventListener("click", () =>
			this.startDownload("video"),
		);
		this.ui.downloadAudioBtn?.addEventListener("click", () =>
			this.startDownload("audio"),
		);
		this.ui.downloadThumbnailsBtn?.addEventListener("click", () =>
			this.startDownload("thumbnails"),
		);
		this.ui.saveLinksBtn?.addEventListener("click", () =>
			this.startDownload("links"),
		);

		this.ui.videoToggle?.addEventListener("click", () =>
			this.toggleDownloadType("video"),
		);
		this.ui.audioToggle?.addEventListener("click", () =>
			this.toggleDownloadType("audio"),
		);
		this.ui.advancedToggle?.addEventListener("click", () =>
			this.toggleAdvancedMenu(),
		);
		this.ui.videoQualitySelect?.addEventListener("change", () =>
			this.updateVideoTypeVisibility(),
		);
		this.ui.selectLocationBtn?.addEventListener("click", () =>
			ipcRenderer.send("select-location-main", ""),
		);
		this.ui.openDownloadsBtn?.addEventListener("click", () =>
			this.openDownloadsFolder(),
		);
		this.ui.stopDownloadBtn?.addEventListener("click", () =>
			this.stopDownload(),
		);
		this.ui.closeHiddenBtn?.addEventListener("click", () =>
			this.hideOptions(true),
		);
		this.ui.errorBtn?.addEventListener("click", () => {
			if (!this.ui.errorDetails) return;
			const isHidden =
				this.ui.errorDetails.style.display === "none" ||
				this.ui.errorDetails.style.display === "";
			this.ui.errorDetails.style.display = isHidden ? "block" : "none";
			if (this.ui.errorBtn) {
				this.ui.errorBtn.textContent =
					(window.i18n ? window.i18n.__("errorDetails") : "Error Details") +
					(isHidden ? " ▼" : " ◀");
			}
		});

		// Selective Mode events
		this.ui.pasteLinkSelectiveBtn?.addEventListener("click", () =>
			this.pasteLinkSelective(),
		);
		this.ui.selectiveSelectAllBtn?.addEventListener("click", () =>
			this.toggleSelectAll(),
		);
		this.ui.selectiveBulkVideoBtn?.addEventListener("click", () =>
			this.setBulkType("video"),
		);
		this.ui.selectiveBulkAudioBtn?.addEventListener("click", () =>
			this.setBulkType("audio"),
		);
		this.ui.selectiveApplyBulkBtn?.addEventListener("click", () =>
			this.applyBulkSettings(),
		);
		this.ui.selectiveDownloadBtn?.addEventListener("click", () =>
			this.startSelectiveDownloads(),
		);
		this.ui.selectiveStopBtn?.addEventListener("click", () =>
			this.stopSelectiveDownloads(),
		);
		this.ui.selectiveOpenFolderBtn?.addEventListener("click", () =>
			this.openDownloadsFolder(),
		);

		this.ui.selectiveErrorBtn?.addEventListener("click", () => {
			const isHidden = this.ui.selectiveErrorDetails.style.display === "none";
			this.ui.selectiveErrorDetails.style.display = isHidden ? "block" : "none";
			this.ui.selectiveErrorBtn.textContent =
				(window.i18n ? window.i18n.__("errorDetails") : "Error Details") +
				(isHidden ? " ▼" : " ◀");
		});

		this.ui.preferenceWinBtn?.addEventListener("click", () =>
			this.navigate("page", "/preferences.html"),
		);
		this.ui.aboutWinBtn?.addEventListener("click", () =>
			this.navigate("page", "/about.html"),
		);
		this.ui.historyWinBtn?.addEventListener("click", () =>
			this.navigate("page", "/history.html"),
		);
		this.ui.homeWinBtn?.addEventListener("click", () =>
			this.navigate("win", "/index.html"),
		);
		this.ui.compressorWinBtn?.addEventListener("click", () =>
			this.navigate("win", "/compressor.html"),
		);
		this.ui.searchWinBtn?.addEventListener("click", () =>
			this.navigate("win", "/search.html"),
		);

		ipcRenderer.on("downloadPath", (_event, downloadPath) => {
			if (downloadPath && downloadPath[0]) {
				if (this.ui.pathDisplay) {
					this.ui.pathDisplay.textContent = downloadPath[0];
				}
				this.state.downloadDir = downloadPath[0];
			}
		});

		window.addEventListener("beforeunload", () => {
			if (this.state.currentAbortController) {
				try {
					this.state.currentAbortController.abort();
				} catch (_) { }
			}
			if (
				this.state.currentDownloadProcess?.ytDlpProcess &&
				!this.state.currentDownloadProcess.ytDlpProcess.killed
			) {
				try {
					this.state.currentDownloadProcess.ytDlpProcess.kill();
				} catch (_) { }
			}
			this.selectiveState.activeControllers.forEach((c) => {
				try {
					c.abort();
				} catch (_) { }
			});
		});
	},

	/**
	 * Shows or hides the 'No downloads yet' empty state components on playlist page.
	 */
	_updateEmptyStateUI() {
		const emptyBatch =
			this.ui.emptyStateBatch || getId("emptyStatePlaylist");
		if (emptyBatch) {
			const optionsVisible =
				this.ui.optionsContainer &&
				this.ui.optionsContainer.style.display !== "none";
			const hasDownloads =
				this.ui.downloadList &&
				this.ui.downloadList.children.length > 0;

			if (optionsVisible || hasDownloads || this.state.isDownloading) {
				emptyBatch.style.display = "none";
			} else {
				emptyBatch.style.display = "flex";
			}
		}

		const emptySelective =
			this.ui.emptyStateSelective || getId("emptyStatePlaylistSelective");
		if (emptySelective) {
			const selectiveContentVisible =
				this.ui.selectiveContent &&
				this.ui.selectiveContent.style.display !== "none";
			const loadingVisible =
				this.ui.selectiveLoadingWrapper &&
				this.ui.selectiveLoadingWrapper.style.display !== "none";
			const hasEntries =
				this.selectiveState.entries &&
				this.selectiveState.entries.length > 0;

			if (
				selectiveContentVisible ||
				loadingVisible ||
				hasEntries ||
				this.selectiveState.isFetching ||
				this.selectiveState.isDownloading
			) {
				emptySelective.style.display = "none";
			} else {
				emptySelective.style.display = "flex";
			}
		}
	},

	switchPlaylistMode(mode) {
		this.state.currentMode = mode;
		if (mode === "batch") {
			this.ui.playlistModeBatchBtn?.classList.add("active");
			this.ui.playlistModeSelectiveBtn?.classList.remove("active");
			if (this.ui.playlistBatchSection) this.ui.playlistBatchSection.style.display = "flex";
			if (this.ui.playlistSelectiveSection) this.ui.playlistSelectiveSection.style.display = "none";
		} else {
			this.ui.playlistModeSelectiveBtn?.classList.add("active");
			this.ui.playlistModeBatchBtn?.classList.remove("active");
			if (this.ui.playlistBatchSection) this.ui.playlistBatchSection.style.display = "none";
			if (this.ui.playlistSelectiveSection) this.ui.playlistSelectiveSection.style.display = "flex";
		}
		this._updateEmptyStateUI();
	},

	// ==========================================
	// SELECTIVE PLAYLIST MODE IMPLEMENTATION
	// ==========================================

	pasteLinkSelective() {
		if (this.selectiveState.isFetching || this.selectiveState.isDownloading) return;
		const rawUrl = clipboard.readText();
		this.fetchSelectivePlaylist(rawUrl);
	},

	async fetchSelectivePlaylist(rawUrl) {
		let url;
		try {
			url = this.validateUrl(rawUrl);
		} catch (_) {
			this.handleSelectiveError(
				window.i18n ? window.i18n.__("errorNetworkOrUrl") : "Invalid URL",
				rawUrl,
			);
			return;
		}

		await this.updateDynamicConfig();

		this.selectiveState.url = url;
		this.selectiveState.isFetching = true;
		this.selectiveState.entries = [];

		if (this.ui.selectiveLoadingWrapper) this.ui.selectiveLoadingWrapper.style.display = "flex";
		if (this.ui.selectiveIncorrectMsg) this.ui.selectiveIncorrectMsg.textContent = "";
		if (this.ui.selectiveErrorBtn) this.ui.selectiveErrorBtn.style.display = "none";
		if (this.ui.selectiveErrorDetails) {
			this.ui.selectiveErrorDetails.style.display = "none";
			this.ui.selectiveErrorDetails.textContent = "";
		}
		if (this.ui.selectiveContent) this.ui.selectiveContent.style.display = "none";
		this._updateEmptyStateUI();

		const args = [
			"--yes-playlist",
			"--flat-playlist",
			"-J",
			"--no-warnings",
			"--compat-options",
			"no-youtube-unavailable-videos",
			...this._getPlayerClientArgs(),
			...(this.config.cookie.arg && this.config.cookie.val
				? [this.config.cookie.arg, this.config.cookie.val]
				: []),
			...(this.config.proxy
				? ["--no-check-certificate", "--proxy", this.config.proxy]
				: []),
			url,
		];

		const wrap = this.state.ytDlpWrap;

		if (!wrap) {
			this.selectiveState.isFetching = false;
			if (this.ui.selectiveLoadingWrapper) this.ui.selectiveLoadingWrapper.style.display = "none";
			this.handleSelectiveError("yt-dlp binary not configured", url);
			return;
		}

		try {
			const proc = wrap.exec(args, { shell: false });
			let stdout = "";
			let stderr = "";

			proc.ytDlpProcess?.stdout?.on("data", (data) => {
				stdout += typeof data === "string" ? data : data.toString();
			});
			proc.ytDlpProcess?.stderr?.on("data", (data) => {
				stderr += typeof data === "string" ? data : data.toString();
			});

			proc.on("close", () => {
				this.selectiveState.isFetching = false;
				if (this.ui.selectiveLoadingWrapper) this.ui.selectiveLoadingWrapper.style.display = "none";

				if (!stdout) {
					this.handleSelectiveError(
						stderr || "Failed to fetch playlist data",
						url,
					);
					return;
				}

				try {
					const parsed = JSON.parse(stdout);
					if (parsed && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
						this.selectiveState.title = parsed.title || "Playlist";
						this.selectiveState.channel = parsed.channel || parsed.uploader || "";

						const prefVideo = localStorage.getItem("preferredVideoQuality") || "1080";
						const prefAudio = localStorage.getItem("preferredAudioQuality") || "mp3";

						this.selectiveState.entries = parsed.entries.map((entry, index) => {
							const id = entry.id || `entry_${index + 1}`;
							const videoTitle = entry.title || `Video ${index + 1}`;
							const duration = typeof entry.duration === "number" ? entry.duration : 0;
							const durationStr = duration > 0 ? formatTime(duration) : "";

							let thumbUrl = "../assets/images/thumb.png";
							if (Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
								const bestThumb = entry.thumbnails[entry.thumbnails.length - 1]?.url || entry.thumbnails[0]?.url;
								if (bestThumb) thumbUrl = bestThumb;
							}

							const itemUrl = entry.url
								? (entry.url.startsWith("http") ? entry.url : `https://www.youtube.com/watch?v=${entry.url}`)
								: (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : url);

							return {
								id: id,
								index: index + 1,
								title: videoTitle,
								channel: entry.channel || entry.uploader || this.selectiveState.channel,
								duration: duration,
								durationStr: durationStr,
								thumbnail: thumbUrl,
								url: itemUrl,
								selected: true,
								type: "video",
								quality: prefVideo,
								format: "auto",
								audioExt: prefAudio,
								audioQuality: "auto",
								status: "ready", // ready, downloading, completed, error, cancelled
							};
						});

						if (this.ui.selectiveTitle) {
							this.ui.selectiveTitle.textContent = this.selectiveState.title;
							this.ui.selectiveTitle.title = this.selectiveState.title;
						}
						if (this.ui.selectiveChannel) {
							this.ui.selectiveChannel.textContent = this.selectiveState.channel;
						}

						this.renderSelectiveItems();
						this.updateSelectiveStats();

						if (this.ui.selectiveContent) {
							this.ui.selectiveContent.style.display = "block";
						}
						this._updateEmptyStateUI();
					} else {
						this.handleSelectiveError(
							window.i18n ? window.i18n.__("errorNetworkOrUrl") : "No video entries found in playlist",
							url,
						);
					}
				} catch (err) {
					this.handleSelectiveError(err.message || "Failed to parse playlist data", url);
				}
			});

			proc.on("error", (err) => {
				this.selectiveState.isFetching = false;
				if (this.ui.selectiveLoadingWrapper) this.ui.selectiveLoadingWrapper.style.display = "none";
				this.handleSelectiveError(err.message || String(err), url);
			});
		} catch (err) {
			this.selectiveState.isFetching = false;
			if (this.ui.selectiveLoadingWrapper) this.ui.selectiveLoadingWrapper.style.display = "none";
			this.handleSelectiveError(err.message || String(err), url);
		}
	},

	renderSelectiveItems() {
		if (!this.ui.selectiveItemsList) return;
		this.ui.selectiveItemsList.innerHTML = "";
		const fragment = document.createDocumentFragment();

		this.selectiveState.entries.forEach((entry, index) => {
			const card = document.createElement("div");
			card.className = `selective-item-card ${entry.selected ? "" : "unselected"}`;
			card.id = `sel_card_${index}`;

			const isVideo = entry.type === "video";
			const safeTitle = escapeHtml(entry.title);
			const safeChannel = escapeHtml(entry.channel || "");
			const rawThumb = entry.thumbnail && /^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|data:|blob:)/i.test(entry.thumbnail)
				? entry.thumbnail
				: "../assets/images/thumb.png";
			const safeThumb = escapeHtml(rawThumb);

			card.innerHTML = `
				<div class="selective-item-left">
					<input type="checkbox" class="cb selective-cb" id="sel_cb_${index}" ${entry.selected ? "checked" : ""}>
					<div class="selective-thumb-wrap">
						<img src="${safeThumb}" alt="thumb" class="selective-thumb" crossorigin="anonymous">
						${entry.durationStr ? `<span class="selective-duration">${entry.durationStr}</span>` : ""}
					</div>
				</div>
				<div class="selective-item-info">
					<div class="selective-item-title" title="${safeTitle}">${entry.index}. ${safeTitle}</div>
					<div class="selective-item-meta">${safeChannel}</div>
					<div class="selective-item-controls">
						<select class="select-compact selective-type-select" id="sel_type_${index}">
							<option value="video" ${isVideo ? "selected" : ""}>Video</option>
							<option value="audio" ${!isVideo ? "selected" : ""}>Audio</option>
						</select>

						<select class="select-compact selective-res-select" id="sel_res_${index}" style="${isVideo ? "" : "display: none;"}">
							<option value="best" ${entry.quality === "best" ? "selected" : ""}>Best</option>
							<option value="4320" ${entry.quality === "4320" ? "selected" : ""}>8K (4320p)</option>
							<option value="2160" ${entry.quality === "2160" ? "selected" : ""}>4K (2160p)</option>
							<option value="1440" ${entry.quality === "1440" ? "selected" : ""}>1440p (2K)</option>
							<option value="1080" ${entry.quality === "1080" ? "selected" : ""}>1080p (FHD)</option>
							<option value="720" ${entry.quality === "720" ? "selected" : ""}>720p (HD)</option>
							<option value="480" ${entry.quality === "480" ? "selected" : ""}>480p</option>
							<option value="360" ${entry.quality === "360" ? "selected" : ""}>360p</option>
							<option value="240" ${entry.quality === "240" ? "selected" : ""}>240p</option>
							<option value="144" ${entry.quality === "144" ? "selected" : ""}>144p</option>
							<option value="worst" ${entry.quality === "worst" ? "selected" : ""}>Worst</option>
						</select>

						<select class="select-compact selective-format-select" id="sel_fmt_${index}" style="${isVideo ? "" : "display: none;"}">
							<option value="auto" ${entry.format === "auto" ? "selected" : ""}>Auto</option>
							<option value="mp4" ${entry.format === "mp4" ? "selected" : ""}>MP4</option>
							<option value="mkv" ${entry.format === "mkv" ? "selected" : ""}>MKV</option>
							<option value="webm" ${entry.format === "webm" ? "selected" : ""}>WebM</option>
						</select>

						<select class="select-compact selective-audio-ext-select" id="sel_aext_${index}" style="${!isVideo ? "" : "display: none;"}">
							<option value="mp3" ${entry.audioExt === "mp3" ? "selected" : ""}>MP3</option>
							<option value="m4a" ${entry.audioExt === "m4a" ? "selected" : ""}>M4A</option>
							<option value="opus" ${entry.audioExt === "opus" ? "selected" : ""}>OPUS</option>
							<option value="wav" ${entry.audioExt === "wav" ? "selected" : ""}>WAV</option>
							<option value="flac" ${entry.audioExt === "flac" ? "selected" : ""}>FLAC</option>
							<option value="alac" ${entry.audioExt === "alac" ? "selected" : ""}>ALAC</option>
						</select>
					</div>

					<div class="selective-item-status" id="sel_status_${index}" style="display: none;">
						<div class="selective-prog-bar"><div class="selective-prog-fill" id="sel_bar_${index}"></div></div>
						<span class="selective-prog-text" id="sel_txt_${index}">Ready</span>
					</div>
				</div>
			`;

			fragment.appendChild(card);

			// Checkbox change listener
			const cb = card.querySelector(`#sel_cb_${index}`);
			cb?.addEventListener("change", (e) => {
				entry.selected = e.target.checked;
				if (entry.selected) {
					card.classList.remove("unselected");
				} else {
					card.classList.add("unselected");
				}
				this.updateSelectiveStats();
			});

			// Type change listener
			const typeSelect = card.querySelector(`#sel_type_${index}`);
			const resSelect = card.querySelector(`#sel_res_${index}`);
			const fmtSelect = card.querySelector(`#sel_fmt_${index}`);
			const aextSelect = card.querySelector(`#sel_aext_${index}`);

			typeSelect?.addEventListener("change", (e) => {
				entry.type = e.target.value;
				const isVid = entry.type === "video";
				if (resSelect) resSelect.style.display = isVid ? "inline-block" : "none";
				if (fmtSelect) fmtSelect.style.display = isVid ? "inline-block" : "none";
				if (aextSelect) aextSelect.style.display = !isVid ? "inline-block" : "none";
			});

			resSelect?.addEventListener("change", (e) => {
				entry.quality = e.target.value;
			});

			fmtSelect?.addEventListener("change", (e) => {
				entry.format = e.target.value;
			});

			aextSelect?.addEventListener("change", (e) => {
				entry.audioExt = e.target.value;
			});
		});

		this.ui.selectiveItemsList.appendChild(fragment);
	},

	toggleSelectAll() {
		this.selectiveState.allSelected = !this.selectiveState.allSelected;
		this.selectiveState.entries.forEach((entry, index) => {
			entry.selected = this.selectiveState.allSelected;
			const cb = document.getElementById(`sel_cb_${index}`);
			if (cb) cb.checked = entry.selected;

			const card = document.getElementById(`sel_card_${index}`);
			if (card) {
				if (entry.selected) {
					card.classList.remove("unselected");
				} else {
					card.classList.add("unselected");
				}
			}
		});

		this.updateSelectiveStats();
	},

	updateSelectiveStats() {
		const total = this.selectiveState.entries.length;
		const selectedCount = this.selectiveState.entries.filter((e) => e.selected).length;

		if (this.ui.selectiveStatsBadge) {
			const vText = window.i18n ? window.i18n.__("videosCount") : "videos";
			const sText = window.i18n ? window.i18n.__("selectedCount") : "selected";
			this.ui.selectiveStatsBadge.textContent = `${total} ${vText} (${selectedCount} ${sText})`;
		}

		if (this.ui.selectiveDownloadCount) {
			this.ui.selectiveDownloadCount.textContent = selectedCount;
		}

		if (this.ui.selectiveSelectAllBtn) {
			this.selectiveState.allSelected = selectedCount === total && total > 0;
			this.ui.selectiveSelectAllBtn.textContent = this.selectiveState.allSelected
				? (window.i18n ? window.i18n.__("deselectAll") : "Deselect All")
				: (window.i18n ? window.i18n.__("selectAll") : "Select All");
		}
	},

	setBulkType(type) {
		this.selectiveState.bulkPreset.type = type;
		if (type === "video") {
			this.ui.selectiveBulkVideoBtn?.classList.add("active");
			this.ui.selectiveBulkAudioBtn?.classList.remove("active");
			if (this.ui.selectiveBulkVideoOptions) this.ui.selectiveBulkVideoOptions.style.display = "flex";
			if (this.ui.selectiveBulkAudioOptions) this.ui.selectiveBulkAudioOptions.style.display = "none";
		} else {
			this.ui.selectiveBulkAudioBtn?.classList.add("active");
			this.ui.selectiveBulkVideoBtn?.classList.remove("active");
			if (this.ui.selectiveBulkVideoOptions) this.ui.selectiveBulkVideoOptions.style.display = "none";
			if (this.ui.selectiveBulkAudioOptions) this.ui.selectiveBulkAudioOptions.style.display = "flex";
		}
	},

	applyBulkSettings() {
		const type = this.selectiveState.bulkPreset.type;
		const quality = this.ui.selectiveBulkResSelect?.value || "1080";
		const format = this.ui.selectiveBulkFormatSelect?.value || "auto";
		const audioExt = this.ui.selectiveBulkAudioExtSelect?.value || "mp3";

		this.selectiveState.entries.forEach((entry, index) => {
			if (!entry.selected) return;

			entry.type = type;
			entry.quality = quality;
			entry.format = format;
			entry.audioExt = audioExt;

			const typeSelect = document.getElementById(`sel_type_${index}`);
			const resSelect = document.getElementById(`sel_res_${index}`);
			const fmtSelect = document.getElementById(`sel_fmt_${index}`);
			const aextSelect = document.getElementById(`sel_aext_${index}`);

			if (typeSelect) typeSelect.value = type;
			if (resSelect) {
				resSelect.value = quality;
				resSelect.style.display = type === "video" ? "inline-block" : "none";
			}
			if (fmtSelect) {
				fmtSelect.value = format;
				fmtSelect.style.display = type === "video" ? "inline-block" : "none";
			}
			if (aextSelect) {
				aextSelect.value = audioExt;
				aextSelect.style.display = type === "audio" ? "inline-block" : "none";
			}
		});
	},

	async startSelectiveDownloads() {
		const selectedEntries = this.selectiveState.entries.filter((e) => e.selected);
		if (selectedEntries.length === 0) {
			alert(window.i18n ? window.i18n.__("noVideosSelected") : "No videos selected");
			return;
		}

		if (this.selectiveState.isDownloading) return;

		this.selectiveState.isDownloading = true;
		this.selectiveState.isCancelled = false;
		this.selectiveState.activeControllers = [];

		if (this.ui.selectiveDownloadBtn) this.ui.selectiveDownloadBtn.style.display = "none";
		if (this.ui.selectiveStopBtn) this.ui.selectiveStopBtn.style.display = "inline-flex";
		if (this.ui.selectiveOpenFolderBtn) this.ui.selectiveOpenFolderBtn.style.display = "inline-flex";

		await this.updateDynamicConfig();

		let safePlaylistTitle = this.selectiveState.title || "Playlist";
		safePlaylistTitle = safePlaylistTitle
			.replaceAll("|", "｜")
			.replaceAll(`"`, `＂`)
			.replaceAll("*", "＊")
			.replaceAll("/", "⧸")
			.replaceAll("\\", "⧹")
			.replaceAll(":", "：")
			.replaceAll("?", "？")
			.replaceAll("<", "＜")
			.replaceAll(">", "＞");

		if (os.platform() === "win32" && safePlaylistTitle.endsWith(".")) {
			safePlaylistTitle = safePlaylistTitle.slice(0, -1) + "#";
		}

		this.state.playlistName = safePlaylistTitle;
		const targetFolder = (this.config.foldernameFormat || "%(playlist_title)s")
			.replaceAll("%(playlist_title)s", safePlaylistTitle);

		for (const [index, entry] of this.selectiveState.entries.entries()) {
			if (!entry.selected) continue;
			if (this.selectiveState.isCancelled) break;

			const statusEl = document.getElementById(`sel_status_${index}`);
			const barEl = document.getElementById(`sel_bar_${index}`);
			const txtEl = document.getElementById(`sel_txt_${index}`);

			if (statusEl) statusEl.style.display = "flex";
			if (barEl) barEl.style.width = "0%";
			if (txtEl) txtEl.textContent = window.i18n ? window.i18n.__("downloading") : "Downloading...";

			const abortController = new AbortController();
			this.selectiveState.activeControllers.push(abortController);

			let formatArgs = [];
			if (entry.type === "video") {
				if (entry.quality === "best") {
					formatArgs = ["-f", "bv*+ba/best"];
				} else if (entry.quality === "worst") {
					formatArgs = ["-f", "wv+wa/worst"];
				} else {
					formatArgs = [
						"-f",
						`bestvideo[height<=${entry.quality}]+bestaudio/best[height<=${entry.quality}]/best`,
					];
				}

				if (entry.format !== "auto") {
					formatArgs.push("--merge-output-format", entry.format, "--recode-video", entry.format);
				}
			} else {
				formatArgs = [
					"-x",
					"--audio-format",
					entry.audioExt || "mp3",
					"--audio-quality",
					entry.audioQuality || "auto",
				];
			}

			const filenameTemplate = (this.config.filenameFormat || "%(playlist_index)s.%(title)s.%(ext)s")
				.replaceAll("%(playlist_index)s", String(entry.index))
				.replaceAll("%(playlist_title)s", safePlaylistTitle);

			const outputPath = path.join(
				this.state.downloadDir,
				targetFolder,
				filenameTemplate,
			);

			const args = [
				"--no-playlist",
				"-o",
				outputPath,
				"--ffmpeg-location",
				this.state.ffmpegPath,
				...this._getPlayerClientArgs(),
				...(this.state.jsRuntimePath
					? ["--no-js-runtimes", "--js-runtime", this.state.jsRuntimePath]
					: []),
				...(this.config.cookie.arg && this.config.cookie.val
					? [this.config.cookie.arg, this.config.cookie.val]
					: []),
				...(this.config.proxy
					? ["--no-check-certificate", "--proxy", this.config.proxy]
					: []),
				...formatArgs,
				entry.url,
			].filter(Boolean);

			console.log(`Command: ${this.state.ytDlpPath}`, args.join(" "));

			try {
				await new Promise((resolve) => {
					const proc = this.state.ytDlpWrap.exec(
						args,
						{ shell: false },
						abortController.signal,
					);

					proc.on("progress", (prog) => {
						if (barEl && prog.percent) {
							barEl.style.width = `${prog.percent}%`;
						}
						if (txtEl) {
							if (prog.percent === 100) {
								txtEl.textContent = window.i18n ? window.i18n.__("processing") : "Processing...";
							} else if (prog.percent) {
								txtEl.textContent = `${prog.percent}% | ${prog.currentSpeed || "0"}`;
							}
						}
					});

					proc.on("close", () => {
						if (!this.selectiveState.isCancelled) {
							if (barEl) barEl.style.width = "100%";
							if (txtEl) txtEl.textContent = window.i18n ? window.i18n.__("fileSaved") : "Completed";
							entry.status = "completed";

							// Add to history
							try {
								ipcRenderer.invoke("add-to-history", {
									title: entry.title,
									url: entry.url,
									format: entry.type === "video" ? (entry.format || "mp4") : (entry.audioExt || "mp3"),
									thumbnail: entry.thumbnail,
									duration: entry.duration,
									filePath: this.state.downloadDir,
								});
							} catch (_) { }
						}
						resolve();
					});

					proc.on("error", (err) => {
						if (this.selectiveState.isCancelled) {
							if (txtEl) txtEl.textContent = window.i18n ? window.i18n.__("cancel") : "Cancelled";
						} else {
							if (txtEl) txtEl.textContent = err.message || "Error";
							entry.status = "error";
						}
						resolve();
					});
				});
			} catch (_) { }

			this.selectiveState.activeControllers = this.selectiveState.activeControllers.filter(
				(c) => c !== abortController,
			);
		}

		this.selectiveState.isDownloading = false;
		if (this.ui.selectiveDownloadBtn) this.ui.selectiveDownloadBtn.style.display = "inline-flex";
		if (this.ui.selectiveStopBtn) this.ui.selectiveStopBtn.style.display = "none";

		const completedEntries = selectedEntries.filter((e) => e.status === "completed");

		if (!this.selectiveState.isCancelled && completedEntries.length > 0) {
			const notify = new Notification("ytDownloader", {
				body: window.i18n ? window.i18n.__("playlistDownloaded") : "Playlist download finished",
				icon: "../assets/images/icon.png",
			});
			notify.onclick = () => this.openDownloadsFolder();
		}
	},

	stopSelectiveDownloads() {
		this.selectiveState.isCancelled = true;
		this.selectiveState.isDownloading = false;

		this.selectiveState.activeControllers.forEach((controller) => {
			try {
				controller.abort();
			} catch (_) { }
		});
		this.selectiveState.activeControllers = [];

		if (this.ui.selectiveDownloadBtn) this.ui.selectiveDownloadBtn.style.display = "inline-flex";
		if (this.ui.selectiveStopBtn) this.ui.selectiveStopBtn.style.display = "none";
		this._updateEmptyStateUI();
	},

	handleSelectiveError(error, url = "") {
		if (this.ui.selectiveIncorrectMsg) {
			this.ui.selectiveIncorrectMsg.textContent = window.i18n
				? window.i18n.__("errorNetworkOrUrl")
				: "Some error has occurred. Check your network and use correct URL";
		}
		if (this.ui.selectiveErrorBtn) {
			this.ui.selectiveErrorBtn.style.display = "inline-block";
		}
		if (this.ui.selectiveErrorDetails) {
			this.ui.selectiveErrorDetails.innerHTML = `<strong>URL: ${url}</strong><br><br>${String(error)}`;
		}
		this._updateEmptyStateUI();
	},

	// ==========================================
	// BATCH PLAYLIST MODE IMPLEMENTATION
	// ==========================================

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
			this._updateEmptyStateUI();

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
				{ shell: false },
				this.state.currentAbortController.signal,
			);

			this.handleDownloadEvents(this.state.currentDownloadProcess, type);
		} catch (error) {
			this.showError(error);
		}
	},

	buildBaseArgs() {
		const { start, end } = this.config.playlistRange;
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

			...this._getPlayerClientArgs(),

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

	_getPlayerClientArgs() {
		const raw = localStorage.getItem("youtubePlayerClients");
		const clients = (raw !== null && raw !== undefined) ? raw.trim() : "default";
		return clients ? ["--extractor-args", `youtube:player_client=${clients}`] : [];
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

				if (this.ui.playlistNameDisplay) {
					const dlText = window.i18n
						? window.i18n.__("downloadingPlaylist")
						: "Downloading playlist:";
					this.ui.playlistNameDisplay.textContent = `${dlText} ${this.state.playlistName}`;
				}
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

					if (
						typeof videoInfo.title === "string" &&
						((videoInfo.title.startsWith('"') && videoInfo.title.endsWith('"')) ||
							(videoInfo.title.startsWith("'") && videoInfo.title.endsWith("'"))) &&
						videoInfo.title.length >= 2
					) {
						videoInfo.title = videoInfo.title.slice(1, -1);
					}

					videoInfo.thumbnail = eventItems[3];
				} catch (error) { }

				count++;
				this.state.originalCount++;
				this.state.currentLocalCount = count;
				this.updatePlaylistUI(videoInfo, count, type);
			}
		});

		process.on("progress", (progress) => {
			const progressElement = getId(`p${count}`);
			const barElement = getId(`bar${count}`);

			if (barElement && progress.percent) {
				barElement.style.width = `${progress.percent}%`;
			}

			if (!progressElement) return;

			if (progress.percent === 100) {
				const procText = window.i18n
					? window.i18n.__("processing")
					: "Processing";
				progressElement.textContent = `${procText}...`;
			} else if (progress.percent) {
				const progText = window.i18n
					? window.i18n.__("progress")
					: "Progress";
				const speedText = window.i18n
					? window.i18n.__("speed")
					: "Speed";
				progressElement.textContent = `${progText} ${progress.percent
					}% | ${speedText} ${progress.currentSpeed || "0"
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
			} catch (e) { }
			if (
				this.state.currentDownloadProcess.ytDlpProcess &&
				typeof this.state.currentDownloadProcess.ytDlpProcess.kill === "function"
			) {
				try {
					this.state.currentDownloadProcess.ytDlpProcess.kill();
				} catch (e) { }
			}
		}
		this.handleCancellation(this.state.currentLocalCount || 0);
	},

	handleCancellation(count) {
		this.state.isDownloading = false;
		if (this.ui.stopDownloadBtn) this.ui.stopDownloadBtn.style.display = "none";
		if (this.ui.pasteLinkBtn) this.ui.pasteLinkBtn.style.display = "inline-block";
		const targetCount = count !== undefined ? count : (this.state.currentLocalCount || 0);
		const lastProgress = getId(`p${targetCount}`);
		const lastBar = getId(`bar${targetCount}`);
		if (lastProgress) {
			lastProgress.textContent = window.i18n ? window.i18n.__("cancel") : "Cancelled";
		}
		if (lastBar) {
			lastBar.classList.add("cancelled");
		}
		this._updateEmptyStateUI();
	},

	pasteLink() {
		if (this.state.isDownloading) return;
		this.state.url = clipboard.readText();
		this.ui.linkDisplay.textContent = ` ${this.state.url}`;
		this.ui.optionsContainer.style.display = "block";
		this.ui.optionsContainer.classList.remove("fade-out");
		this.ui.optionsContainer.classList.add("fade-in");
		this.ui.errorMsgDisplay.textContent = "";
		this.ui.errorBtn.style.display = "none";
		this._updateEmptyStateUI();
	},

	updatePlaylistUI(videoInfo, count, type) {
		let itemTypeLabel = "";
		switch (type) {
			case "thumbnails":
				itemTypeLabel = window.i18n ? window.i18n.__("thumbnail") : "Thumbnail";
				break;
			case "links":
				itemTypeLabel = window.i18n ? window.i18n.__("link") : "Link";
				break;
			case "audio":
				itemTypeLabel = window.i18n ? window.i18n.__("audio") : "Audio";
				break;
			default:
				itemTypeLabel = window.i18n ? window.i18n.__("video") : "Video";
		}

		const itemTitle = `${itemTypeLabel} ${this.state.originalCount}`;

		if (count > 1) {
			const prevProgress = getId(`p${count - 1}`);
			const prevBar = getId(`bar${count - 1}`);
			if (prevProgress)
				prevProgress.textContent = window.i18n ? window.i18n.__("fileSaved") : "Completed";
			if (prevBar) {
				prevBar.style.width = "100%";
				prevBar.classList.add("completed");
			}
		}

		const thumbnailUrl =
			typeof videoInfo.thumbnail === "string"
				? videoInfo.thumbnail.trim()
				: "";
		const safeThumbnail =
			thumbnailUrl &&
				/^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|data:|blob:)/i.test(thumbnailUrl)
				? escapeHtml(thumbnailUrl)
				: "../assets/images/thumb.png";
		const safeAlt = escapeHtml(videoInfo.title || "thumbnail");
		const itemIndex = escapeHtml(videoInfo.index ?? this.state.originalCount);
		const rawTitle = videoInfo.title
			? `${videoInfo.index ?? this.state.originalCount}. ${videoInfo.title}`
			: itemTitle;
		const safeTitleText = escapeHtml(rawTitle);
		const safeTypeLabel = escapeHtml(itemTypeLabel);

		const itemElement = document.createElement("div");
		itemElement.className = "item playlist-item-card";
		itemElement.id = `item-${count}`;

		itemElement.innerHTML = `
			<div class="itemIconBox playlist-thumb-container">
				<img src="${safeThumbnail}" alt="${safeAlt}" class="itemIcon playlist-item-thumb" crossorigin="anonymous">
				<span class="playlist-type-badge">${safeTypeLabel}</span>
			</div>
			<div class="itemBody playlist-item-body">
				<div class="playlist-item-top-row">
					<div class="itemTitle playlist-item-title" title="${safeTitleText}">${safeTitleText}</div>
					<span class="playlist-index-pill">#${itemIndex}</span>
				</div>
				<div class="playlist-progress-wrapper">
					<div class="custom-progress playlist-progress-track">
						<div class="custom-progress-fill playlist-progress-fill" id="bar${count}"></div>
					</div>
					<div class="playlist-progress-meta">
						<p class="itemProgress playlist-progress-text" id="p${count}">${window.i18n ? escapeHtml(window.i18n.__("downloading")) : "Downloading..."}</p>
					</div>
				</div>
			</div>
		`;

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
		const proxyMode =
			localStorage.getItem("proxyMode") ||
			(localStorage.getItem("proxy") ? "custom" : "system");

		if (proxyMode === "custom") {
			this.config.proxy = localStorage.getItem("proxy") || "";
		} else if (proxyMode === "system") {
			this.config.proxy = "";
			try {
				const proxy = await ipcRenderer.invoke("get-system-proxy");
				if (proxy) {
					console.log("Using system proxy: " + proxy);
					this.config.proxy = proxy;
				}
			} catch (err) {
				console.error("Failed to get system proxy:", err);
			}
		} else {
			this.config.proxy = "";
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
			Number(this.ui.playlistIndexInput?.value) || 1;
		this.config.playlistRange.end = this.ui.playlistEndInput?.value || "";
		this.state.originalCount =
			this.config.playlistRange.start > 1
				? this.config.playlistRange.start - 1
				: 0;

		// Reset playlist name for new download
		this.state.playlistName = "";
	},

	hideOptions(justHide = false) {
		if (this.ui.optionsContainer) {
			this.ui.optionsContainer.style.display = "none";
			this.ui.optionsContainer.classList.remove("fade-in");
		}
		if (this.ui.downloadList) this.ui.downloadList.innerHTML = "";
		if (this.ui.errorBtn) this.ui.errorBtn.style.display = "none";
		if (this.ui.errorDetails) {
			this.ui.errorDetails.style.display = "none";
			this.ui.errorDetails.textContent = "";
		}
		if (this.ui.errorMsgDisplay) this.ui.errorMsgDisplay.style.display = "none";
		if (this.ui.stopDownloadBtn) this.ui.stopDownloadBtn.style.display = "none";

		if (!justHide) {
			if (this.ui.playlistNameDisplay) {
				const procText = window.i18n
					? window.i18n.__("processing")
					: "Processing";
				this.ui.playlistNameDisplay.textContent = `${procText}...`;
			}
			if (this.ui.pasteLinkBtn) this.ui.pasteLinkBtn.style.display = "none";
			if (this.ui.openDownloadsBtn) this.ui.openDownloadsBtn.style.display = "inline-block";
			if (this.ui.stopDownloadBtn) this.ui.stopDownloadBtn.style.display = "inline-block";
		}
		this._updateEmptyStateUI();
	},

	finishDownload(count) {
		if (this.state.isCancelled) {
			this.handleCancellation(count);
			return;
		}
		if (!this.state.isDownloading) return;
		this.state.isDownloading = false;
		if (this.ui.stopDownloadBtn) this.ui.stopDownloadBtn.style.display = "none";

		const lastProgress = getId(`p${count}`);
		if (lastProgress) {
			lastProgress.textContent = window.i18n
				? window.i18n.__("fileSaved")
				: "Completed";
		}
		if (this.ui.pasteLinkBtn) this.ui.pasteLinkBtn.style.display = "inline-block";
		if (this.ui.openDownloadsBtn) this.ui.openDownloadsBtn.style.display = "inline-block";

		const notify = new Notification("ytDownloader", {
			body: window.i18n
				? window.i18n.__("playlistDownloaded")
				: "Playlist download finished",
			icon: "../assets/images/icon.png",
		});

		notify.onclick = () => this.openDownloadsFolder();
		this._updateEmptyStateUI();
	},

	showError(error) {
		if (
			this.state.isCancelled ||
			error?.name === "AbortError" ||
			error?.message?.includes("AbortError")
		) {
			this.handleCancellation(this.state.currentLocalCount || 0);
			return;
		}
		this.state.isDownloading = false;
		if (this.ui.stopDownloadBtn) this.ui.stopDownloadBtn.style.display = "none";

		console.error("Download Error:", error?.toString?.() || error);
		if (this.ui.pasteLinkBtn) this.ui.pasteLinkBtn.style.display = "inline-block";
		if (this.ui.openDownloadsBtn) this.ui.openDownloadsBtn.style.display = "none";
		if (this.ui.optionsContainer) this.ui.optionsContainer.style.display = "block";
		if (this.ui.playlistNameDisplay) this.ui.playlistNameDisplay.textContent = "";
		if (this.ui.errorMsgDisplay) {
			this.ui.errorMsgDisplay.textContent = window.i18n
				? window.i18n.__("errorNetworkOrUrl")
				: "Some error has occurred. Check your network and use correct URL";
			this.ui.errorMsgDisplay.style.display = "block";
			this.ui.errorMsgDisplay.title = error?.toString?.() || String(error);
		}
		if (this.ui.errorBtn) this.ui.errorBtn.style.display = "inline-block";
		if (this.ui.errorDetails) {
			this.ui.errorDetails.innerHTML = `<strong>URL: ${escapeHtml(
				this.state.url
			)}</strong><br><br>${escapeHtml(error?.toString?.() || String(error))}`;
		}
		this._updateEmptyStateUI();
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
			if (result && !result.success) {
				ipcRenderer.invoke("open-folder", this.state.downloadDir);
			}
		});
	},

	toggleDownloadType(type) {
		const isVideo = type === "video";
		this.ui.videoToggle?.classList.toggle("active", isVideo);
		this.ui.audioToggle?.classList.toggle("active", !isVideo);
		if (this.ui.videoToggle) {
			this.ui.videoToggle.style.backgroundColor = isVideo
				? "var(--box-toggleOn)"
				: "var(--box-toggle)";
		}
		if (this.ui.audioToggle) {
			this.ui.audioToggle.style.backgroundColor = isVideo
				? "var(--box-toggle)"
				: "var(--box-toggleOn)";
		}
		if (this.ui.videoBox) {
			this.ui.videoBox.style.display = isVideo ? "block" : "none";
			if (isVideo) this.ui.videoBox.classList.add("fade-in");
		}
		if (this.ui.audioBox) {
			this.ui.audioBox.style.display = isVideo ? "none" : "block";
			if (!isVideo) this.ui.audioBox.classList.add("fade-in");
		}
	},

	updateVideoTypeVisibility() {
		const value = this.ui.videoQualitySelect?.value;
		const show = !["best", "worst"].includes(value);
		if (this.ui.typeSelectBox) {
			this.ui.typeSelectBox.style.display = show ? "flex" : "none";
		}
	},

	toggleAdvancedMenu() {
		if (!this.ui.advancedMenu) return;
		const isHidden =
			this.ui.advancedMenu.style.display === "none" ||
			this.ui.advancedMenu.style.display === "" ||
			!this.ui.advancedMenu.classList.contains("open");

		if (isHidden) {
			this.ui.advancedMenu.style.display = "block";
			void this.ui.advancedMenu.offsetHeight;
			this.ui.advancedMenu.classList.add("open");
			this.ui.advancedToggle?.classList.add("open");
		} else {
			this.ui.advancedMenu.classList.remove("open");
			this.ui.advancedToggle?.classList.remove("open");
			setTimeout(() => {
				if (!this.ui.advancedMenu.classList.contains("open")) {
					this.ui.advancedMenu.style.display = "none";
				}
			}, 250);
		}
	},

	closeMenu() {
		if (this.ui.menuIcon) this.ui.menuIcon.style.transform = "rotate(0deg)";
		if (this.ui.menu) this.ui.menu.style.opacity = "0";
		setTimeout(() => {
			if (this.ui.menu) this.ui.menu.style.display = "none";
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
