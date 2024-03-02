const cp = require("child_process");
const os = require("os");
let ffmpeg;
if (os.platform() === "win32") {
	ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
} else {
	ffmpeg = `"${__dirname}/../ffmpeg"`;
}

const fs = require("fs");

/////////////////////////////////////
// Do not change the lines at the top
/////////////////////////////////////
const path = require("path");
const {shell, ipcRenderer, clipboard} = require("electron");
const {default: YTDlpWrap} = require("yt-dlp-wrap-plus");
const {constants} = require("fs/promises");

// Directories
const homedir = os.homedir();
let appdir = path.join(homedir, "Downloads");
if (os.platform() === "linux") {
	try {
		const xdgDownloadDir = cp
			.execSync("xdg-user-dir DOWNLOAD")
			.toString()
			.trim();
		if (xdgDownloadDir.length > 1) {
			appdir = xdgDownloadDir;
			console.log("xdg download dir:", xdgDownloadDir);
		}
	} catch (err) {}
}
const hiddenDir = path.join(homedir, ".ytDownloader");
const i18n = new (require("../translations/i18n"))();

fs.mkdir(hiddenDir, {recursive: true}, () => {});

// System tray
const trayEnabled = localStorage.getItem("closeToTray");
if (trayEnabled == "true") {
	console.log("Tray is Enabled");
	ipcRenderer.send("useTray", true);
}
// Ignore Python warnings
process.env.PYTHONWARNINGS = "error";

// Download directory
let downloadDir = "";

// Global variables
let title, onlyvideo, id, thumbnail, ytdlp, duration;
let audioExtensionList = [];
let rangeCmd = "";
let subs = "";
let subLangs;
let rangeOption = "--download-sections";
let cookieArg = "";
let browser = "";
let maxActiveDownloads = 5;
let showMoreFormats = false;
let configArg = "";
let configTxt = "";

if (localStorage.getItem("configPath")) {
	configArg = "--config-location";
	configTxt = `"${localStorage.getItem("configPath")}"`;
}

function checkMaxDownloads() {
	if (localStorage.getItem("maxActiveDownloads")) {
		const number = Number(localStorage.getItem("maxActiveDownloads"));
		if (number < 1) {
			maxActiveDownloads = 1;
		} else {
			maxActiveDownloads = number;
		}
	}
}
checkMaxDownloads();

// Check for auto updates
let autoUpdate = true;
const autoUpdateStatus = localStorage.getItem("autoUpdate");
if (autoUpdateStatus) {
	if (autoUpdateStatus == "false") {
		autoUpdate = false;
	}
}
ipcRenderer.send("autoUpdate", autoUpdate);

let currentDownloads = 0;
let controllers = new Object();

// Video and audio preferences
let preferredVideoQuality = 720;
let preferredAudioQuality = "";
let preferredVideoCodec = "avc1";
/**
 *
 * @param {string} id
 * @returns {any}
 */
function getId(id) {
	return document.getElementById(id);
}

function downloadPathSelection() {
	let localPath = localStorage.getItem("downloadPath");

	if (localPath) {
		downloadDir = localPath;
		try {
			fs.accessSync(localPath, constants.W_OK);
			downloadDir = localPath;
		} catch (err) {
			console.log(
				"Unable to write to download directory. Switching to default one."
			);
			console.log(err);
			downloadDir = appdir;
			localStorage.setItem("downloadPath", appdir);
		}
	} else {
		downloadDir = appdir;
		localStorage.setItem("downloadPath", appdir);
	}
	getId("path").textContent = downloadDir;
	fs.mkdir(downloadDir, {recursive: true}, () => {});
}

downloadPathSelection();

// Checking for yt-dlp
let ytDlp;
let ytdlpPath = path.join(os.homedir(), ".ytDownloader", "ytdlp");

// ytdlp download path
let ytdlpDownloadPath;
if (os.platform() == "win32") {
	ytdlpDownloadPath = path.join(os.homedir(), ".ytDownloader", "ytdlp.exe");
} else {
	ytdlpDownloadPath = path.join(os.homedir(), ".ytDownloader", "ytdlp");
}

