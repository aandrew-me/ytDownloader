const {exec} = require("child_process");
const path = require("path");
const {ipcRenderer, shell} = require("electron");
const os = require("os");
const si = require("systeminformation")

let menuIsOpen = false;

getId("menuIcon").addEventListener("click", () => {
	if (menuIsOpen) {
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
	} else {
		getId("menuIcon").style.transform = "rotate(90deg)";
		menuIsOpen = true;

		setTimeout(() => {
			getId("menu").style.display = "flex";
			getId("menu").style.opacity = "1";
		}, 150);
	}
});


let ffmpeg;
if (os.platform() === "win32") {
	ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
} else if (os.platform() === "freebsd") {
	try {
		ffmpeg = cp.execSync("which ffmpeg").toString("utf8").split("\n")[0].trim();
	} catch (error) {
		console.log(error)
		showPopup("No ffmpeg found in PATH.");
	}
}
 else {
	ffmpeg = `"${__dirname}/../ffmpeg"`;
}

const vaapi_device = "/dev/dri/renderD128"

// Checking GPU
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
let isCancelled = false;

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

getId("custom-folder-select").addEventListener("click", (e) => {
	ipcRenderer.send("get-directory", "")
})

function updateSelectedFiles() {
	const fileList = files
		.map((f) => `${f.name} (${formatBytes(f.size)})<br/>`)
		.join("\n");
	selectedFilesDiv.innerHTML = fileList || "No files selected";
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

		const outputPath = generateOutputPath(file, settings);

		try {
			await compressVideo(file, settings, itemId, outputPath);

			if (isCancelled) {
				isCancelled = false;
			} else {
				updateProgress("success", "", itemId);
				const fileSavedElement = document.createElement("b")
				fileSavedElement.textContent = "File saved. Click to open"
				fileSavedElement.onclick = () => {
					shell.showItemInFolder(outputPath)
				}
				getId(itemId + "_prog").appendChild(fileSavedElement)
				currentItemId = ""
			}
		} catch (error) {
			const errorElement = document.createElement("div")
			errorElement.onclick = () => {
				ipcRenderer.send("error_dialog", error.message)
			}
			errorElement.textContent = "Error. Click for details"
			updateProgress("error", "", itemId);
			getId(itemId + "_prog").appendChild(errorElement)
            currentItemId = ""
		}
	}
}

function cancelCompression() {
	activeProcesses.forEach((child) => {
		child.stdin.write("q")
		isCancelled = true;
	});
	activeProcesses.clear();
	updateProgress("error", "Cancelled", currentItemId);
}

/**
 * @param {File} file
 */
function generateOutputPath(file, settings) {
	console.log({settings})
    const output_extension = settings.extension
    const parsed_file = path.parse(file.path)

	let outputDir = settings.outputPath || parsed_file.dir


    if (output_extension == "unchanged") {
        return path.join(outputDir, `${parsed_file.name}${settings.outputSuffix}${parsed_file.ext}`);
    }

    return path.join(outputDir, `${parsed_file.name}_compressed.${output_extension}`);
}

/**
 * @param {File} file
 * @param {{ encoder: any; speed: any; videoQuality: any; audioQuality?: any; audioFormat: string, extension: string }} settings
 * @param {string} itemId
 * @param {string} outputPath
 */
