const cp = require("child_process");
const os = require("os");
const fs = require("fs");
const path = require("path");
const {shell, ipcRenderer, clipboard} = require("electron");
const {default: YTDlpWrap} = require("yt-dlp-wrap-plus");
const {constants} = require("fs/promises");

let ffmpeg = "";

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
	} catch (_err) {}
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

// Download directory
let downloadDir = "";

// Global variables
let title, onlyVideo, thumbnail, ytDlp, duration, extractor_key;
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
let proxy = "";
let downloadedItemList = [];
let ytDlpIsPresent = false;

if (localStorage.getItem("configPath")) {
	configArg = "--config-location";
	configTxt = `"${localStorage.getItem("configPath")}"`;
}

checkMaxDownloads();

// Get system proxy
// getSystemProxy("https://www.google.com").then((proxyInfo) => {
// 	if (proxyInfo != "DIRECT") {
// 		try {
// 			const proxyUrl = proxyInfo.split(" ")[1];

// 			proxy = proxyUrl;

// 			console.log("System proxy: " + proxy);
// 		} catch (_) {}
// 	}
// });

// Check for updates
let autoUpdate = true;

if (localStorage.getItem("autoUpdate") == "false") {
	autoUpdate = false;
}

if (process.windowsStore) {
	autoUpdate = false;
}

if (process.env.YTDOWNLOADER_AUTO_UPDATES == "0") {
	autoUpdate = false;
}

ipcRenderer.send("autoUpdate", autoUpdate);

let currentDownloads = 0;
let controllers = new Object();

// Video and audio preferences
let preferredVideoQuality = 1080;
let preferredAudioQuality = "";
let preferredVideoCodec = "avc1";
/**
 *
 * @param {string} id
 */

downloadPathSelection();

const possiblePaths = [
	"/opt/homebrew/bin/yt-dlp", // Apple Silicon
	"/usr/local/bin/yt-dlp", // Intel
];

// Checking for yt-dlp
let ytDlpPath = path.join(os.homedir(), ".ytDownloader", "ytdlp");

if (os.platform() == "win32") {
	ytDlpPath = path.join(os.homedir(), ".ytDownloader", "ytdlp.exe");
}

// Macos yt-dlp check
if (os.platform() === "darwin") {
	ytDlpPath = possiblePaths.find((p) => fs.existsSync(p)) || null;

	if (ytDlpPath == null) {
		showMacYtdlpPopup();
	} else {
		ytDlpIsPresent = true;
		ytDlp = new YTDlpWrap(`"${ytDlpPath}"`);
		setLocalStorageYtDlp(ytDlpPath);
	}
}

// Use system yt-dlp for freebsd
if (os.platform() === "freebsd") {
	try {
		ytDlpPath = cp
			.execSync("which yt-dlp")
			.toString("utf8")
			.split("\n")[0]
			.trim();

		ytDlpIsPresent = true;
		ytDlp = new YTDlpWrap(`"${ytDlpPath}"`);
		setLocalStorageYtDlp(ytDlpPath);
	} catch (error) {
		console.log(error);

		hidePasteBtn();

		getId("incorrectMsg").textContent = i18n.__(
			"No yt-dlp found in PATH. Make sure you have the full executable. App will not work"
		);
	}
}

// Getting yt-dlp path from environment variable
if (process.env.YTDOWNLOADER_YTDLP_PATH) {
	ytDlpPath = process.env.YTDOWNLOADER_YTDLP_PATH;

	if (fs.existsSync(ytDlpPath)) {
		logYtDlpPresent(ytDlpPath);

		ytDlp = new YTDlpWrap(`"${ytDlpPath}"`);
		ytDlpIsPresent = true;
		setLocalStorageYtDlp(ytDlpPath);
	} else {
		hidePasteBtn();

		getId("incorrectMsg").textContent = i18n.__(
			"You have specified YTDOWNLOADER_YTDLP_PATH, but no file exists there."
		);
	}
}

