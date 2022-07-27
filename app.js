//! Todo
//! Filename needs to be filtered
//! Total progress
//! Colours


const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const fs = require("fs");
const ytdl = require("ytdl-core");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser")
const ffmpeg = require("ffmpeg-static");
const cp = require("child_process");
const os = require('os')


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.use(cookieParser())

io.on("connection", (socket)=>{
	socket.emit("id", socket.id)	
})


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


app.post("/download", (req, res) => {
	const socketId = req.cookies.id
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
		const filename = info.filename;
		const extension = info.extension;

		// If video
		if (format.hasVideo) {
			let video = ytdl(url, { quality: itag }).on(
				"progress",
				(_, downloaded, size) => {
					const videoProgress = (downloaded / size) * 100;
					io.to(socketId).emit("videoProgress", videoProgress)
				}
			);

			let audio = ytdl(url, {
				filter: "audioonly",
				highWaterMark: 1 << 25,
			}).on("progress", (_, downloaded, size) => {
				const audioProgress = (downloaded / size) * 100;
				io.to(socketId).emit("audioProgress", audioProgress)
			});

			res.header("Content-Disposition", `attachment;  filename=.mp4`);

			const ffmpegProcess = cp.spawn(
				ffmpeg,
				[
					"-i",
					`pipe:3`,
					"-i",
					`pipe:4`,
					"-c",
					"copy",
					// '-map','0:v',
					// '-map','1:a',
					// '-c:v', 'copy',
					// '-c:a', 'copy',
					// '-crf','27',
					"-movflags",
					"frag_keyframe+empty_moov",
					"-f",
					extension,
					"-loglevel",
					"error",
					"-",
				],
				{
					stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
				}
			);

			video.pipe(ffmpegProcess.stdio[3]);
			audio.pipe(ffmpegProcess.stdio[4]);
			ffmpegProcess.stdio[1].pipe(fs.createWriteStream(os.homedir() + "/Downloads/" + filename));

		}
		// If audio
		else {
			res.header(
				"Content-Disposition",
				"attachment; filename=audio." + extension
			);

			ytdl(url, { quality: itag })
				.on("progress", (_, downloaded, size) => {
					const progress = (downloaded / size) * 100;
					io.sockets.to(req.cookies.id).emit("audioProgress", progress)
				})
				.pipe(fs.createWriteStream(os.homedir() + "/Downloads/" + filename))
				// .pipe(res);
		}
	});
});

app.post("/test", (req, res)=>{
	console.log(req.body)
})




server.listen(3000, () => {
	console.log("Server: http://localhost:3000");
});
