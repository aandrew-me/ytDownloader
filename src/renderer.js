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
const { shell, ipcRenderer, clipboard } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-plus");

// Directories
const homedir = os.homedir();
const appdir = path.join(homedir, "Downloads");
const hiddenDir = path.join(homedir, ".ytDownloader");
const i18n = new (require("../translations/i18n"))();

fs.mkdir(hiddenDir, { recursive: true }, () => {});

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
let title, onlyvideo, id, thumbnail, ytdlp, duration, extractFormat;
let rangeCmd = "";
let subs = "";
let subLangs;
let rangeOption = "--download-sections";
let cookieArg = "";
let browser = "";
let maxActiveDownloads = 5;
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

let currentDownloads = 0;
let controllers = new Object();

// Video and audio preferences
let preferredVideoQuality = "";
let preferredAudioQuality = "";

function getId(id) {
	return document.getElementById(id);
}

function downloadPathSelection() {
	let localPath = localStorage.getItem("downloadPath");

	if (localPath) {
		downloadDir = localPath;
	} else {
		downloadDir = appdir;
		localStorage.setItem("downloadPath", appdir);
	}
	fs.mkdir(downloadDir, { recursive: true }, () => {});
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
		// Checking python version
		try {
			const result = cp.execSync("python3 --version", {
				encoding: "utf-8",
			});
			const minorVersion = Number(result.split(" ")[1].split(".")[1]);
			if (minorVersion >= 7) {
				await YTDlpWrap.downloadFromGithub(ytdlpDownloadPath);
			} else {
				// Downloading full binary if python version is less than 3.7
				await YTDlpWrap.downloadFromGithub(
					ytdlpDownloadPath,
					"",
					"linux",
					true
				);
			}
		} catch (error) {
			// Downloading full binary of python3 is not there
			await YTDlpWrap.downloadFromGithub(
				ytdlpDownloadPath,
				"",
				"linux",
				true
			);
		}
	} else {
		// In case of windows/mac
		await YTDlpWrap.downloadFromGithub(ytdlpDownloadPath);
	}

	getId("popupBox").style.display = "none";
	ytDlp = ytdlpPath;
	ytdlp = new YTDlpWrap(ytDlp);
	localStorage.setItem("ytdlp", ytDlp);
	getId("pasteUrl").style.display = "inline-block";
	console.log("yt-dlp bin Path: " + ytDlp);
}

// Checking if yt-dlp has been installed by user
cp.exec("yt-dlp --version", (error, stdout, stderr) => {
	if (error) {
		// Checking if yt-dlp has been installed by program
		cp.exec(`${ytdlpPath} --version`, (error, stdout, stderr) => {
			if (error) {
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
				ytdlp = new YTDlpWrap(ytDlp);
				localStorage.setItem("ytdlp", ytDlp);
				cp.spawn(`${ytDlp}`, ["-U"]).stdout.on("data", (data) =>
					console.log(data.toString("utf8"))
				);
				getId("pasteUrl").style.display = "inline-block";
				console.log("yt-dlp bin Path: " + ytDlp);

				ipcRenderer.send("ready-for-links");
			}
		});
	} else {
		console.log("yt-dlp binary is present in PATH");
		ytDlp = "yt-dlp";
		ytdlp = new YTDlpWrap(ytDlp);
		localStorage.setItem("ytdlp", ytDlp);
		getId("pasteUrl").style.display = "inline-block";
		console.log("yt-dlp bin Path: " + ytDlp);
		ipcRenderer.send("ready-for-links");
	}
});

function defaultVideoToggle() {
	videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	audioToggle.style.backgroundColor = "var(--box-toggle)";
	getId("audioList").style.display = "none";
	getId("videoList").style.display = "block";
}

// Pasting url from clipboard

function pasteUrl() {
	defaultVideoToggle();
	getId("hidden").style.display = "none";
	getId("loadingWrapper").style.display = "flex";
	getId("incorrectMsg").textContent = "";
	const url = clipboard.readText();
	getInfo(url);
}

function pasteFromTray(url) {
	defaultVideoToggle();
	getId("hidden").style.display = "none";
	getId("loadingWrapper").style.display = "flex";
	getId("incorrectMsg").textContent = "";
	getInfo(url);
}

