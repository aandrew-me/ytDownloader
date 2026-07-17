const {spawn, execSync} = require("child_process");
const path = require("path");
const {ipcRenderer} = require("electron");
const os = require("os");
const si = require("systeminformation");
const {existsSync} = require("fs");
const crypto = require("crypto");

document.addEventListener("translations-loaded", () => {
	window.i18n.translatePage();
});

let menuIsOpen = false;

/**
 * @param {string} id
 */
function getId(id) {
	return document.getElementById(id);
}

const dom = {
	menuIcon: getId("menuIcon"),
	menu: getId("menu"),
	fileInput: getId("fileInput"),
	selectedFilesDiv: getId("selected-files"),
	customFolderSelect: getId("custom-folder-select"),
	customFolderPath: getId("custom-folder-path"),
	compressBtn: getId("compress-btn"),
	cancelBtn: getId("cancel-btn"),
	compressionStatus: getId("compression-status"),
	themeToggle: getId("themeToggle"),
	outputFolderInput: getId("output-folder-input"),
	preferenceWin: getId("preferenceWin"),
	playlistWin: getId("playlistWin"),
	aboutWin: getId("aboutWin"),
	historyWin: getId("historyWin"),
	homeWin: getId("homeWin"),
	searchWin: getId("searchWin"),
	encoder: getId("encoder"),
	compressionSpeed: getId("compression-speed"),
	videoQuality: getId("video-quality"),
	audioFormat: getId("audio-format"),
	fileExtension: getId("file_extension"),
	outputSuffix: getId("output-suffix"),
	targetSizeInput: getId("target-size-input"),
	qualitySlider: getId("quality-slider"),
	customQualityContainer: getId("custom-quality-container"),
	targetSizeContainer: getId("target-size-container"),
	targetPercentInput: getId("target-percent-input"),
	targetPercentContainer: getId("target-percent-container"),
	advancedToggleBtn: getId("advanced-toggle-btn"),
	advancedSettingsCollapse: getId("advanced-settings-collapse"),
};

function openMenu() {
	dom.menuIcon.style.transform = "rotate(90deg)";
	menuIsOpen = true;
	dom.menu.style.display = "flex";

	setTimeout(() => {
		dom.menu.style.opacity = "1";
	}, 20);
}

function closeMenu() {
	dom.menuIcon.style.transform = "rotate(0deg)";
	menuIsOpen = false;
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			dom.menu.style.display = "none";
			clearInterval(fade);
		} else {
			opacity -= 0.1;
			dom.menu.style.opacity = opacity.toFixed(2);
			count++;
		}
	}, 50);
}

dom.menuIcon.addEventListener("click", () => {
	if (menuIsOpen) {
		closeMenu();
	} else {
		openMenu();
	}
});

const ffmpeg = getFfmpegPath();
console.log(ffmpeg);

const vaapi_device = "/dev/dri/renderD128";

// Checking GPU
si.graphics().then((info) => {
	console.log({gpuInfo: info});
	const platform = os.platform();

	const selectorMap = {
		nvidia: ".nvidia_opt",
		amf: platform === "win32" ? ".amf_opt" : ".vaapi_opt",
		qsv:
			platform === "win32"
				? ".qsv_opt"
				: platform !== "darwin"
					? ".vaapi_opt"
					: null,
		videotoolbox: platform === "darwin" ? ".videotoolbox_opt" : null,
	};

	info.controllers.forEach((gpu) => {
		const gpuName = gpu.vendor.toLowerCase();
		const gpuModel = gpu.model.toLowerCase();
		let selector = null;

		if (gpuName.includes("nvidia") || gpuModel.includes("nvidia")) {
			selector = selectorMap.nvidia;
		} else if (
			gpuName.includes("advanced micro devices") ||
			gpuModel.includes("amd")
		) {
			selector = selectorMap.amf;
		} else if (gpuName.includes("intel")) {
			selector = selectorMap.qsv;
		} else if (platform === "darwin") {
			selector = selectorMap.videotoolbox;
		}

		if (selector) {
			document.querySelectorAll(selector).forEach((opt) => {
				opt.style.display = "block";
			});
		}
	});
});

/** @type {File[]} */
let files = [];
let activeProcesses = new Set();
let currentItemId = "";
let isCancelled = false;

// File Handling
const dropZone = document.querySelector(".drop-zone");

