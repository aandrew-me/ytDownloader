const {clipboard, shell, ipcRenderer} = require("electron");
const {default: YTDlpWrap} = require("yt-dlp-wrap-plus");
const path = require("path");
const os = require("os");
const fs = require("fs");
const {execSync} = require("child_process");
const {constants} = require("fs/promises");
let url;
const ytDlp = localStorage.getItem("ytdlp");
console.log(`yt-dlp: ${ytDlp}`);
const ytdlp = new YTDlpWrap(`"${ytDlp}"`);
const downloadsDir = path.join(os.homedir(), "Downloads");
let downloadDir = localStorage.getItem("downloadPath") || downloadsDir;


document.addEventListener("translations-loaded", () => {
	window.i18n.translatePage();
});

try {
	fs.accessSync(downloadDir, constants.W_OK);
	downloadDir = downloadDir;
} catch (err) {
	console.log(
		"Unable to write to download directory. Switching to default one."
	);
	console.log("Err:", err);
	downloadDir = downloadsDir;
	localStorage.setItem("downloadPath", downloadsDir);
}

getId("path").textContent = downloadDir;
let cookieArg = "";
let browser = "";
const formats = {
	144: 160,
	240: 133,
	360: 134,
	480: 135,
	720: 136,
	1080: 299,
	1440: 400,
	2160: 401,
	4320: 571,
};
let originalCount = 0;
let ffmpeg;
let ffmpegPath;

if (os.platform() === "win32") {
	ffmpegPath = `${__dirname}\\..\\ffmpeg.exe`;
} else if (os.platform() === "freebsd") {
	try {
		ffmpegPath = execSync("which ffmpeg")
			.toString("utf8")
			.split("\n")[0]
			.trim();
	} catch (error) {
		console.log(error);
	}
} else {
	ffmpegPath = `${__dirname}/../ffmpeg`;
}

if (process.env.YTDOWNLOADER_FFMPEG_PATH) {
	ffmpegPath = `${process.env.YTDOWNLOADER_FFMPEG_PATH}`;

	if (fs.existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)) {
		console.log("Using YTDOWNLOADER_FFMPEG_PATH");
	} else {
		console.error("No ffmpeg found in " + ffmpeg);
	}
}

ffmpeg = `"${ffmpegPath}"`;

console.log("ffmpeg:", ffmpeg);

if (localStorage.getItem("preferredVideoQuality")) {
	const preferredVideoQuality = localStorage.getItem("preferredVideoQuality");
	getId("select").value = preferredVideoQuality;
}
if (localStorage.getItem("preferredAudioQuality")) {
	const preferredAudioQuality = localStorage.getItem("preferredAudioQuality");
	getId("audioSelect").value = preferredAudioQuality;
}

let foldernameFormat = "%(playlist_title)s";
let filenameFormat = "%(playlist_index)s.%(title)s.%(ext)s";
let playlistIndex = 1;
let playlistEnd = "";
let proxy = "";

/**
 *
 * @param {string} id
 * @returns {any}
 */
function getId(id) {
	return document.getElementById(id);
}

function pasteLink() {
	url = clipboard.readText();
	getId("link").textContent = " " + url;
	getId("options").style.display = "block";
	getId("incorrectMsgPlaylist").textContent = "";
	getId("errorBtn").style.display = "none";
}

getId("pasteLink").addEventListener("click", () => {
	pasteLink();
});

document.addEventListener("keydown", (event) => {
	if (event.ctrlKey && event.key == "v") {
		pasteLink();
	}
});

// Patterns
const playlistTxt = "Downloading playlist: ";
const videoIndex = "Downloading item ";
const oldVideoIndex = "Downloading video ";

/**
 * @param {string} type
 */