getId("closeHidden").addEventListener("click", () => {
	getId("hidden").style.display = "none";
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
	let selected = false;
	onlyvideo = false;
	let audioIsPresent = false;
	downloadPathSelection();
	getId("videoFormatSelect").innerHTML = "";
	getId("audioFormatSelect").innerHTML = "";
	getId("startTime").value = "";
	getId("endTime").value = "";
	if (localStorage.getItem("preferredVideoQuality")) {
		preferredVideoQuality = localStorage.getItem("preferredVideoQuality");
	}
	if (localStorage.getItem("preferredAudioQuality")) {
		preferredAudioQuality = localStorage.getItem("preferredAudioQuality");
		getId("extractSelection").value = preferredAudioQuality;
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
		ytDlp,
		[
			"-j",
			"--no-playlist",
			"--no-warnings",
			cookieArg,
			browser,
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
		console.log(error.toString("utf8"));
		getId("loadingWrapper").style.display = "none";
		getId("incorrectMsg").textContent = i18n.__(
			"Some error has occurred. Check your network and use correct URL"
		);
	});

	infoProcess.on("close", () => {
		if (validInfo) {
			info = JSON.parse(info);
			console.log(info);

			title = info.title;
			id = info.id;
			thumbnail = info.thumbnail;
			duration = info.duration;
			const formats = info.formats;
			console.log(formats);

			const urlElements = document.querySelectorAll(".url");

			urlElements.forEach((element) => {
				element.value = url;
			});

			getId("loadingWrapper").style.display = "none";
			getId("hidden").style.display = "inline-block";
			getId("title").innerHTML = `<b>${i18n.__("Title ")}</b>: ` + title;
			getId("videoList").style.display = "block";
			videoToggle.style.backgroundColor = "rgb(67, 212, 164)";

			let audioSize = 0;
			let defaultVideoFormat = 0;

			// Getting approx size of audio file and checking if audio is present
			for (let format of formats) {
				// Find the item with the preferred video format
				if (
					format.height <= preferredVideoQuality &&
					format.height > defaultVideoFormat &&
					format.video_ext !== "none"
				) {
					defaultVideoFormat = format.height;
				}

				if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext === "none")
				) {
					audioIsPresent = true;
					onlyvideo = true;
					audioSize =
						Number(format.filesize || format.filesize_approx) /
						1000000;
				}
			}
			for (let format of formats) {
				let size;
				let selectedText = "";
				if (format.height == defaultVideoFormat && !selected) {
					selectedText = " selected ";
					selected = true;
				}

				if (format.filesize || format.filesize_approx) {
					size = (
						Number(format.filesize || format.filesize_approx) /
						1000000
					).toFixed(2);
				} else {
					size = i18n.__("Unknown size");
				}

				// For videos

				if (
					format.video_ext !== "none" &&
					format.audio_ext === "none"
				) {
					if (size !== "Unknown size") {
						size = (Number(size) + 0 || Number(audioSize)).toFixed(
							2
						);
						size = size + " " + i18n.__("MB");
					}

					const format_id =
						format.format_id +
						"|" +
						format.ext +
						"|" +
						(format.height || "NO");

					const element =
						"<option value='" +
						format_id +
						"'" +
						selectedText +
						">" +
						(format.height
							? format.height +
							  "p" +
							  (format.fps == 60 ? "60" : "")
							: "" ||
							  format.resolution ||
							  i18n.__(format.format_note) ||
							  format.format_id ||
							  "Unknown quality") +
						"  |  " +
						format.ext +
						"  |  " +
						size +
						"</option>";
					getId("videoFormatSelect").innerHTML += element;
				}

				// For audios
				else if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext === "none")
				) {
					size = size + " MB";
					let audio_ext;

					if (format.audio_ext === "webm") {
						audio_ext = "opus";
					} else {
						audio_ext = format.audio_ext;
					}

					const format_id = format.format_id + "|" + audio_ext;

					const element =
						"<option value='" +
						format_id +
						"'>" +
						i18n.__("Quality") +
						": " +
						(i18n.__(format.format_note) ||
							i18n.__("Unknown quality")) +
						" | " +
						audio_ext +
						" | " +
						size +
						"</option>";
					getId("audioFormatSelect").innerHTML += element;
				}
				// Both audio and video available
				else if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext !== "none")
				) {
					let size;
					if (format.filesize || format.filesize_approx) {
						size = (
							Number(format.filesize || format.filesize_approx) /
							1000000
						).toFixed(2);
					} else {
						size = i18n.__("Unknown size");
					}
					const element =
						"<option value='" +
						(format.format_id + "|" + format.ext) +
						"'>" +
						(i18n.__(format.format_note) ||
							format.resolution ||
							i18n.__("Unknown quality")) +
						"  |  " +
						format.ext +
						"  |  " +
						size +
						" " +
						i18n.__("MB") +
						"</option>";
					getId("videoFormatSelect").innerHTML += element;
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
	getId("hidden").style.display = "none";
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
		const thumb1 = thumbnail
		const title1 = title

		const randId = Math.random().toFixed(10).toString().slice(2);
		const item = `
		<div class="item" id="${randId}">
			<img src="${thumbnail}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">

			<div class="itemBody">
				<div class="itemTitle">${title}</div>
				<div class="itemType">${i18n.__("Video")}</div>
				<p>${i18n.__("Download pending")}</p>
			</div>
		</div>
		`;
		getId("list").innerHTML += item;
		const interval = setInterval(() => {
			if (currentDownloads < maxActiveDownloads) {
				getId(randId).remove();
				download("video", url1, range1, range2, subs1, subs2, thumb1, title1);
				currentDownloads++;
				clearInterval(interval);
			}
		}, 2000);
	}
});