dropZone.addEventListener("dragover", (e) => {
	e.preventDefault();
	dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
	dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
	e.preventDefault();
	dropZone.classList.remove("dragover");
	files = Array.from(e.dataTransfer.files);
	updateSelectedFiles();
});

dom.fileInput.addEventListener("change", (e) => {
	files = Array.from(e.target.files);
	updateSelectedFiles();
});

dom.customFolderSelect.addEventListener("click", () => {
	ipcRenderer.send("get-directory", "");
});

function updateSelectedFiles() {
	const fileList = files
		.map((f) => `${f.name} (${formatBytes(f.size)})<br/>`)
		.join("\n");
	dom.selectedFilesDiv.innerHTML = fileList || "No files selected";
}

// Compression Logic
dom.compressBtn.addEventListener("click", startCompression);
dom.cancelBtn.addEventListener("click", cancelCompression);

async function startCompression() {
	if (files.length === 0) return alert("Please select files first!");

	const settings = getEncoderSettings();
	isCancelled = false; // Ensure clean state at the start

	for (const file of files) {
		// Check if cancellation happened before starting this file
		if (isCancelled) break;

		const itemId = "f" + crypto.randomUUID().replace(/-/g, "");
		currentItemId = itemId;

		const outputPath = generateOutputPath(file, settings);

		try {
			await compressVideo(file, settings, itemId, outputPath);

			if (isCancelled) {
				break; // Break the loop if cancelled during compression
			} else {
				updateProgress("success", "", itemId);
				const fileSavedElement = document.createElement("b");
				fileSavedElement.textContent = i18n.__("fileSavedClickToOpen");
				fileSavedElement.onclick = () => {
					ipcRenderer.send("show-file", outputPath);
				};
				getId(itemId + "_prog")?.appendChild(fileSavedElement);
			}
		} catch (error) {
			if (isCancelled) {
				break; // Break loop if process was killed by cancel button
			}

			const errorElement = document.createElement("div");
			errorElement.onclick = () => {
				ipcRenderer.send("error_dialog", error.message);
			};
			errorElement.textContent = i18n.__("errorClickForDetails");
			updateProgress("error", "", itemId);
			getId(itemId + "_prog")?.appendChild(errorElement);
		}
	}

	// Reset states when queue finishes or is broken
	currentItemId = "";
	isCancelled = false;
}

function cancelCompression() {
	isCancelled = true;

	activeProcesses.forEach((child) => {
		child.stdin.write("q");
	});
	activeProcesses.clear();

	updateProgress("error", "Cancelled", currentItemId);
}

/**
 * @param {File} file
 */
function generateOutputPath(file, settings) {
	const output_extension = settings.extension;
	const parsed_file = path.parse(file.path);
	const outputDir = settings.outputPath || parsed_file.dir;

	if (output_extension === "unchanged") {
		return path.join(
			outputDir,
			`${parsed_file.name}${settings.outputSuffix}${parsed_file.ext}`,
		);
	}

	return path.join(
		outputDir,
		`${parsed_file.name}_compressed.${output_extension}`,
	);
}

/**
 * @param {File} file
 * @param {{ encoder: any; speed: any; videoQuality: any; audioQuality?: any; audioFormat: string, extension: string }} settings
 * @param {string} itemId
 * @param {string} outputPath
 */
async function compressVideo(file, settings, itemId, outputPath) {
	const args = await buildFFmpegArgs(file, settings, outputPath);
	console.log("Command: " + args.join(" "));

	return new Promise((resolve, reject) => {
		const child = spawn(ffmpeg, args);

		activeProcesses.add(child);
		child.on("exit", () => {
			activeProcesses.delete(child);
		});

		let video_info = {duration: ""};
		let stderrOutput = "";

		createProgressItem(
			path.basename(file.path),
			"progress",
			"Starting...",
			itemId,
		);

		child.stderr.on("data", (data) => {
			const dataStr = data.toString();

			stderrOutput += dataStr;

			// Parse duration
			const duration_match = dataStr.match(/Duration:\s*([\d:.]+)/);
			if (duration_match) {
				video_info.duration = duration_match[1];
			}

			// Parse progress
			const progressTime = dataStr.match(/time=(\d+:\d+:\d+\.\d+)/);
			const totalSeconds = timeToSeconds(video_info.duration);
			const currentSeconds =
				progressTime && progressTime.length > 1
					? timeToSeconds(progressTime[1])
					: null;

			if (currentSeconds && totalSeconds > 0 && !isCancelled) {
				const progress = Math.round(
					(currentSeconds / totalSeconds) * 100,
				);

				const progElem = getId(itemId + "_prog");

				if (progElem) {
					let progressBar = progElem.querySelector(
						".progressBarCompress",
					);

					if (!progressBar) {
						progElem.innerHTML = `
							<progress
								class="progressBarCompress"
								min="0"
								max="100"
								value="${progress}">
							</progress>`;
					} else {
						progressBar.value = progress;
					}
				}
			}
		});

		child.on("error", reject);

		child.on("close", (code) => {
			if (code !== 0 && !isCancelled) {
				reject(
					new Error(
						`FFmpeg exited with code ${code}\n\n${stderrOutput.trim()}`,
					),
				);
			} else {
				resolve();
			}
		});
	});
}

