const { clipboard, shell, ipcRenderer } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-extended");
const path = require("path");
const { platform } = require("os");
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
	getId("incorrectMsg").textContent = "";

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
const playlistTxt = "Downloading playlist: ";
const videoIndex = "Downloading video ";

getId("download").addEventListener("click", () => {
	let count = 0;
	let playlistName;
	const date = new Date();
	const today = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
	let playlistDirName = "Playlist_" + today;

	// Opening folder
	let folderLocation = path.join(downloadDir, playlistDirName)
	if (platform() == "win32"){
		folderLocation = folderLocation.split(path.sep).join("\\\\");
	}
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
				playlistDirName,
				"%(playlist_index)s.%(title)s.%(ext)s"
			)}"`,

			`"${url}"`,
		],
		{ shell: true, detached: false },
		controller.signal
	);

	downloadProcess.on("ytDlpEvent", (eventType, eventData) => {
		console.log(eventData);

		if (eventData.includes(playlistTxt)) {
			playlistName = eventData.split(":")[1].slice(1)
			getId("playlistName").textContent = i18n.__("Downloading playlist:") + " "+ playlistName;
			console.log(playlistName);
		}

		if (eventData.includes(videoIndex)) {
			count += 1;
			const itemTitle = i18n.__("Video") + " " + eventData.split(" ")[3];

			if (count > 1) {
				getId(`p${count - 1}`).textContent = i18n.__("File saved. Click to Open")
			}

			const item = `<div class="playlistItem">
			<p class="itemTitle">${itemTitle}</p>
			<p class="itemProgress" onclick="openFolder('${folderLocation}')" id="p${count}">${i18n.__("Downloading...")}</p>
			</div>`;
			getId("list").innerHTML += item;
		}
	});

	downloadProcess.on("progress", (progress) => {
		if (getId(`p${count}`)) {
			getId(`p${count}`).textContent = `${i18n.__("Progress")} ${progress.percent}% | ${i18n.__("Speed")} ${progress.currentSpeed || 0}`
		}
	});

	downloadProcess.on("error", (error) => {
		getId("pasteLink").style.display = "inline-block"
		getId("options").style.display = "block";
		getId("playlistName").textContent = ""
		getId("incorrectMsg").textContent = i18n.__("Some error has occured. Check your network and use correct URL");
		getId("incorrectMsg").title = error
	});

	downloadProcess.on("close", ()=>{
		getId("pasteLink").style.display = "inline-block";

	})
});


function openFolder(location){
	shell.openPath(location)
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
getId("homeWin").addEventListener("click", ()=>{
	closeMenu();
	ipcRenderer.send("load-win", __dirname + "/index.html");
})

// Translations
getId("pasteLink").textContent = i18n.__("Click to paste playlist link from clipboard [Ctrl + V]")
getId("preferenceWin").textContent = i18n.__("Preferences")
getId("aboutWin").textContent = i18n.__("About")
getId("homeWin").textContent = i18n.__("Homepage")
getId("linkTitle").textContent = i18n.__("Link:")
getId("videoFormat").textContent = i18n.__("Select Format ")
getId("download").textContent = i18n.__("Download")