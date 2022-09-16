const { clipboard } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-extended");
const path = require("path");
let url;
const ytDlp = localStorage.getItem("ytdlp");
const ytdlp = new YTDlpWrap(ytDlp);
const downloadDir = localStorage.getItem("downloadPath");

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
//  Downloading playlist: Inkscape Tutorials
// Downloading video 1 of 82

getId("download").addEventListener("click", () => {
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
	});

	downloadProcess.on("error", (error) => {
		getId("incorrectMsg").textContent = error;
	});
});
