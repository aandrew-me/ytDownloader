const {exec} = require("child_process");
const path = require("path");
const {ipcRenderer} = require("electron");
const os = require("os");
const si = require("systeminformation")

let ffmpeg;
if (os.platform() === "win32") {
	ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
} else {
	ffmpeg = `"${__dirname}/../ffmpeg"`;
}

const vaapi_device = "/dev/dri/renderD128"

si.graphics().then((info) => {
    console.log({gpuInfo: info})
	const gpuDevices = info.controllers;

    gpuDevices.forEach((gpu) => {
        // NVIDIA
        const gpuName = gpu.vendor.toLowerCase()
        const gpuModel = gpu.model.toLowerCase()

        if (gpuName.includes("nvidia") || gpuModel.includes("nvidia")) {
            document.querySelectorAll(".nvidia_opt").forEach((opt) => {
                opt.style.display = "block"
            })
        }  else if (gpuName.includes("advanced micro devices") || gpuModel.includes("amd")) {
            if (os.platform() == "win32") {
                document.querySelectorAll(".amf_opt").forEach((opt) => {
                    opt.style.display = "block"

                })
            } else {
                document.querySelectorAll(".vaapi_opt").forEach((opt) => {
                    opt.style.display = "block"
                })
            }
        } else if (gpuName.includes("intel")) {
            if (os.platform() == "win32") {
                document.querySelectorAll(".qsv_opt").forEach((opt) => {
                    opt.style.display = "block"
                })
            } else if (os.platform() != "darwin") {
                document.querySelectorAll(".vaapi_opt").forEach((opt) => {
                    opt.style.display = "block"
                })
            }
        } else {
            if (os.platform() == "darwin") {
                document.querySelectorAll(".videotoolbox_opt").forEach((opt) => {
                    opt.style.display = "block"
                })
            }
        }
    })
})

/** @type {File[]} */
let files = [];
let activeProcesses = new Set();
let currentItemId = "";

/**
 * @param {string} id
 */
function getId(id) {
	return document.getElementById(id);
}

// File Handling
const dropZone = document.querySelector(".drop-zone");
const fileInput = getId("fileInput");
const selectedFilesDiv = getId("selected-files");

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
	console.log(e.dataTransfer)
	files = Array.from(e.dataTransfer.files);
	updateSelectedFiles();
});

fileInput.addEventListener("change", (e) => {
	// @ts-ignore
	files = Array.from(e.target.files);
	updateSelectedFiles();
});

function updateSelectedFiles() {
	const fileList = files
		.map((f) => `${f.name} (${formatBytes(f.size)})`)
		.join("\n");
	selectedFilesDiv.textContent = fileList || "No files selected";
}

// Compression Logic
getId("compress-btn").addEventListener("click", startCompression);
getId("cancel-btn").addEventListener("click", cancelCompression);

async function startCompression() {
	if (files.length === 0) return alert("Please select files first!");

	const settings = getEncoderSettings();


	for (const file of files) {
		const itemId =
			"f" + Math.random().toFixed(10).toString().slice(2).toString();
		currentItemId = itemId;

		try {
			await compressVideo(file, settings, itemId);
			updateProgress("success", "Successfully compressed", itemId);
            currentItemId = ""
		} catch (error) {
			updateProgress("error", error.message, itemId);
            currentItemId = ""
		}
	}
}

function cancelCompression() {
	activeProcesses.forEach((child) => child.kill("SIGTERM"));
	activeProcesses.clear();
	updateProgress("", "cancelled", currentItemId);
}

/**
 * @param {File} file
 */
function generateOutputPath(file, settings) {
    const output_extension = settings.extension
    const parsed_file = path.parse(file.path)


    if (output_extension == "unchanged") {
        return path.join(parsed_file.dir, `${parsed_file.name}_compressed${parsed_file.ext}`);
    }

    return path.join(parsed_file.dir, `${parsed_file.name}_compressed.${output_extension}`);
}

/**
 * @param {File} file
 * @param {{ encoder: any; speed: any; videoQuality: any; audioQuality?: any; audioFormat: string, extension: string }} settings
 * @param {string} itemId
 */
