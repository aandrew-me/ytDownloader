const {exec, execSync} = require("child_process");
const path = require("path");
const {ipcRenderer, shell} = require("electron");
const os = require("os");
const si = require("systeminformation");
const {existsSync} = require("fs");

const VAAPI_DEVICE = "/dev/dri/renderD128";
const FFMPEG_PATH = `"${getFfmpegPath()}"`;

console.log(`FFmpeg Path: ${FFMPEG_PATH}`);
/** @type {File[]} */
let files = [];
let activeProcesses = new Set();
let currentItemId = "";
let isCancelled = false;
let menuIsOpen = false;

(function init() {
	setupTheme();
	detectHardware();
})();

document.addEventListener("translations-loaded", () => {
	window.i18n.translatePage();
});

getId("menuIcon").addEventListener("click", toggleMenu);
getId("preferenceWin").addEventListener("click", () =>
	navigateTo("/preferences.html")
);
getId("playlistWin").addEventListener("click", () =>
	navigateToWin("/playlist.html")
);
getId("aboutWin").addEventListener("click", () => navigateTo("/about.html"));
getId("historyWin").addEventListener("click", () =>
	navigateTo("/history.html")
);
getId("homeWin").addEventListener("click", () => navigateToWin("/index.html"));

const dropZone = document.querySelector(".drop-zone");
const fileInput = getId("fileInput");

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
	// @ts-ignore
	files = Array.from(e.dataTransfer.files);
	updateSelectedFiles();
});

fileInput.addEventListener("change", (e) => {
	// @ts-ignore
	files = Array.from(e.target.files);
	updateSelectedFiles();
});

getId("compress-btn").addEventListener("click", startCompression);
getId("cancel-btn").addEventListener("click", cancelCompression);

getId("custom-folder-select").addEventListener("click", () => {
	ipcRenderer.send("get-directory", "");
});

getId("output-folder-input").addEventListener("change", (e) => {
	const checked = e.target.checked;
	const selectBtn = getId("custom-folder-select");
	const pathDisplay = getId("custom-folder-path");

	if (!checked) {
		selectBtn.style.display = "block";
	} else {
		selectBtn.style.display = "none";
		pathDisplay.textContent = "";
		pathDisplay.style.display = "none";
	}
});

getId("themeToggle").addEventListener("change", () => {
	const theme = getId("themeToggle").value;
	document.documentElement.setAttribute("theme", theme);
	localStorage.setItem("theme", theme);
});

ipcRenderer.on("directory-path", (_event, msg) => {
	let customFolderPathItem = getId("custom-folder-path");
	customFolderPathItem.textContent = msg;
	customFolderPathItem.style.display = "inline";
});

async function startCompression() {
	if (files.length === 0) return alert("Please select files first!");

	const settings = getEncoderSettings();

	for (const file of files) {
		const itemId = "f" + Math.random().toFixed(10).toString().slice(2);
		currentItemId = itemId;

		const outputPath = generateOutputPath(file, settings);

		try {
			await compressVideo(file, settings, itemId, outputPath);

			if (isCancelled) {
				isCancelled = false;
			} else {
				handleCompressionSuccess(itemId, outputPath);
			}
		} catch (error) {
			handleCompressionError(itemId, error);
		}
	}
}

function cancelCompression() {
	activeProcesses.forEach((child) => {
		child.stdin.write("q");
		isCancelled = true;
	});
	activeProcesses.clear();
	updateProgress("error", "Cancelled", currentItemId);
}

/**
 * @param {File} file
 * @param {Object} settings
 * @param {string} itemId
 * @param {string} outputPath
 */
async function compressVideo(file, settings, itemId, outputPath) {
	const command = buildFFmpegCommand(file, settings, outputPath);
	console.log("Command: " + command);

	return new Promise((resolve, reject) => {
		const child = exec(command, (error) => {
			if (error) reject(error);
			else resolve();
		});

		activeProcesses.add(child);
		child.on("exit", () => activeProcesses.delete(child));

		let video_info = {duration: "", bitrate: ""};

		createProgressItem(
			path.basename(file.path),
			"progress",
			`Starting...`,
			itemId
		);

		child.stderr.on("data", (data) => {
			const duration_match = data.match(/Duration:\s*([\d:.]+)/);
			if (duration_match) video_info.duration = duration_match[1];

			const progressTime = data.match(/time=(\d+:\d+:\d+\.\d+)/);
			const totalSeconds = timeToSeconds(video_info.duration);
			const currentSeconds =
				progressTime && progressTime.length > 1
					? timeToSeconds(progressTime[1])
					: null;

			if (currentSeconds && !isCancelled) {
				const progress = Math.round(
					(currentSeconds / totalSeconds) * 100
				);
				getId(
					itemId + "_prog"
				).innerHTML = `<progress class="progressBarCompress" min=0 max=100 value=${progress}>`;
			}
		});
	});
}

