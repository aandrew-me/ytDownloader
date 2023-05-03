const { clipboard, shell, ipcRenderer } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-plus");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");
let url;
const ytDlp = localStorage.getItem("ytdlp");
const ytdlp = new YTDlpWrap(ytDlp);
let downloadDir = localStorage.getItem("downloadPath");
getId("path").textContent = downloadDir;
const i18n = new (require("../translations/i18n"))();
let cookieArg = "";
let browser = "";
const formats = {
	144: 160,
	240: 133,
	360: 134,
	480: 135,
	720: 136,
	1080: 137,
	1440: 400,
	2160: 401,
	4320: 571,
};
let originalCount = 0;
let ffmpeg;
let ffmpegPath;
if (os.platform() === "win32") {
	ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
	ffmpegPath = `${__dirname}\\..\\ffmpeg.exe`;
} else {
	ffmpeg = `"${__dirname}/../ffmpeg"`;
	ffmpegPath = `${__dirname}/../ffmpeg`;
}

if (!fs.existsSync(ffmpegPath)) {
	try {
		ffmpeg = execSync("which ffmpeg", { encoding: "utf8" });
		ffmpeg = `"${ffmpeg.trimEnd()}"`;
	} catch (error) {
		console.log(error);
	}
}
console.log("ffmpeg:", ffmpeg);

let foldernameFormat = "%(playlist_title)s";
let filenameFormat = "%(playlist_index)s.%(title)s.%(ext)s";
let playlistIndex = 1;
let playlistEnd = "";

function getId(id) {
	return document.getElementById(id);
}

function pasteLink() {
	url = clipboard.readText();
	getId("link").textContent = " " + url;
	getId("options").style.display = "block";
	getId("incorrectMsg").textContent = "";
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

function download(type) {
	// Config file
	let configArg = "";
	let configTxt = "";
	if (localStorage.getItem("configPath")) {
		configArg = "--config-location";
		configTxt = `"${localStorage.getItem("configPath")}"`;
	}
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
	let playlistName;

	hideOptions();

	let quality, format, downloadProcess;
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
			if (videoType === "mp4"){
				format = `-f "${formatId}+m4a/mp4[height=${quality}]+m4a/bv*[height<=${quality}]+ba/best[height<=${quality}]"`;
			}
			else if (videoType === "webm"){
				format = `-f "webm[height<=${quality}]+opus/bv*[height<=${quality}]+ba/${formatId}+m4a/mp4[height=${quality}]+m4a/best[height<=${quality}]"`;
			} else {
				format = `-f "bv*[height=${quality}]+ba/best[height=${quality}]/best[height<=${quality}]"`
			}
		}
	} else {
		format = getId("audioSelect").value;
	}
	console.log("Format:", format);

	const controller = new AbortController();

	if (type === "video") {
		downloadProcess = ytdlp.exec(
			[
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
				`"${url}"`,
			],
			{ shell: true, detached: false },
			controller.signal
		);
	} else {
		downloadProcess = ytdlp.exec(
			[
				"--yes-playlist",
				"--no-warnings",
				"-x",
				"--audio-format",
				format,
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
				`"${url}"`,
			],
			{ shell: true, detached: false },
			controller.signal
		);
	}

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
		playlistEnd = Number(getId("playlistEnd").value);
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
	getId("incorrectMsg").textContent = i18n.__(
		"Some error has occurred. Check your network and use correct URL"
	);
	getId("incorrectMsg").title = error;
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

function hideOptions() {
	getId("options").style.display = "none";
	getId("openDownloads").style.display = "inline-block";
	getId("pasteLink").style.display = "none";
	getId("playlistName").textContent = i18n.__("Processing") + "...";
	getId("list").innerHTML = "";
	getId("errorBtn").style.display = "none";
	getId("errorDetails").style.display = "none";
	getId("errorDetails").textContent = "";
}

function downloadThumbnails() {
	let count = 0;
	hideOptions();
	nameFormatting();
	managePlaylistRange();
	const downloadProcess = ytdlp.exec(
		[
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
			`"${url}"`,
		],
		{ shell: true, detached: false }
	);

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
	hideOptions();
	nameFormatting();
	managePlaylistRange();
	const downloadProcess = ytdlp.exec(
		[
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
			`"${url}"`,
		],
		{ shell: true, detached: false }
	);

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
			itemTitle = i18n.__("Link") + " " + originalCount;

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
	ipcRenderer.send("select-location", "");
});

ipcRenderer.on("downloadPath", (event, downloadPath) => {
	console.log(downloadPath);
	getId("path").textContent = downloadPath[0];
	downloadDir = downloadPath[0];
});

function openFolder(location) {
	shell.openPath(location);
}

function closeMenu() {
	getId("menuIcon").style.transform = "rotate(0deg)";
	menuIsOpen = false;
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			clearInterval(fade);
		} else {
			opacity -= 0.1;
			getId("menu").style.opacity = opacity;
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
	value = getId("select").value
	if (value == "best" || value == "worst" || value == "useConfig"){
		getId("typeSelectBox").style.display = "none"
	}
	else {
		getId("typeSelectBox").style.display = "block"
	}
})

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
getId("homeWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-win", __dirname + "/index.html");
});

// Translations
getId("pasteLink").textContent = i18n.__(
	"Click to paste playlist link from clipboard [Ctrl + V]"
);
getId("preferenceWin").textContent = i18n.__("Preferences");
getId("aboutWin").textContent = i18n.__("About");
getId("homeWin").textContent = i18n.__("Homepage");
getId("linkTitle").textContent = i18n.__("Link:");
getId("videoFormat").textContent = i18n.__("Select Video Format ");
getId("audioFormat").textContent = i18n.__("Select Audio Format ");

getId("download").textContent = i18n.__("Download");
getId("audioDownload").textContent = i18n.__("Download");
getId("bestVideoOption").textContent = i18n.__("Best");
getId("worstVideoOption").textContent = i18n.__("Worst");
getId("openDownloads").textContent = i18n.__("Open download folder");
getId("videoToggle").textContent = i18n.__("Video");
getId("audioToggle").textContent = i18n.__("Audio");
getId("advancedToggle").textContent = i18n.__("More options");
getId("rangeTxt").textContent = i18n.__("Playlist range");
getId("playlistIndex").placeholder = i18n.__("Start");
getId("playlistEnd").placeholder = i18n.__("End");
getId("downloadThumbnails").textContent = i18n.__("Download thumbnails");
getId("saveLinks").textContent = i18n.__("Save video links to a file");
getId("useConfigTxt").textContent = i18n.__("Use config file");
getId("errorBtn").textContent = i18n.__("Error Details") + " ▼";
getId("clText").textContent = i18n.__("Current download location - ")
getId("selectLocation").textContent = i18n.__("Select Download Location");
