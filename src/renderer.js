const fs = require("fs");
const ytdl = require("ytdl-core");
const cp = require("child_process");
const os = require("os");
const ffmpeg = require("ffmpeg-static");
const { BrowserWindow, shell, remote, ipcRenderer } = require("electron");



// Directories
const homedir = os.homedir();
const appdir = homedir + "/.ytDownloader/";
const tempDir = appdir + "temp/";
fs.mkdirSync(homedir + "/.ytDownloader/temp", { recursive: true });
let config;

// Download directory
let downloadDir = "";

function getId(id) {
	return document.getElementById(id);
}

let localPath = localStorage.getItem("downloadPath")

if (localPath){
	downloadDir = localPath
}
else{
	downloadDir = appdir
}

// Clearing tempDir
fs.readdirSync(tempDir).forEach((f) => fs.rmSync(`${tempDir}/${f}`));

// Handling download location input from user
async function checkPath(path) {
	const check = new Promise((resolve, reject) => {
		fs.readdir(path, (err) => {
			// If directory doesn't exist, try creating it
			if (err) {
				fs.mkdir(path, (err) => {
					if (err) {
						reject(err);
					} else {
						console.log("Successfully created " + path);
						resolve(true);
					}
				});
			} else {
				fs.writeFile(path + "/.test", "", (err) => {
					// If that location is not accessible
					if (err) {
						reject(err);
					} else {
						fs.rm(path + "/.test", (err) => {
							if (err) console.log(err);
						});
						resolve(true);
					}
				});
			}
		});
	});

	const result = await check;
	return result;
}

// Collecting info from youtube
async function getVideoInfo(url) {
	let info;
	await ytdl.getInfo(url)
	.then((data)=>{
		info = data
	})
	.catch((error)=>{

	})
	return info;
}

// Getting video info
async function getInfo() {
	incorrectMsg.textContent = "";
	loadingMsg.style.display = "flex";
	getId("videoFormatSelect").innerHTML = "";
	getId("audioFormatSelect").innerHTML = "";
	const url = getId("url").value;
	let info = await getVideoInfo(url)

	if (info) {
		let title = info.videoDetails.title;
		let formats = info.formats;
		console.log(formats);
	
		const urlElements = document.querySelectorAll(".url");
	
		urlElements.forEach((element) => {
			element.value = url;
		});

		loadingMsg.style.display = "none";
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
		loadingMsg.style.display = "none";
		incorrectMsg.textContent =
			"Some error has occured. Check your connection and use correct URL";
	}
}

getId("getInfo").addEventListener("click", (event) => {
	getInfo();
});

getId("url").addEventListener("keypress", (event) => {
	if (event.key == "Enter") {
		getInfo();
	}
});

// Video download event
getId("videoDownload").addEventListener("click", (event) => {
	getId("preparingBox").style.display = "flex";
	clickAnimation("videoDownload");
	download("video");
});

// Audio download event
getId("audioDownload").addEventListener("click", (event) => {
	getId("preparingBox").style.display = "flex";
	clickAnimation("audioDownload");
	download("audio");
});

// Downloading with ytdl
function download(type) {
	getId("videoProgressBox").style.display = "none";
	getId("audioProgressBox").style.display = "none";

	getId("savedMsg").innerHTML = "";
	const url = getId("url").value;

	let itag;

	if (type === "video") {
		itag = getId("videoFormatSelect").value;
	} else {
		itag = getId("audioFormatSelect").value;
	}

	// Finding info of the link and downloading
	findInfo(url, itag).then((info) => {
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
			// Temporary audio and video files
			let videoName =
				Math.random().toString("16").slice(2) + "." + extension;
			let audioName =
				Math.random().toString("16").slice(2) + "." + audioExtension;

			const arr = [
				new Promise((resolve, reject) => {
					// Downloading only video
					ytdl(url, { quality: itag })
						.on("progress", (_, downloaded, size) => {
							videoProgress = (downloaded / size) * 100;

							if (videoProgress != 100) {
								getId("videoProgressBox").style.display =
									"block";
								getId("preparingBox").style.display = "none";
								getId("videoProgress").value = progress;
							}
							if (videoProgress == 100) {
								resolve("video downloaded");
							}
						})
						.pipe(fs.createWriteStream(tempDir + videoName));
				}),

				new Promise((resolve, reject) => {
					// Downloading only audio
					ytdl(url, {
						highWaterMark: 1 << 25,
						quality: audioTag,
					})
						.on("progress", (_, downloaded, size) => {
							audioProgress = (downloaded / size) * 100;

							if (audioProgress != 100) {
								getId("preparingBox").style.display = "none";
								getId("audioProgress").value = progress;
							} else if (audioProgress == 100) {
								resolve("audio downloaded");
							}
						})
						.pipe(fs.createWriteStream(tempDir + audioName));
				}),
			];

			Promise.all([arr[0], arr[1]])
				.then((response) => {
					cp.exec(
						`"${ffmpeg}" -i "${tempDir + videoName}" -i "${
							tempDir + audioName
						}" -c copy "${downloadDir + "/" + filename}"`,
						(error, stdout, stderr) => {
							if (error) {
								console.log(error);
							} else if (stderr) {
								console.log("video saved");
								// Clear temp dir
								fs.readdirSync(tempDir).forEach((f) =>
									fs.rmSync(`${tempDir}/${f}`)
								);
								afterSave(downloadDir, filename);
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
			ytdl(url, { quality: itag })
				.on("progress", (_, downloaded, size) => {
					const progress = (downloaded / size) * 100;

					if (progress != 100) {
						getId("preparingBox").style.display = "none";
						getId("audioProgressBox").style.display = "block";
						getId("onlyAudioProgress").value = progress;
					} else if (progress == 100) {
						afterSave(downloadDir, filename);
					}
				})
				.pipe(fs.createWriteStream(downloadDir + "/" + filename));
		}
	});
}

// After saving video

function afterSave(location, filename) {
	const notify = new Notification("ytDownloader", {
		body: "File saved successfully.",
		icon: "../assets/images/icon.png",
	});
	getId("videoProgressBox").style.display = "none";
	getId("audioProgressBox").style.display = "none";
	document.querySelector(".submitBtn").style.display = "inline-block";

	getId(
		"savedMsg"
	).innerHTML = `File saved. Click to open <b title="Click to open" class="savedMsg">${location}</b>`;

	getId("savedMsg").addEventListener("click", (e) => {
		shell.showItemInFolder(location + "/" + filename);
	});
}

// Function to find video/audio info
async function findInfo(url, itag) {
	const data = await ytdl.getInfo(url);
	const format = ytdl.chooseFormat(data.formats, { quality: itag });
	const title = data.videoDetails.title;
	let extension;
	if (format.hasVideo) {
		extension = format.mimeType.split("; ")[0].split("/")[1];
	} else {
		if (format.audioCodec === "mp4a.40.2") {
			extension = "m4a";
		} else {
			extension = format.audioCodec;
		}
	}

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
	};
	return info;
}

// Opening windows

getId("preferenceWin").addEventListener("click", () => {
	ipcRenderer.send("load-page", __dirname + "/preferences.html")
});

getId("aboutWin").addEventListener("click", ()=>{
	ipcRenderer.send("load-page", __dirname + "/about.html")
})