function getCRFValue(settings) {
	const isHEVC =
		settings.encoder === "x265" ||
		settings.encoder === "hevc_qsv" ||
		settings.encoder === "hevc_amf" ||
		settings.encoder === "hevc_nvenc" ||
		settings.encoder === "hevc_vaapi" ||
		settings.encoder === "hevc_videotoolbox";

	if (settings.videoQuality === "small") {
		return isHEVC ? "32" : "28";
	}
	if (settings.videoQuality === "balanced") {
		return isHEVC ? "28" : "23";
	}
	if (settings.videoQuality === "high") {
		return isHEVC ? "23" : "18";
	}

	const num = parseInt(settings.videoQuality, 10);
	return isNaN(num) ? "23" : num.toString();
}

/**
 * @param {File} file
 * @param {{ encoder: string; speed: string; videoQuality: string; audioQuality: string; audioFormat: string }} settings
 * @param {string} outputPath
 */
async function buildFFmpegArgs(file, settings, outputPath) {
	const inputPath = file.path;
	console.log("Output path: " + outputPath);

	const resolvedSettings = {...settings};

	if (resolvedSettings.encoder === "auto") {
		try {
			const codec = await getVideoCodec(inputPath);

			if (["hevc", "h265", "av1", "av01", "vp9"].includes(codec)) {
				resolvedSettings.encoder = "x265";
			} else {
				resolvedSettings.encoder = "x264";
			}
		} catch (error) {
			console.error(
				"Failed to detect input codec, falling back to x264",
				error,
			);
			resolvedSettings.encoder = "x264";
		}
	}

	const args = ["-hide_banner", "-y", "-stats", "-i", inputPath];

	let useBitrate = false;
	let videoBitrate = 0;
	let audioBitrate = 128000;

	const containerOverheadFactor = 0.985;

	if (resolvedSettings.videoQuality === "target-size") {
		try {
			const duration = await getVideoDuration(inputPath);
			if (duration > 0) {
				const targetSizeMB = parseFloat(resolvedSettings.targetSize);
				if (!isNaN(targetSizeMB) && targetSizeMB > 0) {
					const containerOverheadFactor = 0.985;
					const targetSizeBytes =
						targetSizeMB * 1024 * 1024 * containerOverheadFactor;
					const totalTargetBitrate = (targetSizeBytes * 8) / duration;

					if (totalTargetBitrate < 250000) {
						audioBitrate = 64000;
					}

					videoBitrate = totalTargetBitrate - audioBitrate;

					if (videoBitrate < 100000) {
						videoBitrate = Math.max(
							50000,
							totalTargetBitrate * 0.8,
						);
					}

					useBitrate = true;
				}
			}
		} catch (error) {
			console.error(
				"Failed to estimate duration for bitrate calculation, falling back to CRF 23",
				error,
			);
		}
	}

	if (resolvedSettings.videoQuality === "target-percent") {
		try {
			const duration = await getVideoDuration(inputPath);
			if (duration > 0) {
				const targetPercent = parseFloat(
					resolvedSettings.targetPercent,
				);
				if (
					!isNaN(targetPercent) &&
					targetPercent > 0 &&
					targetPercent <= 100
				) {
					const targetSizeBytes =
						file.size *
						(targetPercent / 100) *
						containerOverheadFactor;
					const targetBitrateBits = (targetSizeBytes * 8) / duration;

					audioBitrate = targetBitrateBits < 250000 ? 64000 : 128000;
					videoBitrate = targetBitrateBits - audioBitrate;

					if (videoBitrate < 100000) {
						videoBitrate = Math.max(50000, targetBitrateBits * 0.8);
						audioBitrate = Math.max(
							32000,
							targetBitrateBits - videoBitrate,
						);
					}
					useBitrate = true;
				}
			}
		} catch (error) {
			console.error(
				"Failed to estimate duration for percentage calculation, falling back to CRF 23",
				error,
			);
		}
	}

	const quality = getCRFValue(resolvedSettings);

	switch (resolvedSettings.encoder) {
		case "copy":
			args.push("-c:v", "copy");
			break;
		case "x264":
			args.push(
				"-c:v",
				"libx264",
				"-preset",
				resolvedSettings.speed,
				"-vf",
				"format=yuv420p",
			);
			if (useBitrate) {
				args.push("-b:v", Math.round(videoBitrate).toString());
			} else {
				args.push("-crf", quality);
			}
			break;
		case "x265":
			args.push(
				"-c:v",
				"libx265",
				"-vf",
				"format=yuv420p",
				"-preset",
				resolvedSettings.speed,
			);
			if (useBitrate) {
				args.push("-b:v", Math.round(videoBitrate).toString());
			} else {
				args.push("-crf", quality);
			}
			break;
		case "qsv":
		case "hevc_qsv": {
			const codec =
				resolvedSettings.encoder === "qsv" ? "h264_qsv" : "hevc_qsv";

			args.push(
				"-c:v",
				codec,
				"-vf",
				"format=yuv420p",
				"-preset",
				resolvedSettings.speed,
			);

			switch (resolvedSettings.speed) {
				case "medium":
					args.push(
						"-extbrc",
						"1",
						"-adaptive_i",
						"1",
						"-adaptive_b",
						"1",
					);
					break;

				case "slow":
					args.push(
						"-extbrc",
						"1",
						"-look_ahead_depth",
						"40",
						"-adaptive_i",
						"1",
						"-adaptive_b",
						"1",
						"-rdo",
						"1",
						"-mbbrc",
						"1",
					);
					break;
			}

			if (useBitrate) {
				args.push(
					"-b:v",
					Math.round(videoBitrate).toString(),
					"-rc_mode",
					"vbr",
				);
			} else {
				args.push("-global_quality", quality);
			}

			break;
		}
		case "vaapi":
		case "hevc_vaapi": {
			const codec =
				resolvedSettings.encoder === "vaapi"
					? "h264_vaapi"
					: "hevc_vaapi";

			args.push(
				"-vaapi_device",
				vaapi_device,
				"-vf",
				"format=nv12,hwupload",
				"-c:v",
				codec,
			);

			switch (resolvedSettings.speed) {
				case "medium":
					args.push("-async_depth", "4");
					break;

				case "slow":
					args.push("-async_depth", "4", "-b_depth", "2");
					break;
			}

			if (useBitrate) {
				args.push(
					"-rc_mode",
					"VBR",
					"-b:v",
					Math.round(videoBitrate).toString(),
				);
			} else {
				args.push("-qp", quality);
			}

			break;
		}
		case "nvenc":
		case "hevc_nvenc": {
			const codec =
				resolvedSettings.encoder === "nvenc"
					? "h264_nvenc"
					: "hevc_nvenc";

			args.push(
				"-c:v",
				codec,
				"-vf",
				"format=yuv420p",
				"-preset",
				getNvencPreset(resolvedSettings.speed),
			);

			switch (resolvedSettings.speed) {
				case "medium":
					args.push("-spatial_aq", "1", "-aq-strength", "8");
					break;

				case "slow":
					args.push(
						"-spatial_aq",
						"1",
						"-temporal_aq",
						"1",
						"-aq-strength",
						"8",
						"-rc-lookahead",
						"32",
					);
					break;
			}

			if (useBitrate) {
				args.push(
					"-rc",
					"vbr_hq",
					"-b:v",
					Math.round(videoBitrate).toString(),
				);

				if (resolvedSettings.speed === "medium") {
					args.push("-multipass", "qres");
				} else if (resolvedSettings.speed === "slow") {
					args.push("-multipass", "fullres");
				}
			} else {
				args.push("-rc", "vbr", "-cq", quality);
			}

			break;
		}
		case "amf": {
			const speedToQuality = {
				fast: "speed",
				medium: "balanced",
				slow: "quality",
			};

			const amfQuality =
				speedToQuality[resolvedSettings.speed] || "balanced";

			args.push(
				"-c:v",
				"h264_amf",
				"-vf",
				"format=yuv420p",
				"-quality",
				amfQuality,
			);

			switch (resolvedSettings.speed) {
				case "medium":
					args.push("-vbaq", "true");
					break;

				case "slow":
					args.push(
						"-usage",
						"high_quality",
						"-preanalysis",
						"true",
						"-preencode",
						"true",
						"-vbaq",
						"true",
						"-pa_lookahead_buffer_depth",
						"41",
						"-pa_paq_mode",
						"caq",
						"-pa_taq_mode",
						"2",
						"-pa_scene_change_detection_enable",
						"true",
						"-pa_high_motion_quality_boost_mode",
						"auto",
					);
					break;
			}

			if (useBitrate) {
				args.push(
					"-rc",
					resolvedSettings.speed === "fast" ? "cbr" : "hqcbr",
					"-b:v",
					Math.round(videoBitrate).toString(),
				);
			} else {
				args.push(
					"-rc",
					"cqp",
					"-qp_i",
					quality,
					"-qp_p",
					quality,
					"-qp_b",
					quality,
				);
			}

			break;
		}

		case "hevc_amf": {
			const speedToQuality = {
				fast: "speed",
				medium: "balanced",
				slow: "quality",
			};

			const amfQuality =
				speedToQuality[resolvedSettings.speed] || "balanced";

			args.push(
				"-c:v",
				"hevc_amf",
				"-vf",
				"format=yuv420p",
				"-quality",
				amfQuality,
			);

			switch (resolvedSettings.speed) {
				case "medium":
					args.push("-vbaq", "true");
					break;

				case "slow":
					args.push(
						"-usage",
						"high_quality",
						"-preanalysis",
						"true",
						"-preencode",
						"true",
						"-vbaq",
						"true",
						"-pa_lookahead_buffer_depth",
						"41",
						"-pa_paq_mode",
						"caq",
						"-pa_taq_mode",
						"2",
						"-pa_scene_change_detection_enable",
						"true",
						"-pa_high_motion_quality_boost_mode",
						"auto",
					);
					break;
			}

			if (useBitrate) {
				args.push(
					"-rc",
					resolvedSettings.speed === "fast" ? "cbr" : "hqcbr",
					"-b:v",
					Math.round(videoBitrate).toString(),
				);
			} else {
				args.push("-rc", "cqp", "-qp_i", quality, "-qp_p", quality);
			}

			break;
		}
		case "videotoolbox":
			args.push("-c:v", "h264_videotoolbox", "-vf", "format=yuv420p");
			if (useBitrate) {
				args.push("-b:v", Math.round(videoBitrate).toString());
			} else {
				args.push("-q:v", quality);
			}
			break;
		case "hevc_videotoolbox":
			args.push("-c:v", "hevc_videotoolbox", "-vf", "format=yuv420p");
			if (useBitrate) {
				args.push("-b:v", Math.round(videoBitrate).toString());
			} else {
				args.push("-q:v", quality);
			}
			break;
	}

	const audioFormat =
		useBitrate && resolvedSettings.audioFormat === "copy"
			? "aac"
			: resolvedSettings.audioFormat;

	args.push("-c:a", audioFormat);

	if (audioFormat !== "copy") {
		const audioBitrateString = `${Math.round(audioBitrate / 1000)}k`;
		args.push("-b:a", audioBitrateString);
	}

	args.push(outputPath);

	return args;
}