// Audio download event
getId("audioDownload").addEventListener("click", (event) => {
	checkMaxDownloads();
	getId("hidden").style.display = "none";
	console.log(`Current:${currentDownloads} Max:${maxActiveDownloads}`);

	if (currentDownloads < maxActiveDownloads) {
		manageAdvanced();
		download("audio");
		currentDownloads++;
	} else {
		manageAdvanced();
		// Handling active downloads for audio
		manageAdvanced(duration);
		const range1 = rangeOption;
		const range2 = rangeCmd;
		const subs1 = subs;
		const subs2 = subLangs;
		const url1 = getId("url").value;
		const thumb1 = thumbnail
		const title1 = title

		const randId = Math.random().toFixed(10).toString().slice(2);

		const item = `
		
		<div class="item" id="${randId}">
			<img src="${thumbnail}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">

			<div class="itemBody">
				<div class="itemTitle">${title}</div>
				<div class="itemType">${i18n.__("Video")}</div>
				<p>${i18n.__("Download pending")}</p>
			</div>
		</div>
		`;
		getId("list").innerHTML += item;
		const interval = setInterval(() => {
			if (currentDownloads < maxActiveDownloads) {
				getId(randId).remove();
				download("audio", url1, range1, range2, subs1, subs2, thumb1, title1);
				currentDownloads++;
				clearInterval(interval);
			}
		}, 2000);
	}
});

getId("extractBtn").addEventListener("click", () => {
	checkMaxDownloads();
	getId("hidden").style.display = "none";
	extractFormat = getId("extractSelection").value;

	console.log(`Current:${currentDownloads} Max:${maxActiveDownloads}`);

	if (currentDownloads < maxActiveDownloads) {
		manageAdvanced();
		download("extract");
		currentDownloads++;
	} else {
		manageAdvanced();
		// Handling active downloads for extracting audio
		manageAdvanced(duration);
		const range1 = rangeOption;
		const range2 = rangeCmd;
		const subs1 = subs;
		const subs2 = subLangs;
		const url1 = getId("url").value;
		const randId = Math.random().toFixed(10).toString().slice(2);
		const thumb1 = thumbnail
		const title1 = title

		const item = `
		<div class="item" id="${randId}">
			<img src="${thumbnail}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">

			<div class="itemBody">
				<div class="itemTitle">${title}</div>
				<div class="itemType">${i18n.__("Video")}</div>
				<p>${i18n.__("Download pending")}</p>
			</div>
		</div>
		`;
		getId("list").innerHTML += item;
		const interval = setInterval(() => {
			if (currentDownloads < maxActiveDownloads) {
				getId(randId).remove();
				download("extract", url1, range1, range2, subs1, subs2, thumb1, title1);
				currentDownloads++;
				clearInterval(interval);
			}
		}, 2000);
	}
});

