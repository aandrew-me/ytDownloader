const fs = require("fs");
const ytdl = require("ytdl-core");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const ffmpeg = require("ffmpeg-static");
const os = require("os");
const cp = require("child_process");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));

// To do
// Preset
// Download location selection
// Choosing correct encoding


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
		const filename = title + "_" + quality + "." + extension
		const info = {
			format: format,
			title: title,
			extension: extension,
			quality:quality,
			filename:filename
		};
		return info;
	}

	findInfo(url, itag).then((info) => {
		const format = info.format;
		const filename = info.filename;

		// If video
		if (format.hasVideo) {
			let video = ytdl(url, { quality: itag });
			let audio = ytdl(url, {
				filter: "audioonly",
				highWaterMark: 1 << 25,
			});

			const ffmpegProcess = cp.spawn(
				ffmpeg,
				[
					"-i",
					`pipe:3`,
					"-i",
					`pipe:4`,
					"-map",
					"0:v",
					"-map",
					"1:a",
					"-c:v",
					"copy",
					"-c:a",
					"libmp3lame",
					"-crf",
					"27",
					"-preset",
					"fast",
					"-movflags",
					"frag_keyframe+empty_moov",
					'-f', "mp4",
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

			res.header("Content-Disposition", "attachment; filename='" + filename + "'");
			ffmpegProcess.stdio[1].pipe(res);
			
		}
		// If audio 
		 else {
			res.header("Content-Disposition", "attachment; filename=" + filename);

			ytdl(url, { quality: itag })
				.on("progress", (_, downloaded, size) => {
					const progress = (downloaded / size) * 100;
				})
				// .pipe(fs.createWriteStream(os.homedir() + "/Downloads/" + filename))
				.pipe(res);
		}
	});
});

// Off for now
app.post("", (req, res) => {
	const itag = parseInt(req.body.audioTag || req.body.videoTag);
	const url = req.body.url;

	async function findFormat(url, itag) {
		const info = await ytdl.getInfo(url);
		const format = ytdl.chooseFormat(info.formats, { quality: itag });
		const title = info.videoDetails.title;

		// Quality for filename
		let quality;
		if (format.hasVideo) {
			quality = format.qualityLabel;
		} else {
			quality = format.audioBitrate + "kbps";
		}

		// File extension for filename
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
		const filename = title + "_" + quality + "." + extension;
		return filename;
	}

	findFormat(url, itag)
		.then((filename) => {
			res.header("Content-Disposition", "attachment; filename=.m4a");
			ytdl(url, { quality: itag })
				.on("progress", (_, downloaded, size) => {
					const progress = (downloaded / size) * 100;
					// console.log("Progress: " + progress + "%" )
				})
				// .pipe(fs.createWriteStream(os.homedir() + "/Downloads/" + filename))
				.pipe(res);
		})
		.catch((error) => {
			console.log(error);
		});
});

app.listen(3000, () => {
	console.log("Server: http://localhost:3000");
});
