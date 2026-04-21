const { clipboard, shell, ipcRenderer } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-plus");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync, exec, spawnSync } = require("child_process");
let url;
const ytDlp = localStorage.getItem("ytdlp");
const ytdlp = new YTDlpWrap(ytDlp);
const downloadDir = localStorage.getItem("downloadPath");
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

function sanitizeHttpUrl(value) {
	try {
		const parsedUrl = new URL(value);
		if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
			return parsedUrl.href;
		}
	} catch (error) {}
	return "";
}

function pasteLink() {
	const clipboardText = clipboard.readText();
	getId("loadingWrapper").style.display = "flex";
	getId("incorrectMsg").textContent = "";
	getId("errorBtn").style.display = "none";
	getId("errorDetails").style.display = "none";
	getId("errorDetails").textContent = "";
	exec(
		`${ytDlp} --yes-playlist --no-warnings -J --flat-playlist "${clipboardText}"`,
		(error, stdout, stderr) => {
			if (error) {
				getId("loadingWrapper").style.display = "none";
				getId("incorrectMsg").textContent = i18n.__(
					"Some error has occurred. Check your network and use correct URL"
				);
				getId("errorDetails").textContent = `URL: ${clipboardText}\n\n${error}`;
				getId("errorDetails").title = i18n.__("Click to copy");
				getId("errorBtn").style.display = "inline-block";
			} else {
				const parsed = JSON.parse(stdout);
				console.log(parsed);
				const data = getId("data");
				data.textContent = "";
				// If correct playlist url is used
				if (parsed.entries) {
					const fragment = document.createDocumentFragment();
					parsed.entries.forEach((entry) => {
						console.log(entry)
						const randId = Math.random()
							.toFixed(10)
							.toString()
							.slice(2);

						if (entry.channel) {
							const item = document.createElement("div");
							item.className = "item";
							item.id = randId;

							const image = document.createElement("img");
							let thumbnailUrl = "";
							if (
								entry.thumbnails &&
								entry.thumbnails[3] &&
								entry.thumbnails[3].url
							) {
								thumbnailUrl = sanitizeHttpUrl(entry.thumbnails[3].url);
							}
							if (thumbnailUrl) {
								image.src = thumbnailUrl;
							}
							image.alt = "No thumbnail";
							image.className = "itemIcon";
							image.setAttribute("crossorigin", "anonymous");

							const itemBody = document.createElement("div");
							itemBody.className = "itemBody";

							const itemTitle = document.createElement("div");
							itemTitle.className = "itemTitle";
							itemTitle.textContent = entry.title || "";

							const duration = document.createElement("div");
							duration.textContent = formatTime(entry.duration);

							const checkbox = document.createElement("input");
							checkbox.type = "checkbox";
							checkbox.className = "playlistCheck";
							checkbox.id = `c${randId}`;

							const hiddenLink = document.createElement("input");
							hiddenLink.type = "hidden";
							hiddenLink.id = `link${randId}`;
							hiddenLink.value = entry.url || "";

							itemBody.appendChild(itemTitle);
							itemBody.appendChild(duration);
							itemBody.appendChild(checkbox);
							itemBody.appendChild(hiddenLink);
							item.appendChild(image);
							item.appendChild(itemBody);
							fragment.appendChild(item);
						}
					});
					data.appendChild(fragment);
					getId("loadingWrapper").style.display = "none";
				}
				// If correct playlist url is not used
				else {
					getId("loadingWrapper").style.display = "none";
					getId("incorrectMsg").textContent = i18n.__(
						"Incompatible URL. Please provide a playlist URL"
					);
					getId("errorDetails").textContent = `URL: ${clipboardText}\n\n${stderr}`;
					getId("errorDetails").title = i18n.__("Click to copy");
					getId("errorBtn").style.display = "inline-block";
				}
			}
		}
	);
}

getId("pasteLink").addEventListener("click", (e) => {
	pasteLink();
});

document.addEventListener("keydown", (event) => {
	if (event.ctrlKey && event.key == "v") {
		pasteLink();
	}
});

function formatTime(seconds) {
	let hours = Math.floor(seconds / 3600);
	let minutes = Math.floor((seconds - hours * 3600) / 60);
	seconds = seconds - hours * 3600 - minutes * 60;
	let formattedTime = "";

	if (hours > 0) {
		formattedTime += hours + ":";
	}
	if (minutes < 10 && hours > 0) {
		formattedTime += "0";
	}
	formattedTime += minutes + ":";
	if (seconds < 10) {
		formattedTime += "0";
	}
	formattedTime += seconds;
	return formattedTime;
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
