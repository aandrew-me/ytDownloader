const { clipboard } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-extended");
const path = require("path");
let url;
const ytDlp = localStorage.getItem("ytdlp");
const ytdlp = new YTDlpWrap(ytDlp);
const downloadDir = localStorage.getItem("downloadPath");
const i18n = new (require("../translations/i18n"))();

function getId(id) {
	return document.getElementById(id);
}

function pasteLink() {
	url = clipboard.readText();
	getId("link").textContent = " " + url;
	getId("options").style.display = "block";
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
const playlistName = "Downloading playlist: ";
const videoIndex = "Downloading video ";
//  Downloading playlist: Inkscape Tutorials
// Downloading video 1 of 82

getId("download").addEventListener("click", () => {
	let count = 0;

	getId("options").style.display = "none";
	getId("pasteLink").style.display = "none";
	getId("playlistName").textContent = i18n.__("Processing") + "..."
	const quality = getId("select").value;
	const format = `"mp4[height<=${quality}]+m4a/mp4[height<=${quality}]/bv[height<=${quality}]+ba/best[height<=${quality}]/best"`;
	const controller = new AbortController();

	const downloadProcess = ytdlp.exec(
		[
			"-f",
			format,
			"--yes-playlist",
			"-o",
			`"${path.join(
				downloadDir,
				"%(title)s_%(playlist_index)s.%(ext)s"
			)}"`,

			`"${url}"`,
		],
		{ shell: true, detached: false },
		controller.signal
	);

	downloadProcess.on("ytDlpEvent", (eventType, eventData) => {
		console.log(eventData);

		if (eventData.includes(playlistName)) {
			getId("playlistName").textContent = eventData;
		}

		if (eventData.includes(videoIndex)) {
			count += 1;
			const itemTitle = i18n.__("Video") + " " + eventData.split(" ")[3];

			if (count > 1) {
				getId(`p${count - 1}`).textContent = i18n.__("File saved successfully")
			}

			const item = `<div class="item">
			<p class="itemTitle">${itemTitle}</p>
			<p class="itemProgress" id="p${count}">${i18n.__("Downloading...")}</p>
			</div>`;
			getId("list").innerHTML += item;
		}
	});

	downloadProcess.on("progress", (progress) => {
		if (getId(`p${count}`)) {
			getId(`p${count}`).textContent = `${i18n.__("Progress")} ${progress.percent}% | ${i18n.__("Speed")} ${progress.currentSpeed}`
		}
	});

	downloadProcess.on("error", (error) => {
		getId("incorrectMsg").textContent = error;
	});

	downloadProcess.on("close", ()=>{
		getId("pasteLink").style.display = "inline-block";

	})
});