function handleCompressionSuccess(itemId, outputPath) {
	updateProgress("success", "", itemId);
	const fileSavedElement = document.createElement("b");
	fileSavedElement.textContent = i18n.__("fileSavedClickToOpen");
	fileSavedElement.onclick = () => ipcRenderer.send("show-file", outputPath);
	getId(itemId + "_prog").appendChild(fileSavedElement);
	currentItemId = "";
}

function handleCompressionError(itemId, error) {
	const errorElement = document.createElement("div");
	errorElement.onclick = () =>
		ipcRenderer.send("error_dialog", error.message);
	errorElement.textContent = i18n.__("errorClickForDetails");
	updateProgress("error", "", itemId);
	getId(itemId + "_prog").appendChild(errorElement);
	currentItemId = "";
}

function buildFFmpegCommand(file, settings, outputPath) {
	const inputPath = file.path;
	console.log("Output path: " + outputPath);

	const args = ["-hide_banner", "-y", "-stats", "-i", `"${inputPath}"`];
	const vQuality = parseInt(settings.videoQuality).toString();

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
				vQuality
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
				vQuality
			);
			break;
		case "qsv": // Intel Windows
			args.push(
				"-c:v",
				"h264_qsv",
				"-vf",
				"format=yuv420p",
				"-preset",
				settings.speed,
				"-global_quality",
				vQuality
			);
			break;
		case "vaapi": // Linux AMD/Intel
			args.push(
				"-vaapi_device",
				VAAPI_DEVICE,
				"-vf",
				"format=nv12,hwupload",
				"-c:v",
				"h264_vaapi",
				"-qp",
				vQuality
			);
			break;
		case "hevc_vaapi":
			args.push(
				"-vaapi_device",
				VAAPI_DEVICE,
				"-vf",
				"format=nv12,hwupload",
				"-c:v",
				"hevc_vaapi",
				"-qp",
				vQuality
			);
			break;
		case "nvenc": // Nvidia
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
				vQuality
			);
			break;
		case "hevc_amf": // AMD Windows HEVC
			const amfHevcQuality = getAmfQuality(settings.speed);
			args.push(
				"-c:v",
				"hevc_amf",
				"-vf",
				"format=yuv420p",
				"-quality",
				amfHevcQuality,
				"-rc",
				"cqp",
				"-qp_i",
				vQuality,
				"-qp_p",
				vQuality
			);
			break;
		case "amf": // AMD Windows H264
			const amfQuality = getAmfQuality(settings.speed);
			args.push(
				"-c:v",
				"h264_amf",
				"-vf",
				"format=yuv420p",
				"-quality",
				amfQuality,
				"-rc",
				"cqp",
				"-qp_i",
				vQuality,
				"-qp_p",
				vQuality,
				"-qp_b",
				vQuality
			);
			break;
		case "videotoolbox": // macOS
			args.push(
				"-c:v",
				"-vf",
				"format=yuv420p",
				"h264_videotoolbox",
				"-q:v",
				vQuality
			);
			break;
	}

	args.push("-c:a", settings.audioFormat, `"${outputPath}"`);
	return `${FFMPEG_PATH} ${args.join(" ")}`;
}

function getEncoderSettings() {
	return {
		encoder: getId("encoder").value,
		speed: getId("compression-speed").value,
		videoQuality: getId("video-quality").value,
		audioFormat: getId("audio-format").value,
		extension: getId("file_extension").value,
		outputPath: getId("custom-folder-path").textContent,
		outputSuffix: getId("output-suffix").value,
	};
}

function getNvencPreset(speed) {
	const presets = {fast: "p3", medium: "p4", slow: "p5"};
	return presets[speed] || "p4";
}

function getAmfQuality(speed) {
	if (speed === "slow") return "quality";
	if (speed === "fast") return "speed";
	return "balanced";
}

function getId(id) {
	return document.getElementById(id);
}

