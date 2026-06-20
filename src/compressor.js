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
	encoder: getId("encoder"),
	compressionSpeed: getId("compression-speed"),
	videoQuality: getId("video-quality"),
	audioFormat: getId("audio-format"),
	fileExtension: getId("file_extension"),
	outputSuffix: getId("output-suffix"),
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
	const args = buildFFmpegArgs(file, settings, outputPath);
	console.log("Command: " + args.join(" "));

	return new Promise((resolve, reject) => {
		const child = spawn(ffmpeg, args);

		activeProcesses.add(child);
		child.on("exit", () => {
			activeProcesses.delete(child);
		});

		let video_info = {duration: ""};

		createProgressItem(
			path.basename(file.path),
			"progress",
			`Starting...`,
			itemId,
		);

		child.stderr.on("data", (data) => {
			const dataStr = data.toString();

			const duration_match = dataStr.match(/Duration:\s*([\d:.]+)/);
			if (duration_match) {
				video_info.duration = duration_match[1];
			}

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
						progElem.innerHTML = `<progress class="progressBarCompress" min="0" max="100" value="${progress}"></progress>`;
					} else {
						progressBar.value = progress;
					}
				}
			}
		});

		child.on("error", (err) => reject(err));
		child.on("close", (code) => {
			if (code !== 0 && !isCancelled)
				reject(new Error(`Process exited with code ${code}`));
			else resolve();
		});
	});
}

/**
 * @param {File} file
 * @param {{ encoder: string; speed: string; videoQuality: string; audioQuality: string; audioFormat: string }} settings
 * @param {string} outputPath
 */
function buildFFmpegArgs(file, settings, outputPath) {
	const inputPath = file.path;
	console.log("Output path: " + outputPath);

	const args = ["-hide_banner", "-y", "-stats", "-i", inputPath];
	const quality = parseInt(settings.videoQuality, 10).toString();

	switch (settings.encoder) {
		case "copy":
			args.push("-c:v", "copy");
			break;
		case "x264":
			args.push(
				"-c:v",
				"libx264",
				"-preset",
				settings.speed,
				"-vf",
				"format=yuv420p",
				"-crf",
				quality,
			);
			break;
		case "x265":
			args.push(
				"-c:v",
				"libx265",
				"-vf",
				"format=yuv420p",
				"-preset",
				settings.speed,
				"-crf",
				quality,
			);
			break;
		case "qsv":
			args.push(
				"-c:v",
				"h264_qsv",
				"-vf",
				"format=yuv420p",
				"-preset",
				settings.speed,
				"-global_quality",
				quality,
			);
			break;
		case "vaapi":
			args.push(
				"-vaapi_device",
				vaapi_device,
				"-vf",
				"format=nv12,hwupload",
				"-c:v",
				"h264_vaapi",
				"-qp",
				quality,
			);
			break;
		case "hevc_vaapi":
			args.push(
				"-vaapi_device",
				vaapi_device,
				"-vf",
				"format=nv12,hwupload",
				"-c:v",
				"hevc_vaapi",
				"-qp",
				quality,
			);
			break;
		case "nvenc":
			args.push(
				"-c:v",
				"h264_nvenc",
				"-vf",
				"format=yuv420p",
				"-preset",
				getNvencPreset(settings.speed),
				"-rc",
				"vbr",
				"-cq",
				quality,
			);
			break;
		case "hevc_amf": {
			const speedToQuality = {slow: "quality", fast: "speed"};
			const amf_hevc_quality =
				speedToQuality[settings.speed] || "balanced";
			args.push(
				"-c:v",
				"hevc_amf",
				"-vf",
				"format=yuv420p",
				"-quality",
				amf_hevc_quality,
				"-rc",
				"cqp",
				"-qp_i",
				quality,
				"-qp_p",
				quality,
			);
			break;
		}
		case "amf": {
			const speedToQuality = {slow: "quality", fast: "speed"};
			const amf_quality = speedToQuality[settings.speed] || "balanced";
			args.push(
				"-c:v",
				"h264_amf",
				"-vf",
				"format=yuv420p",
				"-quality",
				amf_quality,
				"-rc",
				"cqp",
				"-qp_i",
				quality,
				"-qp_p",
				quality,
				"-qp_b",
				quality,
			);
			break;
		}
		case "videotoolbox":
			args.push(
				"-c:v",
				"h264_videotoolbox",
				"-vf",
				"format=yuv420p",
				"-q:v",
				quality,
			);
			break;
	}

	args.push("-c:a", settings.audioFormat, outputPath);
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
	newStatus.innerHTML = `
        <div class="filename">${visibleFilename}</div>
        <div id="${itemId}_prog" class="itemProgress">${data}</div>
    `;
	dom.compressionStatus.append(newStatus);
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
};

Object.entries(menuRoutes).forEach(([domKey, route]) => {
	dom[domKey]?.addEventListener("click", () => {
		closeMenu();
		ipcRenderer.send(route.channel, __dirname + route.page);
	});
});