// Checking if yt-dlp bin is present
if (
	localStorage.getItem("ytdlp") &&
	os.platform() != "darwin" &&
	os.platform() != "freebsd" &&
	!process.env.YTDOWNLOADER_YTDLP_PATH
) {
	const localStorageytDlpPath = localStorage.getItem("ytdlp");

	if (fs.existsSync(localStorageytDlpPath)) {
		logYtDlpPresent(ytDlpPath);

		ytDlp = new YTDlpWrap(`"${ytDlpPath}"`);

		cp.spawn(`${ytDlpPath}`, ["-U"]).stdout.on("data", (data) =>
			console.log(data.toString("utf8"))
		);

		ipcRenderer.send("ready-for-links");

		ytDlpIsPresent = true;
		setLocalStorageYtDlp(ytDlpPath);
	}
}

if (
	!ytDlpIsPresent &&
	!process.env.YTDOWNLOADER_YTDLP_PATH &&
	os.platform() !== "freebsd" &&
	os.platform() !== "darwin"
) {
	// yt-dlp download path
	let ytDlpDownloadPath;
	if (os.platform() == "win32") {
		ytDlpDownloadPath = path.join(
			os.homedir(),
			".ytDownloader",
			"ytdlp.exe"
		);
	} else {
		ytDlpDownloadPath = path.join(os.homedir(), ".ytDownloader", "ytdlp");
	}

	cp.exec(`"${ytDlpPath}" --version`, (error, _stdout, _stderr) => {
		if (error) {
			getId("popupBox").style.display = "block";

			process.on("uncaughtException", (_reason, _promise) => {
				handleYtDlpError();
			});

			downloadYtDlp(ytDlpDownloadPath);
		} else {
			logYtDlpPresent(ytDlpPath);

			ytDlp = new YTDlpWrap(`"${ytDlpPath}"`);

			cp.spawn(`${ytDlpPath}`, ["-U"]).stdout.on("data", (data) =>
				console.log(data.toString("utf8"))
			);

			ipcRenderer.send("ready-for-links");
			setLocalStorageYtDlp(ytDlpPath);
		}
	});
}

// Ffmpeg check
if (os.platform() === "win32") {
	ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
} else if (os.platform() === "freebsd") {
	try {
		ffmpeg = cp
			.execSync("which ffmpeg")
			.toString("utf8")
			.split("\n")[0]
			.trim();
	} catch (error) {
		console.log(error);

		getId("incorrectMsg").textContent = i18n.__("No ffmpeg found in PATH");
	}
} else {
	ffmpeg = `"${__dirname}/../ffmpeg"`;
}

if (process.env.YTDOWNLOADER_FFMPEG_PATH) {
	ffmpeg = `"${process.env.YTDOWNLOADER_FFMPEG_PATH}"`;

	if (fs.existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)) {
		console.log("Using YTDOWNLOADER_FFMPEG_PATH");
	} else {
		getId("incorrectMsg").textContent = i18n.__(
			"You have specified YTDOWNLOADER_FFMPEG_PATH, but no file exists there."
		);
	}
}

console.log(ffmpeg);

getId("closeHidden").addEventListener("click", () => {
	hideHidden();
	getId("loadingWrapper").style.display = "none";
});

document.addEventListener("keydown", (event) => {
	if (
		event.ctrlKey &&
		event.key == "v" &&
		document.activeElement.tagName !== "INPUT"
	) {
		pasteUrl();
	}
});

getId("pasteUrl").addEventListener("click", () => {
	pasteUrl();
});

// Getting video info
/**
 *
 * @param {string} url
 */
