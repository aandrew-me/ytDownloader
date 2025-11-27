const {ipcRenderer, shell} = require("electron");
const {accessSync, constants} = require("original-fs");
const {join} = require("path");
const {homedir} = require("os");

const storageTheme = localStorage.getItem("theme");
if (storageTheme) {
	document.documentElement.setAttribute("theme", storageTheme);
} else {
	document.documentElement.setAttribute("theme", "frappe");
}

let rightToLeft = "false";
if (localStorage.getItem("rightToLeft")) {
	rightToLeft = localStorage.getItem("rightToLeft");
}
if (rightToLeft == "true") {
	document
		.querySelectorAll(".prefBox")
		.forEach((/** @type {HTMLElement} */ item) => {
			item.style.flexDirection = "row-reverse";
		});
} else {
	console.log("Change to left to right");
	document
		.querySelectorAll(".prefBox")
		.forEach((/** @type {HTMLElement} */ item) => {
			item.style.flexDirection = "row";
		});
}

// Download path
let downloadPath = localStorage.getItem("downloadPath");

if (!downloadPath) {
	downloadPath = join(homedir(), "Downloads");
}
getId("path").textContent = downloadPath;

/**
 *
 * @param {string} id
 * @returns {any}
 */
function getId(id) {
	return document.getElementById(id);
}

document.addEventListener("translations-loaded", () => {
	window.i18n.translatePage();

	document.title = window.i18n.__("preferences");

	if (process.env.FLATPAK_ID) {
		getId("flatpakTxt").addEventListener("click", () => {
			shell.openExternal(
				"https://flathub.org/apps/com.github.tchx84.Flatseal"
			);
		});

		getId("flatpakTxt").style.display = "block";
	}
});

getId("back").addEventListener("click", () => {
	ipcRenderer.send("close-secondary");
});

// Selecting download directory
getId("selectLocation").addEventListener("click", () => {
	ipcRenderer.send("select-location-secondary", "");
});

ipcRenderer.on("downloadPath", (_event, downloadPath) => {
	try {
		accessSync(downloadPath[0], constants.W_OK);

		console.log(downloadPath[0]);
		localStorage.setItem("downloadPath", downloadPath[0]);
		getId("path").textContent = downloadPath[0];
	} catch (error) {
		showPopup(i18n.__("unableToAccessDir"), true);
	}
});

// Selecting config directory

getId("configBtn").addEventListener("click", () => {
	ipcRenderer.send("select-config", "");
});

ipcRenderer.on("configPath", (event, configPath) => {
	console.log(configPath);
	localStorage.setItem("configPath", configPath);
	getId("configPath").textContent = configPath;
});

const configCheck = getId("configCheck");
configCheck.addEventListener("change", (event) => {
	if (configCheck.checked) {
		getId("configOpts").style.display = "flex";
	} else {
		getId("configOpts").style.display = "none";
		localStorage.setItem("configPath", "");
	}
});

const configPath = localStorage.getItem("configPath");
if (configPath) {
	getId("configPath").textContent = configPath;
	configCheck.checked = true;
	getId("configOpts").style.display = "flex";
}

// Language settings

const language = localStorage.getItem("locale");

if (language) {
	if (language.startsWith("en")) {
		getId("select").value = "en";
	} else {
		getId("select").value = language;
	}
}

function changeLanguage() {
	const language = getId("select").value;
	localStorage.setItem("locale", language);
	if (language === "fa" || language === "ar") {
		rightToLeft = "true";
		localStorage.setItem("rightToLeft", "true");
	} else {
		rightToLeft = "false";
		localStorage.setItem("rightToLeft", "false");
	}
}

// Browser preferences
let browser = localStorage.getItem("browser");
if (browser) {
	getId("browser").value = browser;
}

getId("browser").addEventListener("change", () => {
	browser = getId("browser").value;
	localStorage.setItem("browser", browser);
});

// Handling preferred video quality
let preferredVideoQuality = localStorage.getItem("preferredVideoQuality");
if (preferredVideoQuality) {
	getId("preferredVideoQuality").value = preferredVideoQuality;
}

getId("preferredVideoQuality").addEventListener("change", () => {
	preferredVideoQuality = getId("preferredVideoQuality").value;
	localStorage.setItem("preferredVideoQuality", preferredVideoQuality);
});

// Handling preferred audio quality
let preferredAudioQuality = localStorage.getItem("preferredAudioQuality");
if (preferredAudioQuality) {
	getId("preferredAudioQuality").value = preferredAudioQuality;
}

getId("preferredAudioQuality").addEventListener("change", () => {
	preferredAudioQuality = getId("preferredAudioQuality").value;
	localStorage.setItem("preferredAudioQuality", preferredAudioQuality);
});

// Handling preferred video codec
let preferredVideoCodec = localStorage.getItem("preferredVideoCodec");
if (preferredVideoCodec) {
	getId("preferredVideoCodec").value = preferredVideoCodec;
}

getId("preferredVideoCodec").addEventListener("change", () => {
	preferredVideoCodec = getId("preferredVideoCodec").value;
	localStorage.setItem("preferredVideoCodec", preferredVideoCodec);
});