// Downloading yt-dlp
async function downloadYtdlp() {
	document.querySelector("#popupBox p").textContent = i18n.__(
		"Please wait, necessary files are being downloaded"
	);
	getId("popupSvg").style.display = "inline";

	// Downloading appropriate version of yt-dlp
	if (os.platform() == "linux") {
		await YTDlpWrap.downloadFromGithub(
			ytdlpDownloadPath,
			"",
			"linux",
			true
		);
		localStorage.setItem("fullYtdlpBinPresent", "true");
	} else {
		// In case of windows/mac
		await YTDlpWrap.downloadFromGithub(ytdlpDownloadPath);
		localStorage.setItem("fullYtdlpBinPresent", "true");
	}

	getId("popupBox").style.display = "none";
	ytDlp = ytdlpPath;
	ytdlp = new YTDlpWrap(`"${ytDlp}"`);
	localStorage.setItem("ytdlp", ytDlp);
	getId("pasteUrl").style.display = "inline-block";
	console.log("yt-dlp bin Path: " + ytDlp);
}

// Checking if yt-dlp has been installed by user

const fullYtdlpBinIsPresent = !!localStorage.getItem("fullYtdlpBinPresent");

cp.exec(`"${ytdlpPath}" --version`, (error, stdout, stderr) => {
	if (error || !fullYtdlpBinIsPresent) {
		getId("popupBox").style.display = "block";
		process.on("uncaughtException", (reason, promise) => {
			document.querySelector("#popupBox p").textContent = i18n.__(
				"Failed to download necessary files. Please check your network and try again"
			);
			getId("popupSvg").style.display = "none";
			getId("popup").innerHTML += `<button id="tryBtn">${i18n.__(
				"Try again"
			)}</button>`;
			console.log("Failed to download yt-dlp");

			getId("tryBtn").addEventListener("click", () => {
				getId("popup").removeChild(getId("popup").lastChild);
				downloadYtdlp();
			});
		});
		downloadYtdlp();
	} else {
		console.log("yt-dlp binary is present in PATH");
		ytDlp = ytdlpPath;
		ytdlp = new YTDlpWrap(`"${ytDlp}"`);
		localStorage.setItem("ytdlp", ytDlp);
		cp.spawn(`${ytDlp}`, ["-U"]).stdout.on("data", (data) =>
			console.log(data.toString("utf8"))
		);
		getId("pasteUrl").style.display = "inline-block";
		console.log("yt-dlp bin Path: " + ytDlp);

		ipcRenderer.send("ready-for-links");
	}
});