function download(type) {
	// Config file
	let configArg = "";
	let configTxt = "";
	if (localStorage.getItem("configPath")) {
		configArg = "--config-location";
		configTxt = `"${localStorage.getItem("configPath")}"`;
	}
	proxy = localStorage.getItem("proxy") || "";
	console.log("Proxy:", proxy);

	nameFormatting();
	originalCount = 0;

	// Playlist download range
	managePlaylistRange();

	// Whether to use browser cookies or not
	if (localStorage.getItem("browser")) {
		browser = localStorage.getItem("browser");
	}
	if (browser) {
		cookieArg = "--cookies-from-browser";
	} else {
		cookieArg = "";
	}
	let count = 0;
	let subs, subLangs;
	let playlistName;

	// If subtitles are checked
	if (getId("subChecked").checked) {
		subs = "--write-subs";
		subLangs = "--sub-langs all";
		console.log("Downloading with subtitles");
	} else {
		subs = "";
		subLangs = "";
	}

	hideOptions();

	let quality, format, downloadProcess, videoType, audioQuality;
	if (type === "video") {
		quality = getId("select").value;
		videoType = getId("videoTypeSelect").value;
		const formatId = formats[quality];
		if (quality === "best") {
			format = "-f bv*+ba/best";
		} else if (quality === "worst") {
			format = "-f wv+wa/worst";
		} else if (quality === "useConfig") {
			format = "";
		} else {
			if (videoType === "mp4") {
				format = `-f "bestvideo[height<=1080]+bestaudio[ext=m4a]/best[height<=1080]/best" --merge-output-format "mp4" --recode-video "mp4"`;
			} else if (videoType === "webm") {
				format = `-f "bestvideo[height<=1080]+bestaudio[ext=webm]/best[height<=1080]/best" --merge-output-format "webm" --recode-video "webm"`;
			} else {
				format = `-f "bv*[height=${quality}]+ba/best[height=${quality}]/best[height<=${quality}]"`;
			}
		}
	} else {
		format = getId("audioSelect").value;
		audioQuality = getId("audioQualitySelect").value;
		console.log("Quality:", audioQuality);
	}
	console.log("Format:", format);

	const controller = new AbortController();

	if (type === "video") {
		const args = [
			format,
			"--yes-playlist",
			"-o",
			`"${path.join(downloadDir, foldernameFormat, filenameFormat)}"`,
			"-I",
			`"${playlistIndex}:${playlistEnd}"`,
			"--ffmpeg-location",
			ffmpeg,
			cookieArg,
			browser,
			configArg,
			configTxt,
			"--embed-metadata",
			subs,
			subLangs,
			videoType == "mp4" &&
			(url.includes("youtube.com/") || url.includes("youtu.be/")) &&
			os.platform() !== "darwin"
				? "--embed-thumbnail"
				: "",
			proxy ? "--no-check-certificate" : "",
			proxy ? "--proxy" : "",
			proxy,
			"--compat-options",
			"no-youtube-unavailable-videos",
			`"${url}"`,
		].filter((item) => item);

		downloadProcess = ytdlp.exec(
			args,
			{shell: true, detached: false},
			controller.signal
		);
	} else {
		// Youtube provides m4a as audio, so no need to convert
		if (
			(url.includes("youtube.com/") || url.includes("youtu.be/")) &&
			format === "m4a" &&
			audioQuality === "auto"
		) {
			console.log("Downloading m4a without extracting");

			const args = [
				"--yes-playlist",
				"--no-warnings",
				"-f",
				`ba[ext=${format}]/ba`,
				"-o",
				`"${path.join(downloadDir, foldernameFormat, filenameFormat)}"`,
				"-I",
				`"${playlistIndex}:${playlistEnd}"`,
				"--ffmpeg-location",
				ffmpeg,
				cookieArg,
				browser,
				configArg,
				configTxt,
				"--embed-metadata",
				subs,
				subLangs,
				os.platform() !== "darwin" ? "--embed-thumbnail" : "",
				proxy ? "--no-check-certificate" : "",
				proxy ? "--proxy" : "",
				proxy,
				"--compat-options",
				"no-youtube-unavailable-videos",
				`"${url}"`,
			].filter((item) => item);

			downloadProcess = ytdlp.exec(
				args,
				{shell: true, detached: false},
				controller.signal
			);
		} else {
			console.log("Extracting audio");

			const args = [
				"--yes-playlist",
				"--no-warnings",
				"-x",
				"--audio-format",
				format,
				"--audio-quality",
				audioQuality,
				"-o",
				`"${path.join(downloadDir, foldernameFormat, filenameFormat)}"`,
				"-I",
				`"${playlistIndex}:${playlistEnd}"`,
				"--ffmpeg-location",
				ffmpeg,
				cookieArg,
				browser,
				configArg,
				configTxt,
				"--embed-metadata",
				subs,
				subLangs,
				format === "mp3" ||
				(format === "m4a" &&
					(url.includes("youtube.com/") ||
						url.includes("youtu.be/")) &&
					os.platform() !== "darwin")
					? "--embed-thumbnail"
					: "",
				proxy ? "--no-check-certificate" : "",
				proxy ? "--proxy" : "",
				proxy,
				"--compat-options",
				"no-youtube-unavailable-videos",
				`"${url}"`,
			].filter((item) => item);

			downloadProcess = ytdlp.exec(
				args,
				{shell: true, detached: false},
				controller.signal
			);
		}
	}

	// getId("finishBtn").addEventListener("click", () => {
	// 	controller.abort("user_finished")
	// 	try {
	// 		process.kill(downloadProcess.ytDlpProcess.pid, 'SIGINT')
	// 	} catch (_error) {}
	// })

	downloadProcess.on("ytDlpEvent", (_eventType, eventData) => {
		// console.log(eventData);

		if (eventData.includes(playlistTxt)) {
			playlistName = eventData.split("playlist:")[1].slice(1);
			getId("playlistName").textContent =
				i18n.__("Downloading playlist:") + " " + playlistName;
			console.log(playlistName);
		}

		if (
			(eventData.includes(videoIndex) ||
				eventData.includes(oldVideoIndex)) &&
			!eventData.includes("thumbnail")
		) {
			count += 1;
			originalCount += 1;
			let itemTitle;
			if (type === "video") {
				itemTitle = i18n.__("Video") + " " + originalCount;
			} else {
				itemTitle = i18n.__("Audio") + " " + originalCount;
			}

			if (count > 1) {
				getId(`p${count - 1}`).textContent = i18n.__("File saved.");
			}

			const item = `<div class="playlistItem">
			<p class="itemTitle">${itemTitle}</p>
			<p class="itemProgress" id="p${count}">${i18n.__("Downloading...")}</p>
			</div>`;
			getId("list").innerHTML += item;

			window.scrollTo(0, document.body.scrollHeight);
		}
	});

	downloadProcess.on("progress", (progress) => {
		if (progress.percent == 100) {
			if (getId(`p${count}`)) {
				getId(`p${count}`).textContent = i18n.__("Processing") + "...";
			}
		} else {
			if (getId(`p${count}`)) {
				getId(`p${count}`).textContent = `${i18n.__("Progress")} ${
					progress.percent
				}% | ${i18n.__("Speed")} ${progress.currentSpeed || 0}`;
			}
		}
	});

	downloadProcess.on("error", (error) => {
		showErrorTxt(error);
	});

	downloadProcess.on("close", () => {
		afterClose(count);
	});
}