// Proxy
let proxy = localStorage.getItem("proxy");
if (proxy) {
	getId("proxyTxt").value = proxy;
}
getId("proxyTxt").addEventListener("change", () => {
	proxy = getId("proxyTxt").value;
	localStorage.setItem("proxy", proxy);
});

// Custom yt-dlp args
const ytDlpArgsInput = getId("customArgsInput");
let customYtDlpArgs = localStorage.getItem("customYtDlpArgs");
if (customYtDlpArgs) {
	ytDlpArgsInput.value = customYtDlpArgs;
	ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
}
ytDlpArgsInput.addEventListener("input", () => {
	customYtDlpArgs = getId("customArgsInput").value;
	localStorage.setItem("customYtDlpArgs", customYtDlpArgs.trim());
	ytDlpArgsInput.style.height = "auto";
	ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
});

getId("learnMoreLink").addEventListener("click", () => {
	shell.openExternal(
		"https://github.com/aandrew-me/ytDownloader/wiki/Custom-yt%E2%80%90dlp-options"
	);
});

// Reload
function reload() {
	ipcRenderer.send("reload");
}
getId("restart").addEventListener("click", () => {
	reload();
});

// Handling filename formats
getId("filenameFormat").addEventListener("input", () => {
	const text = getId("filenameFormat").value;
	localStorage.setItem("filenameFormat", text);
});

if (localStorage.getItem("filenameFormat")) {
	getId("filenameFormat").value = localStorage.getItem("filenameFormat");
}

getId("resetFilenameFormat").addEventListener("click", () => {
	getId("filenameFormat").value = "%(playlist_index)s.%(title)s.%(ext)s";
	localStorage.setItem(
		"filenameFormat",
		"%(playlist_index)s.%(title)s.%(ext)s"
	);
});

// Handling folder name formats
getId("foldernameFormat").addEventListener("input", () => {
	const text = getId("foldernameFormat").value;
	localStorage.setItem("foldernameFormat", text);
});

if (localStorage.getItem("foldernameFormat")) {
	getId("foldernameFormat").value = localStorage.getItem("foldernameFormat");
}

getId("resetFoldernameFormat").addEventListener("click", () => {
	getId("foldernameFormat").value = "%(playlist_title)s";
	localStorage.setItem("foldernameFormat", "%(playlist_title)s");
});

// Max active downloads
getId("maxDownloads").addEventListener("input", () => {
	const number = Number(getId("maxDownloads").value);

	if (number < 1) {
		localStorage.setItem("maxActiveDownloads", "1");
	} else {
		localStorage.setItem("maxActiveDownloads", String(number));
	}
});

if (localStorage.getItem("maxActiveDownloads")) {
	getId("maxDownloads").value = localStorage.getItem("maxActiveDownloads");
}

// Closing app to system tray
const closeToTray = getId("closeToTray");
closeToTray.addEventListener("change", (event) => {
	if (closeToTray.checked) {
		localStorage.setItem("closeToTray", "true");
		ipcRenderer.send("useTray", true);
	} else {
		localStorage.setItem("closeToTray", "false");
		ipcRenderer.send("useTray", false);
	}
});
const trayEnabled = localStorage.getItem("closeToTray");
if (trayEnabled == "true") {
	closeToTray.checked = true;
	ipcRenderer.send("useTray", true);
}

// Auto updates
const autoUpdateDisabled = getId("autoUpdateDisabled");
autoUpdateDisabled.addEventListener("change", (event) => {
	if (autoUpdateDisabled.checked) {
		localStorage.setItem("autoUpdate", "false");
	} else {
		localStorage.setItem("autoUpdate", "true");
	}
});
const autoUpdate = localStorage.getItem("autoUpdate");
if (autoUpdate == "false") {
	autoUpdateDisabled.checked = true;
}

// Show more format options
const showMoreFormats = getId("showMoreFormats");
showMoreFormats.addEventListener("change", (event) => {
	if (showMoreFormats.checked) {
		localStorage.setItem("showMoreFormats", "true");
	} else {
		localStorage.setItem("showMoreFormats", "false");
	}
});
const showMoreFormatOpts = localStorage.getItem("showMoreFormats");
if (showMoreFormatOpts == "true") {
	showMoreFormats.checked = true;
}

function showPopup(text, isError = false) {
	let popupContainer = document.getElementById("popupContainer");

	if (!popupContainer) {
		popupContainer = document.createElement("div");
		popupContainer.id = "popupContainer";
		popupContainer.className = "popup-container";
		document.body.appendChild(popupContainer);
	}

	const popup = document.createElement("span");
	popup.textContent = text;
	popup.classList.add("popup-item");

	popup.style.background = isError ? "#ff6b6b" : "#54abde";

	if (isError) {
		popup.classList.add("popup-error");
	}

	popupContainer.appendChild(popup);

	setTimeout(() => {
		popup.style.opacity = "0";
		setTimeout(() => {
			popup.remove();
			if (popupContainer.childElementCount === 0) {
				popupContainer.remove();
			}
		}, 1000);
	}, 2200);
}
