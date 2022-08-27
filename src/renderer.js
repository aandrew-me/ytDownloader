const fs = require("fs");
const ytdl = require("ytdl-core");
const cp = require("child_process");
const os = require("os");
const ffmpeg = require("ffmpeg-static");
const path = require("path");
const { shell, ipcRenderer, clipboard } = require("electron");

// Directories
const homedir = os.homedir();
const appdir = path.join(homedir, "ytDownloader");
const tempDir = path.join(homedir, ".ytDownloader", "temp");
fs.mkdirSync(tempDir, { recursive: true });

// Download directory
let downloadDir = "";

// Global variables
let title, onlyvideo;

function getId(id) {
	return document.getElementById(id);
}

let localPath = localStorage.getItem("downloadPath");

if (localPath) {
	downloadDir = localPath;
} else {
	downloadDir = appdir;
	localStorage.setItem("downloadPath", appdir);
}
fs.mkdir(downloadDir, { recursive: true }, () => {});

// Clearing tempDir
fs.readdirSync(tempDir).forEach((f) =>
	fs.rmdir(`${tempDir}/${f}`, { recursive: true }, () => {})
);

// Collecting info from youtube
// async function getVideoInfo(url) {
// 	let info;
// 	await ytdl
// 		.getInfo(url)
// 		.then((data) => {
// 			info = data;
// 		})
// 		.catch((error) => {
// 			console.log(error);
// 		});
// 	return info;
// }

function defaultVideoToggle() {
	videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	audioToggle.style.backgroundColor = "var(--box-toggle)";
	getId("audioList").style.display = "none";
	getId("videoList").style.display = "block";
}

//! Pasting url from clipboard

function pasteUrl() {
	defaultVideoToggle();
	getId("hidden").style.display = "none";
	getId("loadingWrapper").style.display = "flex";
	getId("incorrectMsg").textContent = "";
	const url = clipboard.readText();
	getInfo(url);
}

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
	getId("videoFormatSelect").innerHTML = "";
	getId("audioFormatSelect").innerHTML = "";
	let info;
	cp.exec(`yt-dlp -j ${url}`, (error, stdout, stderr) => {
		try {
			info = JSON.parse(stdout);
		} catch (error) {
			info = false;
		}

		console.log(info);

		if (info) {
			title = info.title;
			const formats = info.formats;
			console.log(formats);

			const urlElements = document.querySelectorAll(".url");

			urlElements.forEach((element) => {
				element.value = url;
			});

			getId("hidden").style.display = "inline-block";
			getId("title").innerHTML = "<b>Title</b>: " + title;
			getId("videoList").style.display = "block";
			videoToggle.style.backgroundColor = "rgb(67, 212, 164)";

			let highestQualityLength = 0;
			let audioSize = 0;

			// Getting approx size of audio file
			for (let format of formats) {
				if (
					format.audio_ext !== "none" || format.acodec !== "none" &&
					format.video_ext === "none"
				) {
					audioSize =
						Number(format.filesize || format.filesize_approx) /
						1000000;
				}
			}

			for (let format of formats) {
				let size = (
					Number(format.filesize || format.filesize_approx) / 1000000
				).toFixed(2);

				// For videos
				if (
					format.video_ext !== "none" &&
					format.audio_ext === "none"
				) {
					size = (Number(size) + 0 || Number(audioSize)).toFixed(2);
					size = size + " MB";
					const format_id = format.format_id;

					const element =
						"<option value='" +
						format_id +
						"'>" +
						format.resolution +
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
					const format_id = format.format_id;

					if (format.audio_ext === "webm") {
						audio_ext = "opus";
					} else {
						audio_ext = format.audio_ext;
					}

					const element =
						"<option value='" +
						format_id +
						"'>" +
						format.format_note +
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
					let size = (
						Number(format.filesize || format.filesize_approx) /
						1000000
					).toFixed(2);
					console.log("filesize " + format.filesize);
					console.log("filesize_approx " + format.filesize_approx);
					const element =
						"<option value='" +
						format.format_id +
						"'>" +
						format.resolution +
						"  |  " +
						format.ext +
						"  |  " +
						size +
						" MB" +
						"</option>";
					getId("videoFormatSelect").innerHTML += element;
				}
			}
		} else {
			getId("loadingWrapper").style.display = "none";
			getId("incorrectMsg").textContent =
				"Some error has occured. Check your connection and use correct URL";
		}
	});
}

// Video download event
getId("videoDownload").addEventListener("click", (event) => {
	getId("hidden").style.display = "none";
	clickAnimation("videoDownload");
	download("video");
});

// Audio download event
getId("audioDownload").addEventListener("click", (event) => {
	getId("hidden").style.display = "none";
	clickAnimation("audioDownload");
	download("audio");
});

// Downloading with ytdl
function download(type) {
	const url = getId("url").value;

	let format_id;

	if (type === "video") {
		format_id = getId("videoFormatSelect").value;
	} else {
		format_id = getId("audioFormatSelect").value;
	}

	const newItem = `
		<div class="item" id="${newFolderName}">
		<img src="../assets/images/close.png" onClick="fadeItem('${newFolderName}')" class="itemClose"}" id="${
		newFolderName + ".close"
	}">
		<img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" alt="thumbnail" class="itemIcon">

		<div class="itemBody">
			<div class="itemTitle">${title}</div>
			<div class="itemType">${type}</div>
			<input disabled type="range" value="0" class="hiddenVideoProgress" id="${
				newFolderName + "vid"
			}"></input>
			<input disabled type="range" value="0" class="hiddenAudioProgress" id="${
				newFolderName + "aud"
			}"></input>
			<div id="${newFolderName + "prog"}" class="itemProgress"></div>
		</div>
	</div>
	`;
	getId("list").innerHTML += newItem;
	getId("loadingWrapper").style.display = "none";
	let cancelled = false;

	getId(newFolderName + ".close").addEventListener("click", () => {
		if (getId(newFolderName)) {
			fadeItem(newFolderName);
		}
		cancelled = true;
	});

	let downloadProcess;
	if (type === "video") {
		// cp.spawn(`yt-dlp -f ${format_id}+best`);
		downloadProcess =  cp.spawn("yt-dlp", ['-f', `${format_id}+ba`])
	} else {
	}
}

// Removing item

function fadeItem(id) {
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
		body: "File saved successfully.",
		icon: "../assets/images/icon.png",
	});
	getId(
		progressId
	).innerHTML = `<b onClick="showItem('${location}', '${filename}')">File saved. Click to Open</b>`;
}

function showItem(location, filename) {
	shell.showItemInFolder(path.join(location, filename));
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