/**
 * @returns {{ encoder: string; speed: string; videoQuality: string; audioQuality?: string; audioFormat: string, extension: string, outputPath:string, outputSuffix: string }} settings
 */
function getEncoderSettings() {
	return {
		encoder: dom.encoder.value,
		speed: dom.compressionSpeed.value,
		videoQuality: dom.videoQuality.value,
		audioFormat: dom.audioFormat.value,
		extension: dom.fileExtension.value,
		outputPath: dom.customFolderPath.textContent,
		outputSuffix: dom.outputSuffix.value,
		targetSize: dom.targetSizeInput ? dom.targetSizeInput.value : "25",
		targetPercent: dom.targetPercentInput
			? dom.targetPercentInput.value
			: "50",
	};
}

/**
 * @param {string | number} speed
 */
function getNvencPreset(speed) {
	const presets = {fast: "p3", medium: "p4", slow: "p5"};
	return presets[speed] || "p4";
}

/**
 * @param {string} status
 * @param {string} data
 * @param {string} itemId
 */
function updateProgress(status, data, itemId) {
	if (status === "success" || status === "error") {
		const item = getId(itemId);
		if (item) {
			item.classList.remove("progress");
			item.classList.add(status);
		}
	}

	if (itemId) {
		const progItem = getId(itemId + "_prog");
		if (progItem) progItem.textContent = data;
	}
}