async function getInfo(url) {
	audioExtensionList = [];
	let selected = false;
	onlyVideo = false;
	let audioIsPresent = false;
	downloadPathSelection();

	// Cleaning text
	resetDomValues();

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

	proxy = getLocalStorageItem("proxy");

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

	const infoOptions = [
		"-j",
		"--no-playlist",
		"--no-warnings",
		proxy ? "--no-check-certificate" : "",
		proxy ? "--proxy" : "",
		proxy,
		cookieArg,
		browser,
		configArg,
		configTxt,
		`"${url}"`,
	].filter((item) => item);

	const infoProcess = cp.spawn(`"${ytDlpPath}"`, infoOptions, {
		shell: true,
	});

	infoProcess.stdout.on("data", (data) => {
		info += data;
	});

	infoProcess.stderr.on("data", (error) => {
		if (!error.toString().startsWith("WARNING")) {
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
		}
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
			thumbnail = parsedInfo.thumbnail;
			duration = parsedInfo.duration;
			extractor_key = parsedInfo.extractor_key;
			/**
			 * @typedef {import("./types").format} format
			 * @type {format[]}
			 */
			const formats = parsedInfo.formats || [];
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

			const titleElement = getId("title");
			titleElement.textContent = "";

			titleElement.append(
				Object.assign(document.createElement("b"), {
					textContent: i18n.__("Title "),
				}),
				": ",
				Object.assign(document.createElement("input"), {
					className: "title",
					id: "titleName",
					type: "text",
					value: title,
					onchange: renameTitle,
				})
			);

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
					format.video_ext !== "none" &&
					!(
						format.video_ext === "mp4" &&
						format.vcodec &&
						format.vcodec.split(".")[0] === "vp09"
					) &&
					(!showMoreFormats ? format.video_ext !== "webm" : true)
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
					onlyVideo = true;
					audioSize =
						Number(format.filesize || format.filesize_approx) /
						1000000;

					if (!audioExtensionList.includes(format.audio_ext)) {
						audioExtensionList.push(format.audio_ext);
					}

					if (
						format.format_note &&
						format.format_note.length > maxAudioFormatNoteLength
					) {
						maxAudioFormatNoteLength = format.format_note.length;
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
					format.video_ext !== "none" &&
					!(
						format.video_ext === "mp4" &&
						format.vcodec &&
						format.vcodec.split(".")[0] === "vp09"
					) &&
					(!showMoreFormats ? format.video_ext !== "webm" : true)
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
					format.video_ext !== "none" &&
					!(
						format.video_ext === "mp4" &&
						format.vcodec &&
						format.vcodec.split(".")[0] === "vp09"
					) &&
					(!showMoreFormats ? format.video_ext !== "webm" : true)
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
						(vcodec ? vcodec + spaceAfterVcodec : "") +
						size +
						(format.acodec !== "none" ? " 🔊" : "") +
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
					let formatNote =
						i18n.__(format.format_note) ||
						i18n.__("Unknown quality");

					formatNote = formatNote.padEnd(
						maxAudioFormatNoteLength,
						"\xa0"
					);

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
		const audioForVideoValue = getId("audioForVideoFormatSelect").value;

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

		if (
			(videoExt === "mp4" && audioForVideoExt === "opus") ||
			(videoExt === "webm" &&
				(audioForVideoExt === "m4a" || audioForVideoExt === "mp4"))
		) {
			ext = "mkv";
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
			removeFromDownloadedList(randomId);
			fadeItem(randomId);
		}
	});

	let downloadProcess;
	let filename = "";

	// Filtering characters for Unix platforms
	let pattern = ["/", '"', "`", "#"];

	if (os.platform() === "win32") {
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

	// Adding info about trimmed range to filename
	if (range2 || rangeCmd) {
		let rangeTxt = (range2 || rangeCmd).replace("*", "");
		if (os.platform() === "win32") {
			rangeTxt = rangeTxt.replaceAll(":", "_");
			console.log({rangeTxt});
		}
		filename += `[${rangeTxt}]`;
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
		audioFormat = "";
	} else {
		audioFormat = `+${audioForVideoFormat_id}`;
	}

	const controller = new AbortController();
	controllers[randomId] = controller;

	console.log(rangeOption + " " + rangeCmd);
	console.log(`-f ${format_id}${audioFormat}`);

	if (type === "video" && onlyVideo) {
		// If video has no sound, audio needs to be downloaded
		console.log("Downloading both video and audio");

		const cleanFfmpegPathWin = path.join(__dirname, "..", "ffmpeg.exe");

		const args = [
			range1 || rangeOption,
			range2 || rangeCmd,
			"-f",
			`${format_id}${audioFormat}`,
			"-o",
			`"${path.join(downloadDir, filename + `.${ext}`)}"`,
			"--ffmpeg-location",
			ffmpeg,
			// Fix for windows media player
			os.platform() == "win32" && audioFormat == "" && ext == "mp4"
				? `--exec "\\"${cleanFfmpegPathWin}\\" -y -i {} -c copy -movflags +faststart -brand isom {}.fixed.mp4 && move /Y {}.fixed.mp4 {}"`
				: "",
			subs1 || subs,
			subs2 || subLangs,
			"--no-playlist",
			"--embed-chapters",
			// "--embed-metadata",
			ext == "mp4" &&
			audioForVideoExt === "m4a" &&
			extractor_key === "Youtube" &&
			os.platform() !== "darwin"
				? "--embed-thumbnail"
				: "",
			configArg,
			configTxt,
			cookieArg,
			browser,
			"--no-mtime",
			proxy ? "--no-check-certificate" : "",
			proxy ? "--proxy" : "",
			proxy,
			`"${url}"`,
		].filter((item) => item);

		downloadProcess = ytDlp.exec(
			args,
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

		const args = [
			"-x",
			"--audio-format",
			extractFormat1,
			"--audio-quality",
			extractQuality1,
			"-o",
			`"${path.join(downloadDir, filename + `.${extractExt}`)}"`,
			"--ffmpeg-location",
			ffmpeg,
			"--embed-chapters",
			"--no-playlist",
			// "--embed-metadata",
			(extractFormat1 == "m4a" || extractFormat1 == "mp3") &&
			extractor_key === "Youtube" &&
			os.platform() !== "darwin"
				? "--embed-thumbnail"
				: "",
			cookieArg,
			browser,
			configArg,
			configTxt,
			"--no-mtime",
			proxy ? "--no-check-certificate" : "",
			proxy ? "--proxy" : "",
			proxy,
			`"${url}"`,
		].filter((item) => item);

		downloadProcess = ytDlp.exec(
			args,
			{shell: true, detached: false},
			controller.signal
		);
	}
	// If downloading only audio or video with audio
	else {
		console.log("downloading only audio or video with audio");

		const args = [
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
			"--embed-chapters",
			// "--embed-metadata",
			(ext == "m4a" || ext == "mp4") &&
			extractor_key === "Youtube" &&
			os.platform() !== "darwin"
				? "--embed-thumbnail"
				: "",
			cookieArg,
			browser,
			configArg,
			configTxt,
			"--no-mtime",
			proxy ? "--no-check-certificate" : "",
			proxy ? "--proxy" : "",
			proxy,
			`"${url}"`,
		].filter((item) => item);

		downloadProcess = ytDlp.exec(
			args,
			{shell: true, detached: false},
			controller.signal
		);
	}

	console.log(
		"Spawn args:" +
			downloadProcess.ytDlpProcess.spawnargs[
				downloadProcess.ytDlpProcess.spawnargs.length - 1
			]
	);

	getId(randomId + ".close").addEventListener("click", () => {
		controller.abort();
		try {
			process.kill(downloadProcess.ytDlpProcess.pid, "SIGINT");
		} catch (_error) {}
	});

	downloadProcess
		.on("progress", (progress) => {
			if (progress.percent == 100) {
				getId(randomId + "speed").textContent = "";
				getId(randomId + "prog").textContent =
					i18n.__("Processing") + "...";

				ipcRenderer.send("progress", 0);
			} else {
				getId(randomId + "speed").textContent = `${i18n.__("Speed")}: ${
					progress.currentSpeed || 0
				}`;
				ipcRenderer.send("progress", progress.percent);

				getId(
					randomId + "prog"
				).innerHTML = `<progress class="progressBar" min=0 max=100 value=${progress.percent}>`;

				ipcRenderer.send("progress", progress.percent / 100);
			}
		})
		.once("ytDlpEvent", (_eventType, _eventData) => {
			getId(randomId + "prog").textContent = i18n.__("Downloading...");
		})
		.once("close", (code) => {
			getId(randomId + "speed").textContent = "";
			addToDownloadedList(randomId);
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

function clearAllDownloaded() {
	downloadedItemList.forEach((item) => {
		fadeItem(item);
	});
	downloadedItemList = [];
	hideClearBtn();
}

function addToDownloadedList(id) {
	downloadedItemList.push(id);

	if (downloadedItemList.length > 1) {
		getId("clearBtn").style.display = "inline-block";
	}
}

function removeFromDownloadedList(id) {
	downloadedItemList.splice(downloadedItemList.indexOf(id), 1);

	if (downloadedItemList.length < 2) {
		hideClearBtn();
	}
}

function hideClearBtn() {
	getId("clearBtn").style.display = "none";
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
	const fileSavedElement = document.createElement("b");
	fileSavedElement.textContent = i18n.__("File saved. Click to Open");
	fileSavedElement.onclick = () => {
		showItem(finalLocation, finalFilename);
	};

	getId(progressId).innerHTML = "";
	getId(progressId).appendChild(fileSavedElement);

	window.scrollTo(0, document.body.scrollHeight);
}

// async function getSystemProxy(url) {
// 	const proxy = await ipcRenderer.invoke("get-proxy", url);
// 	return proxy;
// }

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

// Popup message
function showPopup(text) {
	console.log("Triggered showpopup");
	getId("popupText").textContent = text;
	getId("popupText").style.display = "inline-block";
	setTimeout(() => {
		getId("popupText").style.display = "none";
	}, 2200);
}

/**
 *
 * @param {string} item
 * @returns string
 */
function getLocalStorageItem(item) {
	return localStorage.getItem(item) || "";
}

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
	ipcRenderer.send("load-win", __dirname + "/playlist_new.html");
});

getId("compressorWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-win", __dirname + "/compressor.html");
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

getId("clearBtn").addEventListener("click", () => {
	clearAllDownloaded();
});

ipcRenderer.on("downloadPath", (event, downloadPath) => {
	console.log(downloadPath);
	getId("path").textContent = downloadPath[0];
	downloadDir = downloadPath[0];
});

// Downloading yt-dlp
async function downloadYtDlp(downloadPath) {
	document.querySelector("#popupBox p").textContent = i18n.__(
		"Please wait, necessary files are being downloaded"
	);
	getId("popupSvg").style.display = "inline";

	// Downloading appropriate version of yt-dlp
	await YTDlpWrap.downloadFromGithub(downloadPath);

	getId("popupBox").style.display = "none";
	ytDlp = new YTDlpWrap(`"${ytDlpPath}"`);
	localStorage.setItem("ytdlp", ytDlpPath);
	console.log("yt-dlp bin Path: " + ytDlpPath);
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

function showMacYtdlpPopup() {
	getId("popupBoxMac").style.display = "block";
}

function handleYtDlpError() {
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
		downloadYtDlp();
	});
}

function resetDomValues() {
	getId("videoFormatSelect").innerHTML = "";
	getId("audioFormatSelect").innerHTML = "";
	getId(
		"audioForVideoFormatSelect"
	).innerHTML = `<option value="none|none">No Audio</option>`;
	getId("startTime").value = "";
	getId("endTime").value = "";
	getId("errorBtn").style.display = "none";
	getId("errorDetails").style.display = "none";
	getId("errorDetails").textContent = "";
}

function logYtDlpPresent(ytDlpPath) {
	console.log("yt-dlp bin is present");
	console.log(ytDlpPath);
}

function hidePasteBtn() {
	getId("pasteUrl").style.display = "none";
}

function setLocalStorageYtDlp(ytDlpPath) {
	localStorage.setItem("ytdlp", ytDlpPath);
}