function defaultVideoToggle() {
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

// Pasting url from clipboard

function pasteUrl() {
	defaultVideoToggle();
	hideHidden();
	getId("loadingWrapper").style.display = "flex";
	getId("incorrectMsg").textContent = "";
	const url = clipboard.readText();
	getInfo(url);
}

function pasteFromTray(url) {
	defaultVideoToggle();
	hideHidden();
	getId("loadingWrapper").style.display = "flex";
	getId("incorrectMsg").textContent = "";
	getInfo(url);
}

getId("closeHidden").addEventListener("click", () => {
	hideHidden();
	getId("loadingWrapper").style.display = "none";
});

document.addEventListener("keydown", (event) => {
	if (event.ctrlKey && event.key == "v") {
		pasteUrl();
	}
});

getId("pasteUrl").addEventListener("click", () => {
	pasteUrl();
});

// Getting video info
async function getInfo(url) {
	audioExtensionList = [];
	let selected = false;
	onlyvideo = false;
	let audioIsPresent = false;
	downloadPathSelection();
	// Cleaning text
	getId("videoFormatSelect").innerHTML = "";
	getId("audioFormatSelect").innerHTML = "";
	getId("audioForVideoFormatSelect").innerHTML = `<option value="none|none">No Audio</option>`;

	const startTime = getId("startTime");
	startTime.value = "";
	getId("endTime").value = "";
	getId("errorBtn").style.display = "none";
	getId("errorDetails").style.display = "none";
	getId("errorDetails").textContent = "";

	if (localStorage.getItem("preferredVideoQuality")) {
		preferredVideoQuality = Number(
			localStorage.getItem("preferredVideoQuality")
		);
	}
	if (localStorage.getItem("preferredAudioQuality")) {
		preferredAudioQuality = localStorage.getItem("preferredAudioQuality");
		getId("extractSelection").value = preferredAudioQuality;
	}
	if (localStorage.getItem("preferredVideoCodec")) {
		preferredVideoCodec = localStorage.getItem("preferredVideoCodec");
	}
	if (localStorage.getItem("showMoreFormats") === "true") {
		showMoreFormats = true;
	} else {
		showMoreFormats = false;
	}

	// Whether to use browser cookies or not
	if (localStorage.getItem("browser")) {
		browser = localStorage.getItem("browser");
	}
	if (browser) {
		cookieArg = "--cookies-from-browser";
	} else {
		cookieArg = "";
	}

	let validInfo = true;

	let info = "";

	const infoProcess = cp.spawn(
		`"${ytDlp}"`,
		[
			"-j",
			"--no-playlist",
			"--no-warnings",
			cookieArg,
			browser,
			configArg,
			configTxt,
			`"${url}"`,
		],
		{
			shell: true,
		}
	);

	infoProcess.stdout.on("data", (data) => {
		info += data;
	});

	infoProcess.stderr.on("data", (error) => {
		validInfo = false;
		// Error message handling
		console.log(error.toString("utf8"));
		getId("loadingWrapper").style.display = "none";
		getId("incorrectMsg").textContent = i18n.__(
			"Some error has occurred. Check your network and use correct URL"
		);
		getId("errorBtn").style.display = "inline-block";
		getId("errorDetails").innerHTML = `
		<strong>URL: ${url}</strong>
		<br><br>
		${error.toString("utf8")}
		`;
		getId("errorDetails").title = i18n.__("Click to copy");
	});

	infoProcess.on("close", () => {
		if (validInfo) {
			/**
			 * @typedef {import("./types").info} info
			 * @type {info}
			 */
			const parsedInfo = JSON.parse(info);
			console.log(parsedInfo);

			title = `${parsedInfo.title} [${parsedInfo.id}]`;
			id = parsedInfo.id;
			thumbnail = parsedInfo.thumbnail;
			duration = parsedInfo.duration;
			/**
			 * @typedef {import("./types").format} format
			 * @type {format[]}
			 */
			const formats = parsedInfo.formats;
			console.log(formats);

			/**
			 * @type {HTMLInputElement[]}
			 */
			// @ts-ignore
			const urlElements = document.querySelectorAll(".url");
			urlElements.forEach((element) => {
				element.value = url;
			});

			getId("loadingWrapper").style.display = "none";

			getId("hidden").style.display = "inline-block";
			getId("hidden").classList.add("scaleUp");

			getId("title").innerHTML =
				`<b>${i18n.__("Title ")}</b>: ` +
				`<input class="title" id="titleName" type="text" value="${title}" onchange="renameTitle()">`;

			let audioSize = 0;
			let defaultVideoFormat = 144;
			let videoFormatCodecs = {};

			let preferredAudioFormatLength = 0;
			let preferredAudioFormatCount = 0;
			let maxAudioFormatNoteLength = 10;

			// Initially going through all formats
			// Getting approx size of audio file and checking if audio is present
			for (let format of formats) {
				// Find the item with the preferred video format
				if (
					format.height <= preferredVideoQuality &&
					format.height >= defaultVideoFormat &&
					(format.video_ext !== "none" &&
					!(
						format.video_ext === "mp4" &&
						format.vcodec &&
						format.vcodec.split(".")[0] === "vp09"
					))
					&& (!showMoreFormats ? format.video_ext !== "webm" : true)
				) {
					defaultVideoFormat = format.height;

					// Creating a list of available codecs for the required video height
					if (!videoFormatCodecs[format.height]) {
						videoFormatCodecs[format.height] = {codecs: []};
					}
					if (format.vcodec) {
						videoFormatCodecs[format.height].codecs.push(
							format.vcodec.split(".")[0]
						);
					}
				}

				// Going through audio list
				if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext === "none")
				) {
					audioIsPresent = true;
					onlyvideo = true;
					audioSize =
						Number(format.filesize || format.filesize_approx) /
						1000000;
					
					if (!audioExtensionList.includes(format.audio_ext)) {
						audioExtensionList.push(format.audio_ext);
					}

					if (format.format_note.length > maxAudioFormatNoteLength) {
						maxAudioFormatNoteLength = format.format_note.length
					}
				}

				if (
					format.audio_ext === preferredAudioQuality ||
					format.acodec === preferredAudioQuality
				) {
					preferredAudioFormatLength++;
				}
			}

			const availableCodecs = videoFormatCodecs[defaultVideoFormat]
				? videoFormatCodecs[defaultVideoFormat].codecs
				: [];

			if (!availableCodecs.includes(preferredVideoCodec)) {
				preferredVideoCodec =
					availableCodecs[availableCodecs.length - 1];
			}

			for (let format of formats) {
				let size;
				let selectedText = "";
				let audioSelectedText = "";

				if (
					format.height == defaultVideoFormat &&
					format.vcodec &&
					format.vcodec.split(".")[0] === preferredVideoCodec &&
					!selected &&
					(format.video_ext !== "none" &&
					!(
						format.video_ext === "mp4" &&
						format.vcodec &&
						format.vcodec.split(".")[0] === "vp09"
					))
					&& (!showMoreFormats ? format.video_ext !== "webm" : true)
				) {
					selectedText = " selected ";
					selected = true;
				}

				if (format.filesize || format.filesize_approx) {
					size = (
						Number(format.filesize || format.filesize_approx) /
						1000000
					).toFixed(2);
				} else {
					// if (format.tbr) {
					// 	size = (
					// 		(format.tbr * 50 * duration) /
					// 		1000000
					// 	).toFixed(2);
					// } else {
						
					// }
					size = i18n.__("Unknown size");
				}

				// For videos

				if (
					(format.video_ext !== "none" &&
					!(
						format.video_ext === "mp4" &&
						format.vcodec &&
						format.vcodec.split(".")[0] === "vp09"
					))
					&& (!showMoreFormats ? format.video_ext !== "webm" : true)
				) {
					if (size !== i18n.__("Unknown size")) {
						size = (Number(size) + 0 || Number(audioSize)).toFixed(
							1
						);
						size = size + " " + i18n.__("MB");
					}

					const format_id =
						format.format_id +
						"|" +
						format.ext +
						"|" +
						(format.height || "NO");

					// Video codec

					const vcodec =
						format.vcodec && showMoreFormats
							? format.vcodec.split(".")[0]
							: "";
					let spaceAfterVcodec = showMoreFormats
						? "&#160".repeat(5 - vcodec.length)
						: "";
					showMoreFormats
						? (spaceAfterVcodec += "|  ")
						: (spaceAfterVcodec += "");

					// Quality
					const quality =
						(format.height
							? format.height +
							  "p" +
							  (format.fps == 60 ? "60" : "")
							: "") ||
						format.format_note ||
						format.resolution ||
						format.format_id ||
						"Unknown quality";
					const spaceAfterQuality = "&#160".repeat(
						quality.length <= 8 && 8 - quality.length > 0
							? 8 - quality.length
							: 1
					);

					// Extension
					const extension = format.ext;

					// Format and Quality Options
					const element =
						"<option value='" +
						format_id +
						"'" +
						selectedText +
						">" +
						quality +
						spaceAfterQuality +
						"| " +
						extension.padEnd(5, "\xa0") +
						"|  " +
						(vcodec ? vcodec + spaceAfterVcodec : '') +
						size +
						(format.acodec !== "none" ? " 🔈" : "") +
						"</option>";
					getId("videoFormatSelect").innerHTML += element;
				}
				// For audios
				else if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext === "none")
				) {
					if (!showMoreFormats && format.audio_ext === "webm") {
						continue;
					}

					size =
						size !== i18n.__("Unknown size")
							? size + " MB"
							: i18n.__("Unknown size");
					let audio_ext;

					if (format.audio_ext === "webm") {
						audio_ext = "opus";
					} else {
						audio_ext = format.audio_ext;
					}
					if (
						format.audio_ext === preferredAudioQuality ||
						format.acodec === preferredAudioQuality
					) {
						preferredAudioFormatCount += 1;
						if (
							preferredAudioFormatCount ===
							preferredAudioFormatLength
						) {
							audioSelectedText = " selected ";
						}
					}

					const format_id = format.format_id + "|" + audio_ext;

					/**@type {string} */
					let formatNote = (i18n.__(format.format_note) ||
					i18n.__("Unknown quality"));

					formatNote = formatNote.padEnd(maxAudioFormatNoteLength, "\xa0")

					const element =
						"<option value='" +
						format_id +
						"'" +
						audioSelectedText +
						">" +
						// i18n.__("Quality") +
						// ": " +
						formatNote +
						"| " +
						audio_ext.padEnd(4, "\xa0") +
						" | " +
						size +
						"</option>";

					getId("audioFormatSelect").innerHTML += element;
					getId("audioForVideoFormatSelect").innerHTML += element;
					
				}
				// Both audio and video available
				else if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext !== "none")
				) {
					// Skip them
				}

				// When there is no audio
				if (audioIsPresent === false) {
					getId("audioPresent").style.display = "none";
				} else {
					getId("audioPresent").style.display = "block";
				}
			}
		}
	});
}