/**
 * @param {string} filename
 * @param {string} status
 * @param {string} data
 * @param {string} itemId
 */
function createProgressItem(filename, status, data, itemId) {
	const newStatus = document.createElement("div");
	newStatus.id = itemId;
	newStatus.className = `status-item ${status}`;
	const visibleFilename = filename.substring(0, 45);
	const filenameDiv = document.createElement("div");
	filenameDiv.className = "filename";
	filenameDiv.textContent = visibleFilename;

	const progDiv = document.createElement("div");
	progDiv.id = `${itemId}_prog`;
	progDiv.className = "itemProgressInfo";
	progDiv.textContent = data;

	newStatus.append(filenameDiv, progDiv);
	dom.compressionStatus.append(newStatus);
	dom.compressionStatus.scrollIntoView({behavior: "smooth", block: "end"});
}

/**
 * @param {number} bytes
 */
function formatBytes(bytes) {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * @param {string} timeStr
 */
function timeToSeconds(timeStr) {
	if (!timeStr) return 0;
	const [hh, mm, ss] = timeStr.split(":").map(parseFloat);
	return hh * 3600 + mm * 60 + ss;
}

function getFfmpegPath() {
	if (
		process.env.YTDOWNLOADER_FFMPEG_PATH &&
		existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)
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
				"ffmpeg.exe",
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
				"ffmpeg",
			);
	}
}