function updateSelectedFiles() {
	const fileList = files
		.map((f) => `${f.name} (${formatBytes(f.size)})<br/>`)
		.join("\n");
	getId("selected-files").innerHTML = fileList || "No files selected";
}

function createProgressItem(filename, status, data, itemId) {
	const statusElement = getId("compression-status");
	const newStatus = document.createElement("div");
	newStatus.id = itemId;
	newStatus.className = `status-item ${status}`;
	const visibleFilename = filename.substring(0, 45);
	newStatus.innerHTML = `
        <div class="filename">${visibleFilename}</div>
        <div id="${itemId + "_prog"}" class="itemProgress">${data}</div>
    `;
	statusElement.append(newStatus);
}

function updateProgress(status, data, itemId) {
	if (status === "success" || status === "error") {
		const item = getId(itemId);
		if (item) {
			item.classList.remove("progress");
			item.classList.add(status);
		}
	}
	if (itemId) {
		getId(itemId + "_prog").textContent = data;
	}
}

function toggleMenu() {
	if (menuIsOpen) {
		closeMenu();
	} else {
		getId("menuIcon").style.transform = "rotate(90deg)";
		menuIsOpen = true;
		setTimeout(() => {
			getId("menu").style.display = "flex";
			getId("menu").style.opacity = "1";
		}, 150);
	}
}

function closeMenu() {
	getId("menuIcon").style.transform = "rotate(0deg)";
	menuIsOpen = false;
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			getId("menu").style.display = "none";
			clearInterval(fade);
		} else {
			opacity -= 0.1;
			getId("menu").style.opacity = opacity.toFixed(3).toString();
			count++;
		}
	}, 50);
}

function navigateTo(url) {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + url);
}

function navigateToWin(url) {
	closeMenu();
	ipcRenderer.send("load-win", __dirname + url);
}

function setupTheme() {
	const storageTheme = localStorage.getItem("theme");
	if (storageTheme) {
		document.documentElement.setAttribute("theme", storageTheme);
		getId("themeToggle").value = storageTheme;
	}
}

function detectHardware() {
	si.graphics().then((info) => {
		console.log({gpuInfo: info});
		const gpuDevices = info.controllers;
		const platform = os.platform();

		gpuDevices.forEach((gpu) => {
			const gpuName = gpu.vendor.toLowerCase();
			const gpuModel = gpu.model.toLowerCase();
			const isNvidia =
				gpuName.includes("nvidia") || gpuModel.includes("nvidia");
			const isAMD =
				gpuName.includes("advanced micro devices") ||
				gpuModel.includes("amd");
			const isIntel = gpuName.includes("intel");

			if (isNvidia) {
				showOptions(".nvidia_opt");
			} else if (isAMD) {
				if (platform === "win32") showOptions(".amf_opt");
				else showOptions(".vaapi_opt");
			} else if (isIntel) {
				if (platform === "win32") showOptions(".qsv_opt");
				else if (platform !== "darwin") showOptions(".vaapi_opt");
			} else {
				if (platform === "darwin") showOptions(".videotoolbox_opt");
			}
		});
	});
}

function showOptions(selector) {
	document.querySelectorAll(selector).forEach((opt) => {
		opt.style.display = "block";
	});
}

function formatBytes(bytes) {
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}
	return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function timeToSeconds(timeStr) {
	if (!timeStr) return 0;
	const [hh, mm, ss] = timeStr.split(":").map(parseFloat);
	return hh * 3600 + mm * 60 + ss;
}

function generateOutputPath(file, settings) {
	console.log({settings});
	const output_extension = settings.extension;
	const parsed_file = path.parse(file.path);
	let outputDir = settings.outputPath || parsed_file.dir;

	if (output_extension === "unchanged") {
		return path.join(
			outputDir,
			`${parsed_file.name}${settings.outputSuffix}${parsed_file.ext}`
		);
	}
	return path.join(
		outputDir,
		`${parsed_file.name}_compressed.${output_extension}`
	);
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
			return path.join(__dirname, "..", "ffmpeg", "bin", "ffmpeg.exe");
		case "freebsd":
			try {
				return execSync("which ffmpeg").toString("utf8").trim();
			} catch (error) {
				console.error("ffmpeg not found on FreeBSD:", error);
				return "";
			}
		default:
			return path.join(__dirname, "..", "ffmpeg", "bin", "ffmpeg");
	}
}
