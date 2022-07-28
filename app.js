//! Todo
//! Filename needs to be filtered
//! Total progress

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const fs = require("fs");
const ytdl = require("ytdl-core");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const ffmpeg = require("ffmpeg-static");
const cp = require("child_process");
const os = require("os");

const homedir = os.homedir();
fs.mkdirSync(homedir + "/Videos/ytDownloader/temp", { recursive: true });
const downloadDir = homedir + "/Videos/ytDownloader/";
const tempDir = homedir + "/Videos/ytDownloader/temp/";
fs.readdirSync(tempDir).forEach((f) => fs.rmSync(`${tempDir}/${f}`));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());

io.on("connection", (socket) => {
	socket.emit("id", socket.id);
});

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

async function getVideoInfo(url) {
	const info = await ytdl.getInfo(url);
	return info;
}

app.post("/", (req, res) => {
	const url = req.body.url;
	getVideoInfo(url)
		.then((video) =>
			res.json({
				status: true,
				title: video.videoDetails.title,
				formats: video.formats,
				url: url,
			})
		)
		.catch((error) =>
			res.json({ status: false, message: "Use correct URL" })
		);
});

// Downloading video

app.post("/download", async (req, res) => {
	const socketId = req.cookies.id;
	const itag = parseInt(req.body.audioTag || req.body.videoTag);
	const url = req.body.url;

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
		const filename = title + "_" + quality + "." + extension;
		const info = {
			format: format,
			title: title,
			extension: extension,
			quality: quality,
			filename: filename,
		};
		return info;
	}

	findInfo(url, itag).then((info) => {
		const format = info.format;
		const extension = info.extension;
		let filename = "";
		for (let i = 0; i < info.filename.length; i++) {
			const pattern = /^[a-zA-Z0-9.]$/g;
			let letter = "";
			if (pattern.test(info.filename[i])) {
				letter = info.filename[i];
			} else {
				letter = "_";
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
							io.to(socketId).emit(
								"videoProgress",
								videoProgress
							);
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
							io.to(socketId).emit(
								"audioProgress",
								audioProgress
							);
							resolve("audio downloaded");
						})
						.pipe(fs.createWriteStream(tempDir + audioName));
				}),
			];

			Promise.all([arr[0], arr[1]])
				.then((response) => {
					cp.exec(
						`'${ffmpeg}' -i '${tempDir + videoName}' -i '${
							tempDir + audioName
						}' -c copy '${downloadDir + filename}'`,
						(error, stdout, stderr) => {
							if (error) {
								console.log(error);
							} else{
								console.log("video saved");
								// Clear temp dir
								fs.readdirSync(tempDir).forEach((f) =>
									fs.rmSync(`${tempDir}/${f}`)
								);
								io.to(socketId).emit("saved", `${downloadDir}`);
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
					io.sockets
						.to(req.cookies.id)
						.emit("audioProgress", progress);
				})
				.pipe(fs.createWriteStream(downloadDir + filename));
		}
	});
});

app.post("/test", (req, res) => {
	console.log(req.body);
});

server.listen(3000, () => {
	console.log("Server: http://localhost:3000");
});