dom.themeToggle.addEventListener("change", () => {
	const theme = dom.themeToggle.value;
	document.documentElement.setAttribute("theme", theme);
	localStorage.setItem("theme", theme);
});

dom.outputFolderInput.addEventListener("change", (e) => {
	const checked = e.target.checked;
	if (!checked) {
		dom.customFolderSelect.style.display = "block";
	} else {
		dom.customFolderSelect.style.display = "none";
		dom.customFolderPath.textContent = "";
		dom.customFolderPath.style.display = "none";
	}
});

const storageTheme = localStorage.getItem("theme") || "frappe";
document.documentElement.setAttribute("theme", storageTheme);
dom.themeToggle.value = storageTheme;

ipcRenderer.on("directory-path", (_event, msg) => {
	dom.customFolderPath.textContent = msg;
	dom.customFolderPath.style.display = "inline";
});

// DRWed Menu Router Engine
const menuRoutes = {
	preferenceWin: {page: "/preferences.html", channel: "load-page"},
	playlistWin: {page: "/playlist.html", channel: "load-win"},
	aboutWin: {page: "/about.html", channel: "load-page"},
	historyWin: {page: "/history.html", channel: "load-page"},
	homeWin: {page: "/index.html", channel: "load-win"},
	searchWin: {page: "/search.html", channel: "load-win"},
};

Object.entries(menuRoutes).forEach(([domKey, route]) => {
	dom[domKey]?.addEventListener("click", () => {
		closeMenu();
		ipcRenderer.send(route.channel, __dirname + route.page);
	});
});

// Target Size / CRF Mode helper functions
function getFfprobePath() {
	const ffmpegPath = getFfmpegPath();
	if (!ffmpegPath) return "";
	const dir = path.dirname(ffmpegPath);
	const ext = os.platform() === "win32" ? ".exe" : "";
	return path.join(dir, "ffprobe" + ext);
}

