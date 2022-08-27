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
const tempDir = path.join(homedir,".ytDownloader", "temp");
fs.mkdirSync(tempDir, { recursive: true });

// Download directory
let downloadDir = "";

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
fs.mkdir(downloadDir, {recursive:true}, ()=>{})

// Clearing tempDir
fs.readdirSync(tempDir).forEach((f) => fs.rmdir(`${tempDir}/${f}`, {recursive:true} ,() => {}));

// Collecting info from youtube
async function getVideoInfo(url) {
	let info;
	await ytdl
		.getInfo(url)
		.then((data) => {
			info = data;
		})
		.catch((error) => {
			console.log(error);
		});
	return info;
}

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
	let info = await getVideoInfo(url);

	if (info) {
		const title = info.videoDetails.title;
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
				format.hasAudio &&
				!format.hasVideo &&
				format.contentLength &&
				format.container == "mp4"
			) {
				audioSize = Number(format.contentLength) / 1000000;
			}
		}

		for (let format of formats) {
			let size = (Number(format.contentLength) / 1000000).toFixed(2);

			// For videos
			if (format.hasVideo && format.contentLength && !format.hasAudio) {
				size = (Number(size) + Number(audioSize)).toFixed(2);
				size = size + " MB";
				const itag = format.itag;
				const avcPattern = /^avc1[0-9a-zA-Z.]+$/g;
				const av1Pattern = /^av01[0-9a-zA-Z.]+$/g;

				let codec;
				if (av1Pattern.test(format.codecs)) {
					codec = "AV1 Codec";
				} else if (avcPattern.test(format.codecs)) {
					codec = "AVC Codec";
				} else {
					codec = format.codecs.toUpperCase() + " Codec";
				}

				const element =
					"<option value='" +
					itag +
					"'>" +
					format.qualityLabel +
					"  |  " +
					format.container +
					"  |  " +
					size +
					"  |  " +
					codec;
				("</option>");
				getId("videoFormatSelect").innerHTML += element;
			}

			// For audios
			else if (
				format.hasAudio &&
				!format.hasVideo &&
				format.audioBitrate
			) {
				size = size + " MB";
				const pattern = /^mp*4a[0-9.]+$/g;
				let audioCodec;
				const itag = format.itag;

				if (pattern.test(format.audioCodec)) {
					audioCodec = "m4a";
				} else {
					audioCodec = format.audioCodec;
				}
				const element =
					"<option value='" +
					itag +
					"'>" +
					format.audioBitrate +
					" kbps" +
					" | " +
					audioCodec +
					" | " +
					size +
					"</option>";
				getId("audioFormatSelect").innerHTML += element;
			}
		}
	} else {
		getId("loadingWrapper").style.display = "none";
		getId("incorrectMsg").textContent =
			"Some error has occured. Check your connection and use correct URL";
	}
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

	const newFolderName = Math.random().toFixed(10).toString().slice(2);
	const newFolderPath = path.join(tempDir, newFolderName);

	fs.mkdir(newFolderPath, (err) => {
		if (err) {
			console.log("Temp directory couldn't be created");
		}
	});

	let itag;

	if (type === "video") {
		itag = getId("videoFormatSelect").value;
	} else {
		itag = getId("audioFormatSelect").value;
	}

	// Finding info of the link and downloading
	findInfo(url, itag).then((info) => {
		const id = info.id;
		const newItem = `
		<div class="item" id="${newFolderName}">
		<img src="../assets/images/close.png" onClick="fadeItem('${newFolderName}')" class="itemClose"}" id="${
			newFolderName + ".close"
		}">
		<img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" alt="thumbnail" class="itemIcon">
	
		<div class="itemBody">
			<div class="itemTitle">${info.title}</div>
			<div class="itemType">${info.filetype}</div>
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

		const format = info.format;
		const extension = info.extension;
		let filename = "";
		// Trying to remove ambiguous characters
		for (let i = 0; i < info.filename.length; i++) {
			const pattern = /^[`~!@#$%^&*:;,<>?/|'"-+=\]\[]$/g;
			let letter = "";
			if (pattern.test(info.filename[i])) {
				letter = "";
			} else {
				if (info.filename[i] == " ") {
					letter = "_";
				} else {
					letter = info.filename[i];
				}
			}
			filename += letter;
		}

		let audioExtension;
		let videoProgress, audioProgress;
		let audioTag;

		if (extension == "mp4") {
			audioTag = 140;
			audioExtension = "m4a";
		} else {
			audioTag = 251;
			audioExtension = "opus";
		}

		// If video
		if (format.hasVideo) {
			getId(newFolderName + "prog").textContent = "Starting...";
			// Temporary audio and video files
			let videoName =
				Math.random().toString("16").slice(2) + "." + extension;
			let audioName =
				Math.random().toString("16").slice(2) + "." + audioExtension;

			const arr = [
				new Promise((resolve, reject) => {
					if (cancelled) {
						reject("cancelled");
					}
					// Downloading only video
					const videoDownload = ytdl(url, { quality: itag });

					videoDownload
						.on("progress", (_, downloaded, size) => {
							if (cancelled) {
								console.log("Cancelled video");
								videoDownload.destroy();
								reject();
							} else {
								videoProgress = (downloaded / size) * 100;
								getId(newFolderName + "vid").value =
									videoProgress;

								if (videoProgress != 100) {
									getId(newFolderName + "prog").textContent =
										"Downloading";
									getId(newFolderName + "vid").style.display =
										"block";
									getId(newFolderName + "aud").style.display =
										"block";
								}
								if (videoProgress == 100) {
									resolve("video downloaded");
								}
							}
						})
						.pipe(
							fs.createWriteStream(
								path.join(newFolderPath, videoName)
							)
						);
				}),

				new Promise((resolve, reject) => {
					if (cancelled) {
						reject("cancelled");
					}
					// Downloading only audio
					const audioDownload = ytdl(url, {
						highWaterMark: 1 << 25,
						quality: audioTag,
					});

					audioDownload
						.on("progress", (_, downloaded, size) => {
							if (cancelled) {
								console.log("Cancelled audio");
								audioDownload.destroy();
								reject();
							} else {
								audioProgress = (downloaded / size) * 100;
								getId(newFolderName + "aud").value =
									audioProgress || 0;

								if (audioProgress != 100) {
								} else if (audioProgress == 100) {
									resolve("audio downloaded");
								}
							}
						})
						.pipe(
							fs.createWriteStream(
								path.join(newFolderPath, audioName)
							)
						);
				}),
			];

			Promise.all([arr[0], arr[1]])
				.then((response) => {
					getId(newFolderName + "aud").style.display = "none";
					getId(newFolderName + "vid").style.display = "none";

					cp.exec(
						`"${ffmpeg}" -i "${path.join(
							newFolderPath,
							videoName
						)}" -i "${path.join(
							newFolderPath,
							audioName
						)}" -c copy "${path.join(downloadDir, filename)}"`,
						(error, stdout, stderr) => {
							if (error) {
								console.log(error);
							} else if (stderr) {
								console.log("video saved");
								// Clear temp dir
								fs.readdirSync(newFolderPath).forEach((f) =>
									fs.rm(`${newFolderPath}/${f}`, () => {})
								);
								getId(newFolderName + "prog").textContent =
									"Saved successfully";
								afterSave(
									downloadDir,
									filename,
									newFolderName + "prog"
								);
							}
						}
					);
				})
				.catch((error) => {
					console.log("Promise failed. " + error);
				});
		}

		// If audio
		else {
			getId(newFolderName + "prog").textContent = "Starting...";

			const audioDownloading = ytdl(url, { quality: itag });

			audioDownloading
				.on("progress", (_, downloaded, size) => {
					if (cancelled) {
						console.log("Cancelled");
						audioDownloading.destroy();
						fs.rm(path.join(downloadDir, filename), (err) => {
							if (err) {
								console.log(err);
							}
						});
						return;
					}
					const progress = ((downloaded / size) * 100).toFixed(0);

					getId(
						newFolderName + "prog"
					).textContent = `Progress: ${progress}%`;
				})
				.on("end", () => {
					afterSave(downloadDir, filename, newFolderName + "prog");
				})
				.pipe(fs.createWriteStream(path.join(downloadDir, filename)));
		}
	});
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
	getId(progressId).innerHTML = `<b onClick="showItem('${location}', '${filename}')">File saved. Click to Open</b>`;
}