function managePlaylistRange() {
	if (getId("playlistIndex").value) {
		playlistIndex = Number(getId("playlistIndex").value);
	}
	if (getId("playlistEnd").value) {
		playlistEnd = getId("playlistEnd").value;
	}
	console.log(`Range: ${playlistIndex}:${playlistEnd}`);
	if (playlistIndex > 0) {
		originalCount = playlistIndex - 1;
		console.log(`Starting download from ${originalCount + 1}`);
	}
}

function afterClose(count) {
	getId(`p${count}`).textContent = i18n.__("File saved.");
	getId("pasteLink").style.display = "inline-block";

	const notify = new Notification("ytDownloader", {
		body: i18n.__("Playlist downloaded"),
		icon: "../assets/images/icon.png",
	});

	notify.onclick = () => {
		openFolder(downloadDir);
	};
}
// Error handling
function showErrorTxt(error) {
	console.log("Error " + error);
	getId("pasteLink").style.display = "inline-block";
	getId("openDownloads").style.display = "none";
	getId("options").style.display = "block";
	getId("playlistName").textContent = "";
	getId("incorrectMsgPlaylist").textContent = i18n.__(
		"Some error has occurred. Check your network and use correct URL"
	);
	getId("incorrectMsgPlaylist").style.display = "block";
	getId("incorrectMsgPlaylist").title = error;
	getId("errorBtn").style.display = "inline-block";
	getId("errorDetails").innerHTML = `
	<strong>URL: ${url}</strong>
	<br><br>
	${error}
	`;
	getId("errorDetails").title = i18n.__("Click to copy");
}