// Video download event
getId("videoDownload").addEventListener("click", (event) => {
	checkMaxDownloads();
	hideHidden();
	console.log(`Current:${currentDownloads} Max:${maxActiveDownloads}`);

	if (currentDownloads < maxActiveDownloads) {
		manageAdvanced(duration);
		download("video");
		currentDownloads++;
	} else {
		// Handling active downloads for video
		manageAdvanced(duration);
		const range1 = rangeOption;
		const range2 = rangeCmd;
		const subs1 = subs;
		const subs2 = subLangs;
		const url1 = getId("url").value;
		const thumb1 = thumbnail;
		const title1 = title;

		const randId = Math.random().toFixed(10).toString().slice(2);
		const item = `
		<div class="item" id="${randId}">
			<div class="itemIconBox">
			<img src="${
				thumbnail || "../assets/images/thumb.png"
			}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">
			<span class="itemType">${i18n.__("Video")}</span>
			</div>
			<div class="itemBody">
				<div class="itemTitle">${title}</div>
				<p>${i18n.__("Download pending")}</p>
			</div>
		</div>
		`;
		getId("list").innerHTML += item;
		const interval = setInterval(() => {
			if (currentDownloads < maxActiveDownloads) {
				getId(randId).remove();
				download(
					"video",
					url1,
					range1,
					range2,
					subs1,
					subs2,
					thumb1,
					title1
				);
				currentDownloads++;
				clearInterval(interval);
			}
		}, 2000);
	}
});