function showItem(location, filename){
	shell.showItemInFolder(path.join(location, filename));
}

// Function to find video/audio info
async function findInfo(url, itag) {
	const data = await ytdl.getInfo(url);
	const format = ytdl.chooseFormat(data.formats, { quality: itag });
	const title = data.videoDetails.title;
	const id = data.videoDetails.videoId;
	let type;
	let extension;
	if (format.hasVideo) {
		extension = format.mimeType.split("; ")[0].split("/")[1];
		type = "Video";
	} else {
		type = "Audio";
		if (format.audioCodec === "mp4a.40.2") {
			extension = "m4a";
		} else {
			extension = format.audioCodec;
		}
	}
	let filetype = type + "/" + extension;

	let quality;
	if (format.hasVideo) {
		quality = format.qualityLabel;
	} else {
		quality = format.audioBitrate + "kbps";
	}
	const randomNum = Math.random().toFixed(5).toString("16").slice(2);
	const filename = `${title}_${randomNum}_${quality}.${extension}`;
	const info = {
		format: format,
		title: title,
		extension: extension,
		quality: quality,
		filename: filename,
		id: id,
		filetype: filetype,
	};
	return info;
}

// Opening windows
function closeMenu(){
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
	closeMenu()
	ipcRenderer.send("load-page", __dirname + "/preferences.html");
});

getId("aboutWin").addEventListener("click", () => {
	closeMenu()
	ipcRenderer.send("load-page", __dirname + "/about.html");
});