// File and folder name patterns
function nameFormatting() {
	// Handling folder and file names
	if (localStorage.getItem("foldernameFormat")) {
		foldernameFormat = localStorage.getItem("foldernameFormat");
	}
	if (localStorage.getItem("filenameFormat")) {
		filenameFormat = localStorage.getItem("filenameFormat");
	}
}

function hideOptions(justHide = false) {
	getId("options").style.display = "none";
	getId("list").innerHTML = "";
	getId("errorBtn").style.display = "none";
	getId("errorDetails").style.display = "none";
	getId("errorDetails").textContent = "";
	getId("incorrectMsgPlaylist").style.display = "none";
	if (!justHide) {
		getId("playlistName").textContent = i18n.__("Processing") + "...";
		getId("pasteLink").style.display = "none";
		getId("openDownloads").style.display = "inline-block";
	}
}

function downloadThumbnails() {
	let count = 0;
	let playlistName;
	hideOptions();
	nameFormatting();
	managePlaylistRange();

	const args = [
		"--yes-playlist",
		"--no-warnings",
		"-o",
		`"${path.join(downloadDir, foldernameFormat, filenameFormat)}"`,
		cookieArg,
		browser,
		"--write-thumbnail",
		"--convert-thumbnails png",
		"--skip-download",
		"-I",
		`"${playlistIndex}:${playlistEnd}"`,
		"--ffmpeg-location",
		ffmpeg,
		proxy ? "--no-check-certificate" : "",
		proxy ? "--proxy" : "",
		proxy,
		"--compat-options",
		"no-youtube-unavailable-videos",
		`"${url}"`,
	].filter((item) => item);

	const downloadProcess = ytdlp.exec(args, {shell: true, detached: false});

	// console.log(downloadProcess.ytDlpProcess.spawnargs[2])

	downloadProcess.on("ytDlpEvent", (eventType, eventData) => {
		// console.log(eventData);

		if (eventData.includes(playlistTxt)) {
			playlistName = eventData.split("playlist:")[1].slice(1);
			getId("playlistName").textContent =
				i18n.__("Downloading playlist:") + " " + playlistName;
			console.log(playlistName);
		}

		if (
			(eventData.includes(videoIndex) ||
				eventData.includes(oldVideoIndex)) &&
			!eventData.includes("thumbnail")
		) {
			count += 1;
			originalCount++;

			let itemTitle;
			itemTitle = i18n.__("Thumbnail") + " " + originalCount;

			if (count > 1) {
				getId(`p${count - 1}`).textContent = i18n.__("File saved.");
			}

			const item = `<div class="playlistItem">
			<p class="itemTitle">${itemTitle}</p>
			<p class="itemProgress" id="p${count}">${i18n.__("Downloading...")}</p>
			</div>`;
			getId("list").innerHTML += item;

			window.scrollTo(0, document.body.scrollHeight);
		}
	});

	downloadProcess.on("error", (error) => {
		showErrorTxt(error);
	});
	downloadProcess.on("close", () => {
		afterClose(count);
	});
}