function getVideoDuration(filePath) {
	const ffprobe = getFfprobePath();
	return new Promise((resolve, reject) => {
		const child = spawn(ffprobe, [
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"default=noprint_wrappers=1:nokey=1",
			filePath,
		]);
		let output = "";
		const timeout = setTimeout(() => {
			child.kill();
			reject(new Error("ffprobe timeout"));
		}, 10000);
		child.stdout.on("data", (data) => {
			output += data.toString();
		});
		child.on("close", (code) => {
			clearTimeout(timeout);
			if (code === 0) {
				const duration = parseFloat(output.trim());
				if (!isNaN(duration)) {
					resolve(duration);
				} else {
					reject(new Error("Invalid duration format"));
				}
			} else {
				reject(new Error(`ffprobe exited with code ${code}`));
			}
		});
		child.on("error", (err) => {
			clearTimeout(timeout);
			reject(err);
		});
	});
}

function getVideoCodec(filePath) {
	const ffprobe = getFfprobePath();
	return new Promise((resolve) => {
		const child = spawn(ffprobe, [
			"-v",
			"error",
			"-select_streams",
			"v:0",
			"-show_entries",
			"stream=codec_name",
			"-of",
			"default=noprint_wrappers=1:nokey=1",
			filePath,
		]);
		let output = "";
		const timeout = setTimeout(() => {
			child.kill();
			resolve("h264"); // Fallback if probe times out
		}, 5000);

		child.stdout.on("data", (data) => {
			output += data.toString();
		});
		child.on("close", (code) => {
			clearTimeout(timeout);
			if (code === 0) {
				resolve(output.trim().toLowerCase());
			} else {
				resolve("h264");
			}
		});
		child.on("error", () => {
			clearTimeout(timeout);
			resolve("h264");
		});
	});
}

function updateCRFDisplay(crf) {
	const valElem = getId("crf-val");
	if (valElem) valElem.textContent = crf;

	let descKey = "qualityBalancedDesc";
	if (crf <= 20) {
		descKey = "qualityHighDesc";
	} else if (crf <= 25) {
		descKey = "qualityBalancedDesc";
	} else if (crf <= 28) {
		descKey = "qualitySmallFileDesc";
	} else {
		descKey = "qualityCustomDesc";
	}

	const descElem = getId("crf-desc");
	if (descElem) {
		descElem.textContent = window.i18n ? window.i18n.__(descKey) : descKey;
	}
}

// Listeners for Video Quality Presets & Accordion
document.querySelectorAll(".preset-btn").forEach((btn) => {
	btn.addEventListener("click", () => {
		document
			.querySelectorAll(".preset-btn")
			.forEach((b) => b.classList.remove("active"));
		btn.classList.add("active");

		const quality = btn.getAttribute("data-quality");

		if (quality === "custom") {
			dom.customQualityContainer.style.display = "block";
			dom.targetSizeContainer.style.display = "none";
			dom.targetPercentContainer.style.display = "none";
			const sliderVal = parseInt(dom.qualitySlider.value, 10);
			const crf = 69 - sliderVal;
			dom.videoQuality.value = crf.toString();
			updateCRFDisplay(crf);
		} else if (quality === "target-size") {
			dom.customQualityContainer.style.display = "none";
			dom.targetSizeContainer.style.display = "block";
			dom.targetPercentContainer.style.display = "none";
			dom.videoQuality.value = "target-size";
		} else if (quality === "target-percent") {
			dom.customQualityContainer.style.display = "none";
			dom.targetSizeContainer.style.display = "none";
			dom.targetPercentContainer.style.display = "block";
			dom.videoQuality.value = "target-percent";
		} else {
			dom.customQualityContainer.style.display = "none";
			dom.targetSizeContainer.style.display = "none";
			dom.targetPercentContainer.style.display = "none";
			dom.videoQuality.value = quality;
		}
	});
});

if (dom.qualitySlider) {
	dom.qualitySlider.addEventListener("input", (e) => {
		const val = parseInt(e.target.value, 10);
		const crf = 69 - val;
		dom.videoQuality.value = crf.toString();
		updateCRFDisplay(crf);
	});
}

if (dom.advancedToggleBtn) {
	dom.advancedToggleBtn.addEventListener("click", () => {
		const isCollapsed =
			dom.advancedSettingsCollapse.classList.contains("collapsed");
		if (isCollapsed) {
			dom.advancedSettingsCollapse.classList.remove("collapsed");
			dom.advancedToggleBtn.classList.add("expanded");
		} else {
			dom.advancedSettingsCollapse.classList.add("collapsed");
			dom.advancedToggleBtn.classList.remove("expanded");
		}
	});
}