async function compressVideo(file, settings, itemId, outputPath) {
	const command = buildFFmpegCommand(file, settings, outputPath);

	console.log("Command: " + command)

	return new Promise((resolve, reject) => {
		const child = exec(command, (error) => {
			if (error) reject(error);
			else resolve();
		});

		activeProcesses.add(child);
		child.on("exit", (_code) => {
			activeProcesses.delete(child)
		});

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
			// console.log(data)
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

/**
 * @param {File} file
 * @param {{ encoder: string; speed: string; videoQuality: string; audioQuality: string; audioFormat: string }} settings
 * @param {string} outputPath
 */
function buildFFmpegCommand(file, settings, outputPath) {
    const inputPath = file.path;

    console.log("Output path: " + outputPath)

	const args = ["-hide_banner", "-y", "-stats", "-i", `"${inputPath}"`];

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
				"-vf", "format=yuv420p",
				"-crf",
				parseInt(settings.videoQuality).toString()
			);
			break;
		case "x265":
			args.push(
				"-c:v",
				"libx265",
				"-vf", "format=yuv420p",
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
				"-vf", "format=yuv420p",
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
				"-vf", "format=yuv420p",
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
				"-vf", "format=yuv420p",
				"-quality",
				amf_hevc_quality,
				"-rc",
				"cqp",
				"-qp_i",
				parseInt(settings.videoQuality).toString(),
				"-qp_p",
				parseInt(settings.videoQuality).toString(),
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
				"-vf", "format=yuv420p",
				"-quality",
				amf_quality,
				"-rc",
				"cqp",
				"-qp_i",
				parseInt(settings.videoQuality).toString(),
				"-qp_p",
				parseInt(settings.videoQuality).toString(),
				"-qp_b",
				parseInt(settings.videoQuality).toString()
			);
			break;
		case "videotoolbox":
			args.push(
				"-c:v",
				"-vf", "format=yuv420p",
				"h264_videotoolbox",
				"-q:v",
				parseInt(settings.videoQuality).toString()
			);
			break;
	}

	// args.push("-vf", "scale=trunc(iw*1/2)*2:trunc(ih*1/2)*2,format=yuv420p");

	args.push("-c:a", settings.audioFormat, `"${outputPath}"`);

	return `${ffmpeg} ${args.join(" ")}`;
}

/**
 *
 * @returns {{ encoder: string; speed: string; videoQuality: string; audioQuality?: string; audioFormat: string, extension: string, outputPath:string }} settings
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
		outputPath: getId("custom-folder-path").textContent,
		// @ts-ignore
		outputSuffix: getId("output-suffix").value,
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
		const item = getId("itemId");

		if (item) {
			getId(itemId).classList.remove("progress");
			getId(itemId).classList.add(status);
		}
	}

	if (itemId) {
		getId(itemId + "_prog").textContent = data;
	}
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
	const visibleFilename = filename.substring(0, 45);
	newStatus.innerHTML = `
        <div class="filename">${visibleFilename}</div>
        <div id="${itemId + "_prog"}" class="itemProgress">${data}</div>
    `;
	statusElement.append(newStatus);
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

getId("themeToggle").addEventListener("change", () => {
	document.documentElement.setAttribute("theme", getId("themeToggle").value);
	localStorage.setItem("theme", getId("themeToggle").value);
});

getId("output-folder-input").addEventListener("change", (e) => {
	const checked = e.target.checked;

	if (!checked) {
		getId("custom-folder-select").style.display = "block"
	} else {
		getId("custom-folder-select").style.display = "none"
		getId("custom-folder-path").textContent = ""
		getId("custom-folder-path").style.display = "none"
	}
})

const storageTheme = localStorage.getItem("theme");
if (storageTheme) {
	document.documentElement.setAttribute("theme", storageTheme);
	getId("themeToggle").value = storageTheme;
}

ipcRenderer.on("directory-path", (_event, msg) => {
	let customFolderPathItem = getId("custom-folder-path") 

	customFolderPathItem.textContent = msg;
	customFolderPathItem.style.display = "inline"
})

function closeMenu() {
	getId("menuIcon").style.transform = "rotate(0deg)";
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			clearInterval(fade);
		} else {
			opacity -= 0.1;
			getId("menu").style.opacity = String(opacity);
			count++;
		}
	}, 50);
}

// Menu
getId("preferenceWin").addEventListener("click", () => {
	closeMenu();
	menuIsOpen = false;
	ipcRenderer.send("load-page", __dirname + "/preferences.html");
});

getId("playlistWin").addEventListener("click", () => {
	closeMenu();
	menuIsOpen = false;
	ipcRenderer.send("load-win", __dirname + "/playlist.html");
});

getId("aboutWin").addEventListener("click", () => {
	closeMenu();
	menuIsOpen = false;
	ipcRenderer.send("load-page", __dirname + "/about.html");
});
getId("homeWin").addEventListener("click", () => {
	closeMenu();
	menuIsOpen = false;
	ipcRenderer.send("load-win", __dirname + "/index.html");
});

// Popup message
function showPopup(text) {
	console.log("Triggered showpopup");
	getId("popupText").textContent = text;
	getId("popupText").style.display = "inline-block";
	setTimeout(() => {
		getId("popupText").style.display = "none";
	}, 2200);
}