async function compressVideo(file, settings, itemId) {
	const command = buildFFmpegCommand(file, settings);

	return new Promise((resolve, reject) => {
		const child = exec(command, (error) => {
			if (error) reject(error);
			else resolve();
		});

		activeProcesses.add(child);
		child.on("exit", () => activeProcesses.delete(child));

		let video_info = {
			duration: "",
			bitrate: "",
		};

		createProgressItem(
			path.basename(file.path),
			"progress",
			`Starting...`,
			itemId
		);

		child.stderr.on("data", (data) => {
			const duration_match = data.match(/Duration:\s*([\d:.]+)/);
			if (duration_match) {
				video_info.duration = duration_match[1];
			}

			// const bitrate_match = data.match(/bitrate:\s*([\d:.]+)/);
			// if (bitrate_match) {
			// 	// Bitrate in kb/s
			// 	video_info.bitrate = bitrate_match[1];
			// }

			const progressTime = data.match(/time=(\d+:\d+:\d+\.\d+)/);

			const totalSeconds = timeToSeconds(video_info.duration);

			const currentSeconds =
				progressTime && progressTime.length > 1
					? timeToSeconds(progressTime[1])
					: null;

			if (currentSeconds) {
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

/**
 * @param {File} file
 * @param {{ encoder: string; speed: string; videoQuality: string; audioQuality: string; audioFormat: string }} settings
 */
function buildFFmpegCommand(file, settings) {
    const inputPath = file.path;

    const outputPath = generateOutputPath(file, settings);

    console.log("Output path: " + outputPath)

	const args = ["-y", "-stats", "-i", `"${inputPath}"`];

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
				"-crf",
				parseInt(settings.videoQuality).toString()
			);
			break;
		case "x265":
			args.push(
				"-c:v",
				"libx265",
				"-preset",
				settings.speed,
				"-crf",
				parseInt(settings.videoQuality).toString()
			);
			break;
		// Intel windows
		case "qsv":
			args.push(
				"-c:v",
				"h264_qsv",
				"-preset",
				settings.speed,
				"-global_quality",
				parseInt(settings.videoQuality).toString()
			);
			break;
		// Linux amd and intel
		case "vaapi":
			args.push(
				"-vaapi_device",
				vaapi_device,
				"-vf",
				"format=nv12,hwupload",
				"-c:v",
				"h264_vaapi",
				"-qp",
				parseInt(settings.videoQuality).toString()
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
                parseInt(settings.videoQuality).toString()
            );
            break;
		// Nvidia windows and linux
		case "nvenc":
			args.push(
				"-c:v",
				"h264_nvenc",
				"-preset",
				getNvencPreset(settings.speed),
				"-rc",
				"vbr",
				"-cq",
				parseInt(settings.videoQuality).toString()
			);
			break;
		// Amd windows
		case "hevc_amf":
			let amf_hevc_quality = "balanced";

			if (settings.speed == "slow") {
				amf_hevc_quality = "quality";
			} else if (settings.speed == "fast") {
				amf_hevc_quality = "speed";
			}

			args.push(
				"-c:v",
				"hevc_amf",
				"-quality",
				amf_hevc_quality,
				"-rc",
				"cqp",
				"-qp_i",
				parseInt(settings.videoQuality).toString(),
				"-qp_i",
				parseInt(settings.videoQuality).toString()
			);
			break;
		case "amf":
			let amf_quality = "balanced";

			if (settings.speed == "slow") {
				amf_quality = "quality";
			} else if (settings.speed == "fast") {
				amf_quality = "speed";
			}

			args.push(
				"-c:v",
				"h264_amf",
				"-quality",
				amf_quality,
				"-rc",
				"cqp",
				"-qp_i",
				parseInt(settings.videoQuality).toString(),
				"-qp_i",
				parseInt(settings.videoQuality).toString()
			);
			break;
		case "videotoolbox":
			args.push(
				"-c:v",
				"h264_videotoolbox",
				"-q:v",
				parseInt(settings.videoQuality).toString()
			);
			break;
	}

	args.push("-c:a", settings.audioFormat, `"${outputPath}"`);

	return `${ffmpeg} ${args.join(" ")}`;
}

/**
 *
 * @returns {{ encoder: string; speed: string; videoQuality: string; audioQuality?: string; audioFormat: string, extension: string }} settings
 */
function getEncoderSettings() {
	return {
		// @ts-ignore
		encoder: getId("encoder").value,
		// @ts-ignore
		speed: getId("compression-speed").value,
		// @ts-ignore
		videoQuality: getId("video-quality").value,
		// @ts-ignore
		audioFormat: getId("audio-format").value,
        // @ts-ignore
        extension: getId("file_extension").value,
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
	if (status == "success" || status == "error") {
		getId(itemId).classList.remove("progress");
		getId(itemId).classList.add(status);
	}

	getId(itemId + "_prog").textContent = data;
}

/**
 * @param {string} filename
 * @param {string} status
 * @param {string} data
 * @param {string} itemId
 */
function createProgressItem(filename, status, data, itemId) {
	const statusElement = getId("compression-status");
	const newStatus = document.createElement("div");
	newStatus.id = itemId;
	newStatus.className = `status-item ${status}`;
	newStatus.innerHTML = `
        <div class="filename">${filename}</div>
        <div id="${itemId + "_prog"}" class="itemProgress">${data}</div>
    `;
	statusElement.prepend(newStatus);
}

/**
 * @param {any} bytes
 */
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

/**
 * @param {string} timeStr
 */
function timeToSeconds(timeStr) {
	if (!timeStr) {
		return 0;
	}

	const [hh, mm, ss] = timeStr.split(":").map(parseFloat);
	return hh * 3600 + mm * 60 + ss;
}

// Menu
getId("preferenceWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + "/preferences.html");
});

getId("aboutWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + "/about.html");
});
getId("homeWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-win", __dirname + "/index.html");
});

getId("themeToggle").addEventListener("change", () => {
	document.documentElement.setAttribute("theme", getId("themeToggle").value);
	localStorage.setItem("theme", getId("themeToggle").value);
});

const storageTheme = localStorage.getItem("theme");
if (storageTheme) {
	document.documentElement.setAttribute("theme", storageTheme);
	getId("themeToggle").value = storageTheme;
}
