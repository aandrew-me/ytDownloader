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

// Directories
const homedir = os.homedir();
const appdir = homedir + "/.ytDownloader/";
const tempDir = appdir + "temp/";
const configPath = appdir + "config.json";
fs.mkdirSync(homedir + "/.ytDownloader/temp", { recursive: true });
let config;

// Download directory
let downloadDir = "";


// Handling config file

fs.readFile(configPath, (err) => {
	if (err) {
		fs.writeFileSync(configPath, "{}");
	}

	try {
		config = require(configPath);
	} catch (error) {
		// If config file is not in correct format
		fs.writeFileSync(configPath, "{}");
		config = require(configPath);
	}

	if (config.location) {
		fs.readdir(config.location, (err) => {
			if (err) {
				fs.mkdir(config.location, { recursive: true }, (err) => {
					if (err) {
						console.log("Incorrect filepath in config");
						downloadDir = homedir + "/ytDownloader";
					} else {
						downloadDir = config.location;
					}
				});
			} else {
				fs.writeFile(config.location + "/.test", "", (err) => {
					// If that location is not accessible
					if (err) {
						downloadDir = homedir + "/ytDownloader";
						console.log(
							"Not allowed to use that location to save files"
						);
					} else {
						downloadDir = config.location;
						fs.rm(config.location + "/.test", (err) => {
							if (err) console.log(err);
						});
					}
				});
			}
		});
	} else {
		downloadDir = homedir + "/Videos/ytDownloader/";
		fs.mkdirSync(homedir + "/Videos/ytDownloader/", { recursive: true });
	}
});

//////

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
const htmlPath = __dirname + "/html/";
app.use(cookieParser());

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

io.on("connection", (socket) => {
	socket.emit("id", socket.id);

	socket.on("downloadPath", () => {
		socket.emit("downloadPath", downloadDir);
	});

	socket.on("newPath", (userPath) => {
		let path;
		if (userPath[userPath.length-1] == "/"){
			path = userPath
		}
		else{
			path = userPath + "/"
		}
		
		checkPath(path)
			.then((response) => {
				const newConfig = {
					location: path,
				};
				fs.writeFile(configPath, JSON.stringify(newConfig), (err) => {
					if (!err) {
						socket.emit("pathSaved", true);
						downloadDir = path;
					} else {
						socket.emit("pathSaved", false);
					}
				});
			})
			.catch((error) => {
				socket.emit("pathSaved", false);
			});
	});
});

// GET routes

app.get("/", (req, res) => {
	res.sendFile(htmlPath + "index.html");
});

app.get("/about", (req, res) => {
	res.sendFile(htmlPath + "about.html");
});

app.get("/preferences", (req, res) => {
	res.sendFile(htmlPath + "preferences.html");
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
		const randomNum = Math.random().toFixed(5).toString("16").slice(2)
		const filename = `${title}_${randomNum}_${quality}.${extension}`
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
							if (audioProgress == 100) {
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
						}" -c copy "${downloadDir + filename}"`,
						(error, stdout, stderr) => {
							if (error) {
								console.log(error);
							} else if (stderr) {
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
					if (progress == 100) {
						io.to(socketId).emit("saved", `${downloadDir}`);
					}
					io.to(socketId)
						.emit("onlyAudioProgress", progress);
				})
				.pipe(fs.createWriteStream(downloadDir + filename));
		}
	});
});

app.post("/test", (req, res) => {
	console.log(req.body);
});

const PORT=59876

server.listen(PORT , () => {
	console.log("Server: http://localhost:" + PORT);
});