// Download video links
function saveLinks() {
	let count = 0;
	let playlistName;
	hideOptions();
	nameFormatting();
	managePlaylistRange();

	const args = [
		"--yes-playlist",
		"--no-warnings",
		cookieArg,
		browser,
		"--skip-download",
		"--print-to-file",
		"webpage_url",
		`"${path.join(downloadDir, foldernameFormat, "links.txt")}"`,
		"--skip-download",
		"-I",
		`"${playlistIndex}:${playlistEnd}"`,
		proxy ? "--no-check-certificate" : "",
		proxy ? "--proxy" : "",
		proxy,
		"--compat-options",
		"no-youtube-unavailable-videos",
		`"${url}"`,
	].filter((item) => item);

	const downloadProcess = ytdlp.exec(args, {shell: true, detached: false});

	downloadProcess.on("ytDlpEvent", (eventType, eventData) => {
		// console.log(eventData);

		if (eventData.includes(playlistTxt)) {
			playlistName = eventData.split("playlist:")[1].slice(1);
			getId("playlistName").textContent =
				i18n.__("Downloading playlist:") + " " + playlistName;
			console.log(playlistName);
		}

		if (
			(eventData.includes(videoIndex) ||
				eventData.includes(oldVideoIndex)) &&
			!eventData.includes("thumbnail")
		) {
			count += 1;
			let itemTitle;
			itemTitle = i18n.__("Link") + " " + count;

			if (count > 1) {
				getId(`p${count - 1}`).textContent = i18n.__("Link added");
			}

			const item = `<div class="playlistItem">
			<p class="itemTitle">${itemTitle}</p>
			<p class="itemProgress" id="p${count}">${i18n.__("Downloading...")}</p>
			</div>`;
			getId("list").innerHTML += item;

			window.scrollTo(0, document.body.scrollHeight);
		}
	});

	downloadProcess.on("close", () => {
		afterClose(count);
	});

	downloadProcess.on("error", (error) => {
		showErrorTxt(error);
	});
}

// Downloading video
getId("download").addEventListener("click", () => {
	download("video");
});

// Downloading audio
getId("audioDownload").addEventListener("click", () => {
	download("audio");
});

// Downloading thumbnails
getId("downloadThumbnails").addEventListener("click", () => {
	downloadThumbnails();
});

// Saving video links to a text file
getId("saveLinks").addEventListener("click", () => {
	saveLinks();
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

function openFolder(location) {
	ipcRenderer.send("open-folder", location);
}

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

// Video and audio toggle
const videoToggle = getId("videoToggle");
const audioToggle = getId("audioToggle");

videoToggle.style.backgroundColor = "var(--box-toggleOn)";

videoToggle.addEventListener("click", (event) => {
	videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	audioToggle.style.backgroundColor = "var(--box-toggle)";
	getId("audioBox").style.display = "none";
	getId("videoBox").style.display = "block";
});

audioToggle.addEventListener("click", (event) => {
	audioToggle.style.backgroundColor = "var(--box-toggleOn)";
	videoToggle.style.backgroundColor = "var(--box-toggle)";
	getId("videoBox").style.display = "none";
	getId("audioBox").style.display = "block";
});

getId("select").addEventListener("change", () => {
	const value = getId("select").value;
	if (value == "best" || value == "worst" || value == "useConfig") {
		getId("typeSelectBox").style.display = "none";
	} else {
		getId("typeSelectBox").style.display = "block";
	}
});

getId("closeHidden").addEventListener("click", () => {
	hideOptions(true);
});

// More options

let moreOptions = true;
getId("advancedToggle").addEventListener("click", () => {
	if (moreOptions) {
		getId("advancedMenu").style.display = "block";
		moreOptions = false;
	} else {
		getId("advancedMenu").style.display = "none";
		moreOptions = true;
	}
});

// Menu
getId("openDownloads").addEventListener("click", () => {
	openFolder(downloadDir);
});

getId("preferenceWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + "/preferences.html");
});

getId("aboutWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + "/about.html");
});

getId("historyWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + "/history.html");
});

getId("homeWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-win", __dirname + "/index.html");
});

getId("compressorWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-win", __dirname + "/compressor.html");
});