// Audio download event
getId("audioDownload").addEventListener("click", (event) => {
	checkMaxDownloads();
	hideHidden();
	console.log(`Current:${currentDownloads} Max:${maxActiveDownloads}`);

	if (currentDownloads < maxActiveDownloads) {
		manageAdvanced(duration);
		download("audio");
		currentDownloads++;
	} else {
		// Handling active downloads for audio
		manageAdvanced(duration);
		const range1 = rangeOption;
		const range2 = rangeCmd;
		const subs1 = subs;
		const subs2 = subLangs;
		const url1 = getId("url").value;
		const thumb1 = thumbnail;
		const title1 = title;

		const randId = Math.random().toFixed(10).toString().slice(2);

		const item = `
		
		<div class="item" id="${randId}">
			<div class="itemIconBox">
			<img src="${thumbnail}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">
			<span class="itemType">${i18n.__("Audio")}</span>
			</div>
			<div class="itemBody">
				<div class="itemTitle">${title}</div>
				<p>${i18n.__("Download pending")}</p>
			</div>
		</div>
		`;
		getId("list").innerHTML += item;
		const interval = setInterval(() => {
			if (currentDownloads < maxActiveDownloads) {
				getId(randId).remove();
				download(
					"audio",
					url1,
					range1,
					range2,
					subs1,
					subs2,
					thumb1,
					title1
				);
				currentDownloads++;
				clearInterval(interval);
			}
		}, 2000);
	}
});

getId("extractBtn").addEventListener("click", () => {
	checkMaxDownloads();
	hideHidden();

	console.log(`Current:${currentDownloads} Max:${maxActiveDownloads}`);

	if (currentDownloads < maxActiveDownloads) {
		manageAdvanced(duration);
		download("extract");
		currentDownloads++;
	} else {
		manageAdvanced(duration);
		const range1 = rangeOption;
		const range2 = rangeCmd;
		const subs1 = subs;
		const subs2 = subLangs;
		const url1 = getId("url").value;
		const randId = Math.random().toFixed(10).toString().slice(2);
		const thumb1 = thumbnail;
		const title1 = title;
		const extractFormat = getId("extractSelection").value;
		const extractQuality = getId("extractQualitySelect").value;

		const item = `
		<div class="item" id="${randId}">
			<div class="itemIconBox">
			<img src="${thumbnail}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">
			<span class="itemType">${i18n.__("Audio")}</span>
		</div>
			<div class="itemBody">
				<div class="itemTitle">${title}</div>
				<p>${i18n.__("Download pending")}</p>
			</div>
		</div>
		`;
		getId("list").innerHTML += item;
		const interval = setInterval(() => {
			if (currentDownloads < maxActiveDownloads) {
				getId(randId).remove();
				download(
					"extract",
					url1,
					range1,
					range2,
					subs1,
					subs2,
					thumb1,
					title1,
					extractFormat,
					extractQuality
				);
				currentDownloads++;
				clearInterval(interval);
			}
		}, 2000);
	}
});

// Time formatting

