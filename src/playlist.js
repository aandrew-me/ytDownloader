const { clipboard, shell, ipcRenderer } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-extended");
const path = require("path");
const os = require("os");
const { platform } = require("os");
const { get } = require("http");
let url;
const ytDlp = localStorage.getItem("ytdlp");
const ytdlp = new YTDlpWrap(ytDlp);
const downloadDir = localStorage.getItem("downloadPath");
const i18n = new (require("../translations/i18n"))();
let cookieArg = "";
let browser = "";
let ffmpeg;
if (os.platform() === "win32") {
	ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
} else {
	ffmpeg = `"${__dirname}/../ffmpeg"`;
}

function getId(id) {
	return document.getElementById(id);
}

function pasteLink() {
	url = clipboard.readText();
	getId("link").textContent = " " + url;
	getId("options").style.display = "block";
	getId("incorrectMsg").textContent = "";
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
const playlistIdTxt = " Downloading playlist ";
const videoIndex = "Downloading video ";
let playlistId = "";
let folderLocation;

function download(type) {
	getId("list").innerHTML = "";
	getId("playlistName").textContent = "";

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

	getId("options").style.display = "none";
	getId("openDownloads").style.display = "inline-block"
	getId("pasteLink").style.display = "none";
	getId("playlistName").textContent = i18n.__("Processing") + "...";

	let quality, format, downloadProcess;
	if (type === "video") {
		quality = getId("select").value;
		if (quality === "best") {
			format = "bv*+ba/best";
		} else {
			format = `"mp4[height<=${quality}]+m4a/mp4[height<=${quality}]/bv[height<=${quality}]+ba/best[height<=${quality}]/best"`;
		}
	} else {
		format = getId("audioSelect").value;
	}

	const controller = new AbortController();

	if (type === "video") {
		downloadProcess = ytdlp.exec(
			[
				"-f",
				format,
				"--yes-playlist",
				"-o",
				`"${path.join(
					downloadDir,
					"%(playlist_title)s",
					"%(playlist_index)s.%(title)s.%(ext)s"
				)}"`,
				"--ffmpeg-location",
				ffmpeg,
				cookieArg,
				browser,

				`"${url}"`,
			],
			{ shell: true, detached: false },
			controller.signal
		);
	} else {
		downloadProcess = ytdlp.exec(
			[
				"--yes-playlist",
				"-x",
				"--audio-format",
				format,
				"-o",
				`"${path.join(
					downloadDir,
					"%(playlist_title)s",
					"%(playlist_index)s.%(title)s.%(ext)s"
				)}"`,
				"--ffmpeg-location",
				ffmpeg,
				cookieArg,
				browser,

				`"${url}"`,
			],
			{ shell: true, detached: false },
			controller.signal
		);
	}

	downloadProcess.on("ytDlpEvent", (eventType, eventData) => {
		// console.log(eventData);

		if (eventData.includes(playlistIdTxt)) {
			playlistId = eventData.split(" ")[3].split(";")[0];
			// Opening folder
			if (type === "video") {
				folderLocation = path.join(
					downloadDir
				);
			} else {
				folderLocation = path.join(
					downloadDir
				);
			}
			if (platform() == "win32") {
				folderLocation = folderLocation.split(path.sep).join("\\\\");
			}
			console.log(folderLocation);
		}

		if (eventData.includes(playlistTxt)) {
			playlistName = eventData.split(":")[1].slice(1);
			getId("playlistName").textContent =
				i18n.__("Downloading playlist:") + " " + playlistName;
			console.log(playlistName);
		}

		if (eventData.includes(videoIndex)) {
			count += 1;
			let itemTitle;
			if (type === "video") {
				itemTitle = i18n.__("Video") + " " + eventData.split(" ")[3];
			} else {
				itemTitle = i18n.__("Audio") + " " + eventData.split(" ")[3];
			}

			if (count > 1) {
				getId(`p${count - 1}`).textContent = i18n.__(
					"File saved."
				);
			}

			const item = `<div class="playlistItem">
			<p class="itemTitle">${itemTitle}</p>
			<p class="itemProgress" id="p${count}">${i18n.__(
				"Downloading..."
			)}</p>
			</div>`;
			getId("list").innerHTML += item;

			window.scrollTo(0, document.body.scrollHeight);
		}
	});

	downloadProcess.on("progress", (progress) => {
		if (getId(`p${count}`)) {
			getId(`p${count}`).textContent = `${i18n.__("Progress")} ${
				progress.percent
			}% | ${i18n.__("Speed")} ${progress.currentSpeed || 0}`;
		}
	});

	downloadProcess.on("error", (error) => {
		getId("pasteLink").style.display = "inline-block";
		getId("options").style.display = "block";
		getId("playlistName").textContent = "";
		getId("incorrectMsg").textContent = i18n.__(
			"Some error has occurred. Check your network and use correct URL"
		);
		getId("incorrectMsg").title = error;
	});

	downloadProcess.on("close", () => {
		getId(`p${count}`).textContent = i18n.__("File saved.");
		getId("pasteLink").style.display = "inline-block";
		getId("openDownloads").style.display = "none"


		const notify = new Notification("ytDownloader", {
			body: i18n.__("Playlist downloaded"),
			icon: "../assets/images/icon.png",
		});

		notify.onclick = () => {
			openFolder(folderLocation);
		};
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

getId("openDownloads").addEventListener("click", () => {
	openFolder(downloadDir)
})

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
getId("bestVideoOption").textContent= i18n.__("Best")