// Restore previous uncompleted downloads

// function restorePrevious() {
// 	if (!localStorage.getItem("itemList")) return;
// 	const items = JSON.parse(localStorage.getItem("itemList"));
// 	if (items) {
// 		console.log(items);
// 		items.forEach((item) => {
// 			const newItem = `
// 			<div class="item" id="${item.id}">
// 			<img src="../assets/images/close.png" onClick="fadeItem('${
// 				item.id
// 			}')" class="itemClose"}" id="${item.id + ".close"}">
// 			<img src="${item.thumbnail}" alt="thumbnail" class="itemIcon">

// 			<div class="itemBody">
// 				<div class="itemTitle">${item.title}</div>
// 				<div class="itemType">${item.type}</div>
// 				<input disabled type="range" value="0" class="hiddenVideoProgress" id="${
// 					item.id + "vid"
// 				}"></input>
// 				<input disabled type="range" value="0" class="hiddenAudioProgress" id="${
// 					item.id + "aud"
// 				}"></input>
// 				<div id="${item.id + "prog"}" class="itemProgress">Progress: ${
// 				item.progress
// 			}%</div>
// 				<button class="resumeBtn">Resume</button>
// 			</div>
// 		</div>
// 		`;
// 			getId("list").innerHTML += newItem;
// 		});
// 	}
// }

// restorePrevious()

// Time formatting