function timeFormat(duration) {
	// Hours, minutes and seconds
	var hrs = ~~(duration / 3600);
	var mins = ~~((duration % 3600) / 60);
	var secs = ~~duration % 60;
	// Output like "1:01" or "4:03:59" or "123:03:59"
	var ret = "";
	if (hrs > 0) {
		ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
	}
	ret += "" + mins + ":" + (secs < 10 ? "0" : "");
	ret += "" + secs;
	return ret;
}

// Manage advanced options, needs to be called

function manageAdvanced(duration) {
	let startTime = getId("startTime").value;
	let endTime = getId("endTime").value;

	if (startTime && !endTime) {
		rangeCmd = `*${startTime}-${timeFormat(duration)}`;
		rangeOption = "--download-sections";
	} else if (!startTime && endTime) {
		rangeCmd = `*0-${endTime}`;
		rangeOption = "--download-sections";
	} else if (startTime && endTime) {
		rangeCmd = `*${startTime}-${endTime}`;
		rangeOption = "--download-sections";
	} else {
		rangeOption = "";
		rangeCmd = "";
	}

	// If subtitles are checked
	if (getId("subChecked").checked) {
		subs = "--write-subs";
		subLangs = "--sub-langs all";
	} else {
		subs = "";
		subLangs = "";
	}

	console.log("Range option: " + rangeOption);
	console.log("rangeCmd:" + rangeCmd);
}
//////////////////////////////
// Downloading with yt-dlp
//////////////////////////////

function download(
	type,
	url1 = "",
	range1 = "",
	range2 = "",
	subs1 = "",
	subs2 = "",
	thumb1 = "",
	title1 = "",
	extractFormat = "",
	extractQuality = ""
) {
	// Config file
	const newTitle = title1 || title;

	if (localStorage.getItem("configPath")) {
		configArg = "--config-location";
		configTxt = `"${localStorage.getItem("configPath")}"`;
	}

	const url = url1 || getId("url").value;
	console.log("URL", url);
	let ext, extractExt, extractFormat1, extractQuality1, audioForVideoExt;

	/**@type {string}*/
	let format_id, audioForVideoFormat_id;
	const randomId = "a" + Math.random().toFixed(10).toString().slice(2);

	// Whether to close app
	let quit = Boolean(getId("quitChecked").checked);

	if (type === "video") {
		const videoValue = getId("videoFormatSelect").value;
		/**@type {string} */
		const audioForVideoValue = getId("audioForVideoFormatSelect").value

		format_id = videoValue.split("|")[0];
		const videoExt = videoValue.split("|")[1];

		if (videoValue.split("|")[2] != "NO") {
			preferredVideoQuality = Number(videoValue.split("|")[2]);
		}

		audioForVideoFormat_id = audioForVideoValue.split("|")[0];

		if (audioForVideoValue.split("|")[1] === "webm") {
			audioForVideoExt = "opus";
		} else {
			audioForVideoExt = audioForVideoValue.split("|")[1];
		}

		if ((videoExt === "mp4" && audioForVideoExt === "opus") || (videoExt === "webm" && (audioForVideoExt === "m4a" || audioForVideoExt === "mp4"))) {
			ext = "mkv"
		} else {
			ext = videoExt;
		}


	} else if (type === "audio") {
		format_id = getId("audioFormatSelect").value.split("|")[0];
		if (getId("audioFormatSelect").value.split("|")[1] === "webm") {
			ext = "opus";
		} else {
			ext = getId("audioFormatSelect").value.split("|")[1];
		}
	}
	console.log("Download extension:", ext);

	const newItem = `
		<div class="item" id="${randomId}">
		<div class="itemIconBox">
			<img src="${
				thumb1 || thumbnail || "../assets/images/thumb.png"
			}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">
			<span class="itemType">${
				type === "video" ? i18n.__("Video") : i18n.__("Audio")
			}</span>
		</div>
		<img src="../assets/images/close.png" onClick="fadeItem('${randomId}')" class="itemClose"}" id="${
		randomId + ".close"
	}">


		<div class="itemBody">
			<div class="itemTitle">${newTitle}</div>
			<strong class="itemSpeed" id="${randomId + "speed"}"></strong>
			<div id="${randomId + "prog"}" class="itemProgress"></div>
		</div>
	</div>
	`;
	getId("list").innerHTML += newItem;
	getId("loadingWrapper").style.display = "none";
	getId(randomId + "prog").textContent = i18n.__("Preparing...");

	getId(randomId + ".close").addEventListener("click", () => {
		if (getId(randomId)) {
			fadeItem(randomId);
		}
	});

	let downloadProcess;
	let filename = "";

	// Filtering characters for Unix platforms
	let pattern = ["/", '"', "`", "#"];

	if (process.platform === "win32") {
		pattern = [
			"[",
			"]",
			"*",
			"<",
			">",
			"|",
			"\\",
			"/",
			"?",
			'"',
			"`",
			"#",
			"：",
			":",
		];
	}

	// Trying to remove ambiguous characters
	for (let i = 0; i < newTitle.length; i++) {
		let letter = "";
		if (pattern.includes(newTitle[i])) {
			letter = "";
		} else {
			letter = newTitle[i];
		}
		filename += letter;
	}
	filename = filename.slice(0, 100);
	if (filename[0] === ".") {
		filename = filename.slice(1, 100);
	}
	console.log("Filename:", filename);

	/**@type {string} */
	let audioFormat = "+ba";

	if (audioForVideoFormat_id === "auto") {
		if (ext === "mp4") {
			if (!(audioExtensionList.length == 0)) {
				if (audioExtensionList.includes("m4a")) {
					audioFormat = "+m4a";
				}
			} else {
				audioFormat = "";
			}
		}

	} else if (audioForVideoFormat_id === "none") {
		audioFormat = ""
	}
	 else {
		audioFormat = `+${audioForVideoFormat_id}`;
	}

	const controller = new AbortController();
	controllers[randomId] = controller;

	console.log(rangeOption + " " + rangeCmd);
	console.log(`-f ${format_id}${audioFormat}`);

	if (type === "video" && onlyvideo) {
		// If video has no sound, audio needs to be downloaded
		console.log("Downloading both video and audio");

		downloadProcess = ytdlp.exec(
			[
				range1 || rangeOption,
				range2 || rangeCmd,
				"-f",
				`${format_id}${audioFormat}`,
				"-o",
				`"${path.join(downloadDir, filename + `.${ext}`)}"`,
				"--ffmpeg-location",
				ffmpeg,
				subs1 || subs,
				subs2 || subLangs,
				"--no-playlist",
				"--embed-metadata",
				ext == "mp4" && audioForVideoExt === "m4a" ? "--embed-thumbnail" : "",
				configArg,
				configTxt,
				cookieArg,
				browser,
				"--no-mtime",
				`"${url}"`,
			],
			{shell: true, detached: false},
			controller.signal
		);
	} else if (type === "extract") {
		if (extractFormat == "alac") {
			extractExt = "m4a";
		} else if (extractFormat == "vorbis") {
			extractExt = "ogg";
		} else {
			extractExt = extractFormat || getId("extractSelection").value;
		}
		extractFormat1 = extractFormat || getId("extractSelection").value;
		extractQuality1 = extractQuality || getId("extractQualitySelect").value;

		console.log(extractFormat1);
		console.log(extractQuality1);

		downloadProcess = ytdlp.exec(
			[
				"-x",
				"--audio-format",
				extractFormat1,
				"--audio-quality",
				extractQuality1,
				"-o",
				`"${path.join(downloadDir, filename + `.${extractExt}`)}"`,
				"--ffmpeg-location",
				ffmpeg,
				"--no-playlist",
				"--embed-metadata",
				extractFormat1 == "m4a" || extractFormat1 == "mp3"
					? "--embed-thumbnail"
					: "",
				cookieArg,
				browser,
				configArg,
				configTxt,
				"--no-mtime",
				`"${url}"`,
			],
			{shell: true, detached: false},
			controller.signal
		);
	}
	// If downloading only audio or video with audio
	else {
		console.log("downloading only audio or video with audio");

		downloadProcess = ytdlp.exec(
			[
				range1 || rangeOption,
				range2 || rangeCmd,
				"-f",
				format_id,
				"-o",
				`"${path.join(downloadDir, filename + `.${ext}`)}"`,
				"--ffmpeg-location",
				ffmpeg,
				subs1 || subs,
				subs2 || subLangs,
				"--no-playlist",
				"--embed-metadata",
				ext == "m4a" || ext == "mp4" ? "--embed-thumbnail" : "",
				cookieArg,
				browser,
				configArg,
				configTxt,
				"--no-mtime",
				`"${url}"`,
			],
			{shell: true, detached: false},
			controller.signal
		);
	}

	console.log("Spawn args:" + downloadProcess.ytDlpProcess.spawnargs[downloadProcess.ytDlpProcess.spawnargs.length - 1])

	getId(randomId + ".close").addEventListener("click", () => {
		controller.abort()
		try {
			process.kill(downloadProcess.ytDlpProcess.pid, 'SIGHINT')
		} catch (_error) {}
	});

	downloadProcess
		.on("progress", (progress) => {
			if (progress.percent == 100) {
				getId(randomId + "prog").textContent =
					i18n.__("Processing") + "...";
				
				ipcRenderer.send("progress", 0)
			} else {
				getId(randomId + "speed").textContent = `${i18n.__("Speed")}: ${
					progress.currentSpeed || 0
				}`;			ipcRenderer.send("progress", progress.percent)

				getId(
					randomId + "prog"
				).innerHTML = `<progress class="progressBar" min=0 max=100 value=${progress.percent}>`;

				ipcRenderer.send("progress", progress.percent / 100)
			}
		})
		.once("ytDlpEvent", (_eventType, _eventData) => {
			getId(randomId + "prog").textContent = i18n.__("Downloading...");
		})
		.once("close", (code) => {
			getId(randomId + "speed").textContent = "";
			currentDownloads--;
			console.log("Closed with code " + code);
			if (code == 0) {
				// If extration is done
				if (type === "extract") {
					console.log(
						path.join(downloadDir, filename + `.${extractFormat1}`)
					);

					afterSave(
						downloadDir,
						filename + `.${extractExt}`,
						randomId + "prog",
						thumb1 || thumbnail
					);
				}
				// If download is done
				else {
					console.log(path.join(downloadDir, filename + `.${ext}`));
					afterSave(
						downloadDir,
						filename + `.${ext}`,
						randomId + "prog",
						thumb1 || thumbnail
					);
				}
			}
			if (quit) {
				console.log("Quitting app");
				quitApp();
			}
		})
		.once("error", (error) => {
			currentDownloads--;
			getId(randomId + "prog").textContent = i18n.__(
				"Some error has occurred. Hover to see details"
			);
			getId(randomId + "prog").title = error.message;
			console.log(error.message);
		});
}