function timeFormat(duration) {
	// Hours, minutes and seconds
	var hrs = ~~(duration / 3600);
	var mins = ~~((duration % 3600) / 60);
	var secs = ~~duration % 60;
	// Ouput like "1:01" or "4:03:59" or "123:03:59"
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
	title1 = ""
) {
	// Config file
	const newTitle = title1 || title
	let configArg = "";
	let configTxt = "";
	if (localStorage.getItem("configPath")) {
		configArg = "--config-location";
		configTxt = `"${localStorage.getItem("configPath")}"`;
	}

	const url = url1 || getId("url").value;
	console.log("URL", url)
	let ext;
	let extractExt;

	let format_id;
	const randomId = "a" + Math.random().toFixed(10).toString().slice(2);

	if (type === "video") {
		const videoValue = getId("videoFormatSelect").value;
		format_id = videoValue.split("|")[0];
		ext = videoValue.split("|")[1];
		if (videoValue.split("|")[2] != "NO") {
			preferredVideoQuality = Number(videoValue.split("|")[2]);
		}
	} else if (type === "audio") {
		format_id = getId("audioFormatSelect").value.split("|")[0];
		if (getId("audioFormatSelect").value.split("|")[1] === "webm") {
			ext = "opus";
		} else {
			ext = getId("audioFormatSelect").value.split("|")[1];
		}
	}

	// localStorage.setItem("itemList", "");
	// let itemList = [];
	// if (localStorage.getItem("itemList")) {
	// 	itemList = JSON.parse(localStorage.getItem("itemList"));
	// }
	// const itemInfo = {
	// 	id: randomId,
	// 	format_id: format_id,
	// 	title: title,
	// 	url: url,
	// 	ext: ext,
	// 	type: type,
	// 	thumbnail: thumbnail,
	// };
	// itemList.push(itemInfo);
	// localStorage.setItem("itemList", JSON.stringify(itemList));

	const newItem = `
		<div class="item" id="${randomId}">
		<img src="../assets/images/close.png" onClick="fadeItem('${randomId}')" class="itemClose"}" id="${
		randomId + ".close"
	}">
		<img src="${thumb1 || thumbnail}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">

		<div class="itemBody">
			<div class="itemTitle">${newTitle}</div>
			<div class="itemType">${
				type === "video" ? i18n.__("Video") : i18n.__("Audio")
			}</div>
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
		pattern = ["[", "]", "*", "<", ">", "|", "\\", "/", "?", '"', "`", "#"];
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
	console.log("Filename:", filename);

	let audioFormat;

	if (ext === "mp4") {
		audioFormat = "m4a";
	} else {
		audioFormat = "ba";
	}

	const controller = new AbortController();
	controllers[randomId] = controller;

	console.log(rangeOption + " " + rangeCmd);

	if (type === "video" && onlyvideo) {
		// If video has no sound, audio needs to be downloaded
		console.log("Downloading both video and audio");

		downloadProcess = ytdlp.exec(
			[
				range1 || rangeOption,
				range2 || rangeCmd,
				"-f",
				`${format_id}+${audioFormat}`,
				"-o",
				`"${path.join(downloadDir, filename + `.${ext}`)}"`,
				"--ffmpeg-location",
				ffmpeg,
				subs1 || subs,
				subs2 || subLangs,
				"--no-playlist",
				configArg,
				configTxt,
				cookieArg,
				browser,
				`"${url}"`,
			],
			{ shell: true, detached: false },
			controller.signal
		);
	} else if (type === "extract") {
		if (extractFormat == "alac") {
			extractExt = "m4a";
		} else if (extractFormat == "vorbis") {
			extractExt = "ogg";
		} else {
			extractExt = extractFormat;
		}
		downloadProcess = ytdlp.exec(
			[
				"-x",
				"--audio-format",
				extractFormat,
				"-o",
				`"${path.join(downloadDir, filename + `.${extractExt}`)}"`,
				"--ffmpeg-location",
				ffmpeg,
				"--no-playlist",
				cookieArg,
				browser,
				configArg,
				configTxt,
				`"${url}"`,
			],
			{ shell: true, detached: false },
			controller.signal
		);
	}
	// If downloading only audio or video with audio
	else {
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
				cookieArg,
				browser,
				configArg,
				configTxt,
				`"${url}"`,
			],
			{ shell: true, detached: false },
			controller.signal
		);
	}

	getId(randomId + ".close").addEventListener("click", () => {
		controller.abort();
	});

	downloadProcess
		.on("progress", (progress) => {
			if (progress.percent == 100) {
				getId(randomId + "prog").textContent =
					i18n.__("Processing") + "...";
			} else {
				getId(randomId + "prog").textContent = `${i18n.__(
					"Progress"
				)}: ${progress.percent}%  ${i18n.__("Speed")}: ${
					progress.currentSpeed || 0
				}`;
			}

			// const items = JSON.parse(localStorage.getItem("itemList"));
			// // Clearing item from localstorage
			// for (let item of items) {
			// 	if (item.id == randomId) {
			// 		item.progress = progress.percent;
			// 		break;
			// 	}
			// }
			// localStorage.setItem("itemList", JSON.stringify(items));
		})
		.once("ytDlpEvent", (eventType, eventData) => {
			getId(randomId + "prog").textContent = i18n.__("Downloading...");
		})
		.once("close", (code) => {
			currentDownloads--;
			console.log("Closed with code " + code);
			if (code == 0) {
				// const items = JSON.parse(localStorage.getItem("itemList"));
				// // Clearing item from localstorage
				// for (let item of items) {
				// 	if (item.id == randomId) {
				// 		items.splice(items.indexOf(item), 1);
				// 		break;
				// 	}
				// }
				// localStorage.setItem("itemList", JSON.stringify(items));

				// If extration is done
				if (type === "extract") {
					console.log(
						path.join(downloadDir, filename + `.${extractFormat}`)
					);

					afterSave(
						downloadDir,
						filename + `.${extractExt}`,
						randomId + "prog"
					);
				}
				// If download is done
				else {
					console.log(path.join(downloadDir, filename + `.${ext}`));
					afterSave(
						downloadDir,
						filename + `.${ext}`,
						randomId + "prog"
					);
				}
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

// Removing item

function fadeItem(id) {
	controllers[id].abort();
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			clearInterval(fade);
			if (getId(id)) {
				getId(id).remove();
			}
		} else {
			opacity -= 0.1;
			getId(id).style.opacity = opacity;
			count++;
		}
	}, 50);
}

// After saving video

function afterSave(location, filename, progressId) {
	const notify = new Notification("ytDownloader", {
		body: i18n.__("File saved. Click to Open"),
		icon: "../assets/images/icon.png",
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

// Opening windows
function closeMenu() {
	getId("menuIcon").style.transform = "rotate(0deg)";
	menuIsOpen = false;
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			clearInterval(fade);
			getId("menu").style.display = "none";
		} else {
			opacity -= 0.1;
			getId("menu").style.opacity = opacity;
			count++;
		}
	}, 50);
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

ipcRenderer.on("link", (event, text) => {
	pasteFromTray(text);
});