function quitApp() {
	ipcRenderer.send("quit", "quit");
}

// Removing item

function fadeItem(id) {
	controllers[id].abort();
	getId(id).classList.add("scale");
	setTimeout(() => {
		if (getId(id)) {
			getId(id).remove();
		}
	}, 500);
}

// After saving video

function afterSave(location, filename, progressId, thumbnail) {
	const notify = new Notification("ytDownloader", {
		body: filename,
		icon: thumbnail,
	});

	notify.onclick = () => {
		showItem(finalLocation, finalFilename);
	};

	let finalLocation = location;
	let finalFilename = filename;
	if (os.platform() === "win32") {
		finalLocation = location.split(path.sep).join("\\\\");
		finalFilename = filename.split(path.sep).join("\\\\");
	}
	getId(
		progressId
	).innerHTML = `<b onClick="showItem(\`${finalLocation}\`, \`${finalFilename}\`)">${i18n.__(
		"File saved. Click to Open"
	)}</b>`;

	window.scrollTo(0, document.body.scrollHeight);
}

function showItem(location, filename) {
	shell.showItemInFolder(`${path.join(location, filename)}`);
}

// Rename title

function renameTitle() {
	title = getId("titleName").value;
	console.log(title);
}

// Opening windows
function closeMenu() {
	getId("menuIcon").style.transform = "rotate(0deg)";
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			clearInterval(fade);
			getId("menu").style.display = "none";
		} else {
			opacity -= 0.1;
			getId("menu").style.opacity = String(opacity);
			count++;
		}
	}, 50);
}

function hideHidden() {
	getId("hidden").classList.remove("scaleUp");
	getId("hidden").classList.add("scale");
	setTimeout(() => {
		getId("hidden").style.display = "none";
		getId("hidden").classList.remove("scale");
	}, 400);
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

getId("playlistWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-win", __dirname + "/playlist.html");
});
// getId("newPlaylistWin").addEventListener("click", () => {
// 	closeMenu();
// 	ipcRenderer.send("load-win", __dirname + "/playlist_new.html");
// });

ipcRenderer.on("link", (event, text) => {
	pasteFromTray(text);
});

// Selecting download directory
getId("selectLocation").addEventListener("click", () => {
	ipcRenderer.send("select-location-main", "");
});

ipcRenderer.on("downloadPath", (event, downloadPath) => {
	console.log(downloadPath);
	getId("path").textContent = downloadPath[0];
	downloadDir = downloadPath[0];
});
