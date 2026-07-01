const {ipcRenderer, shell} = require("electron");
const {accessSync, constants} = require("original-fs");
const {join} = require("path");
const {homedir, platform} = require("os");
const {exec} = require("child_process");

function getId(id) {
	return document.getElementById(id);
}

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((button) => {
	button.addEventListener("click", () => {
		tabButtons.forEach((btn) => btn.classList.remove("active"));
		tabContents.forEach((content) => content.classList.remove("active"));

		button.classList.add("active");
		const targetTab = getId(`${button.dataset.tab}Tab`);
		if (targetTab) targetTab.classList.add("active");
	});
});

const searchInput = getId("settingsSearch");

searchInput.addEventListener("input", (e) => {
	const query = e.target.value.toLowerCase().trim();
	const searchableItems = document.querySelectorAll(
		".prefBox, .outputTemplateItem, .ytdlpInfoItem, #ytDlpArgBox, .configBox",
	);
	const tabContainer = document.querySelector(".tab-container");
	const structuralSections = document.querySelectorAll(".settings-section");

	if (query.length > 0) {
		tabContainer.classList.add("search-active");
		tabContents.forEach((content) =>
			content.classList.add("search-override"),
		);

		searchableItems.forEach((item) => {
			const innerTextData = item.textContent.toLowerCase();
			const interactiveInputs = item.querySelectorAll(
				"input, select, textarea",
			);
			let inputPlaceholdersText = "";

			interactiveInputs.forEach(
				(i) =>
					(inputPlaceholdersText +=
						(i.placeholder || "") + " " + (i.value || "")),
			);

			const totalHaystack =
				innerTextData + " " + inputPlaceholdersText.toLowerCase();

			if (totalHaystack.includes(query)) {
				item.classList.remove("item-hidden");
			} else {
				item.classList.add("item-hidden");
			}
		});

		structuralSections.forEach((section) => {
			const visibleChildren = section.querySelectorAll(
				".prefBox:not(.item-hidden), .outputTemplateItem:not(.item-hidden), .ytdlpInfoItem:not(.item-hidden), #ytDlpArgBox:not(.item-hidden), .configBox:not(.item-hidden)",
			);
			if (visibleChildren.length === 0) {
				section.classList.add("item-hidden");
			} else {
				section.classList.remove("item-hidden");
			}
		});
	} else {
		tabContainer.classList.remove("search-active");
		tabContents.forEach((content) =>
			content.classList.remove("search-override"),
		);
		searchableItems.forEach((item) => item.classList.remove("item-hidden"));
		structuralSections.forEach((section) =>
			section.classList.remove("item-hidden"),
		);
	}
});

const storageTheme = localStorage.getItem("theme") || "frappe";
document.documentElement.setAttribute("theme", storageTheme);

// Handle Layout Direction
function updateDirectionality() {
	const isRtl = localStorage.getItem("rightToLeft") === "true";
	if (isRtl) {
		document.body.classList.add("rtl");
	} else {
		document.body.classList.remove("rtl");
	}
}
updateDirectionality();

// Check yt-dlp version
const ytdlpPath = localStorage.getItem("ytdlp");
console.log("yt-dlp path:", ytdlpPath);
if (ytdlpPath) {
	exec(`"${ytdlpPath}" --version`, (error, stdout, _stderr) => {
		if (error) {
			console.error("Error executing yt-dlp:", error);
		} else {
			const version = stdout.trim();
			console.log("yt-dlp version:", version);
			getId("ytDlpVersion").textContent = version;
			getId("ytDlpPath").textContent = ytdlpPath;
		}
	});
} else {
	let systemPath;
	if (platform() === "win32") {
		exec("where yt-dlp", (err, stdout) => {
			if (err) {
				console.error("Error finding yt-dlp:", err);
				return;
			}
			systemPath = stdout.trim().split("\n")[0];
			console.log("System yt-dlp path:", systemPath);

			exec(`"${systemPath}" --version`, (error, stdout, _stderr) => {
				if (error) {
					console.error("Error executing yt-dlp:", error);
				} else {
					const version = stdout.trim();
					getId("ytDlpVersion").textContent = version;
					getId("ytDlpPath").textContent = systemPath;
				}
			});
		});
	} else {
		exec("which yt-dlp", (err, stdout) => {
			if (err) {
				console.error("Error finding yt-dlp:", err);
				return;
			}
			systemPath = stdout.trim();
			exec(`"${systemPath}" --version`, (error, stdout, _stderr) => {
				if (error) {
					console.error("Error executing yt-dlp:", error);
				}
				const version = stdout.trim();
				getId("ytDlpVersion").textContent = version;
				getId("ytDlpPath").textContent = systemPath;
			});
		});
	}
}

// Download Path Setup
let downloadPath =
	localStorage.getItem("downloadPath") || join(homedir(), "Downloads");
getId("path").textContent = downloadPath;

document.addEventListener("translations-loaded", () => {
	window.i18n.translatePage();
	document.title = window.i18n.__("preferences");

	if (process.env.FLATPAK_ID) {
		const flatpakEl = getId("flatpakTxt");
		flatpakEl.addEventListener("click", () => {
			shell.openExternal(
				"https://flathub.org/apps/com.github.tchx84.Flatseal",
			);
		});
		flatpakEl.style.display = "block";
	}
});

getId("back").addEventListener("click", () => {
	ipcRenderer.send("close-secondary");
});

getId("selectLocation").addEventListener("click", () => {
	ipcRenderer.send("select-location-secondary", "");
});

ipcRenderer.on("downloadPath", (_event, pathArray) => {
	try {
		accessSync(pathArray[0], constants.W_OK);
		localStorage.setItem("downloadPath", pathArray[0]);
		getId("path").textContent = pathArray[0];
	} catch (error) {
		showPopup(
			window.i18n
				? window.i18n.__("unableToAccessDir")
				: "Unable to access directory",
			true,
		);
	}
});

getId("configBtn").addEventListener("click", () => {
	ipcRenderer.send("select-config", "");
});

ipcRenderer.on("configPath", (event, configPath) => {
	localStorage.setItem("configPath", configPath);
	getId("configPath").textContent = configPath;
});

const configCheck = getId("configCheck");
configCheck.addEventListener("change", () => {
	if (configCheck.checked) {
		getId("configOpts").style.display = "flex";
	} else {
		getId("configOpts").style.display = "none";
		localStorage.setItem("configPath", "");
	}
});

const savedConfigPath = localStorage.getItem("configPath");
if (savedConfigPath) {
	getId("configPath").textContent = savedConfigPath;
	configCheck.checked = true;
	getId("configOpts").style.display = "flex";
}

// Localization Setup
const activeLang = localStorage.getItem("locale");
if (activeLang) {
	getId("select").value = activeLang.startsWith("en") ? "en" : activeLang;
}

getId("select").addEventListener("change", (e) => {
	const chosenLang = e.target.value;
	localStorage.setItem("locale", chosenLang);
	if (
		chosenLang === "fa" ||
		chosenLang === "ar" ||
		chosenLang === "fa-IR" ||
		chosenLang === "ar-SA"
	) {
		localStorage.setItem("rightToLeft", "true");
	} else {
		localStorage.setItem("rightToLeft", "false");
	}
	updateDirectionality();
});

const savedBrowser = localStorage.getItem("browser");
if (savedBrowser) {
	getId("browser").value = savedBrowser;
}
getId("browser").addEventListener("change", (e) => {
	localStorage.setItem("browser", e.target.value);
});

if (platform() === "darwin") {
	getId("ytdlpSourceBox").style.display = "none";
} else {
	const ytdlpSource = localStorage.getItem("ytdlpSource") || "nightly";
	const ytdlpSourceSelect = getId("ytdlpSource");
	ytdlpSourceSelect.value = ytdlpSource;
	ytdlpSourceSelect.addEventListener("change", () => {
		localStorage.setItem("ytdlpSource", ytdlpSourceSelect.value);
		localStorage.removeItem("ytdlp");
		ipcRenderer.send("reload");
	});
}

function bindSelectToStorage(elementId, storageKey) {
	const value = localStorage.getItem(storageKey);

	if (value) getId(elementId).value = value;

	getId(elementId).addEventListener("change", (e) => {
		localStorage.setItem(storageKey, e.target.value);
	});
}

bindSelectToStorage("preferredVideoQuality", "preferredVideoQuality");
bindSelectToStorage("preferredAudioQuality", "preferredAudioQuality");
bindSelectToStorage("preferredVideoCodec", "preferredVideoCodec");

// Proxy Setting Updates
const savedProxy = localStorage.getItem("proxy");
if (savedProxy) getId("proxyTxt").value = savedProxy;
getId("proxyTxt").addEventListener("change", (e) => {
	localStorage.setItem("proxy", e.target.value);
});

// Custom yt-dlp arguments
const ytDlpArgsInput = getId("customArgsInput");
let customYtDlpArgs = localStorage.getItem("customYtDlpArgs");
if (customYtDlpArgs) {
	ytDlpArgsInput.value = customYtDlpArgs;
	ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
}
ytDlpArgsInput.addEventListener("input", () => {
	localStorage.setItem("customYtDlpArgs", ytDlpArgsInput.value.trim());
	ytDlpArgsInput.style.height = "auto";
	ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
});

getId("learnMoreYtdlpArgs").addEventListener("click", () => {
	shell.openExternal(
		"https://github.com/aandrew-me/ytDownloader/wiki/Custom-yt%E2%80%90dlp-options",
	);
});

getId("learnMoreOutputTemplates").addEventListener("click", () => {
	shell.openExternal("https://github.com/yt-dlp/yt-dlp#output-template");
});

getId("restart").addEventListener("click", () => {
	ipcRenderer.send("reload");
});

// Dynamic configuration fields abstractions helper function
function bindInputToStorage(inputId, storageKey, fallbackValue, resetId) {
	const inputEl = getId(inputId);
	const savedVal = localStorage.getItem(storageKey);

	if (savedVal !== null) {
		inputEl.value = savedVal;
	}

	inputEl.addEventListener("input", () => {
		localStorage.setItem(storageKey, inputEl.value);
	});

	if (resetId) {
		getId(resetId).addEventListener("click", () => {
			inputEl.value = fallbackValue;
			localStorage.setItem(storageKey, fallbackValue);
		});
	}
}

bindInputToStorage(
	"filenameTemplateVideo",
	"filenameTemplateVideo",
	"%(title)s.%(ext)s",
	"resetFilenameTemplateVideo",
);
bindInputToStorage(
	"filenameTemplateAudio",
	"filenameTemplateAudio",
	"%(title)s.%(ext)s",
	"resetAudioFilenameTemplate",
);
bindInputToStorage(
	"filenameFormat",
	"filenameFormat",
	"%(playlist_index)s.%(title)s.%(ext)s",
	"resetFilenameFormat",
);
bindInputToStorage(
	"foldernameFormat",
	"foldernameFormat",
	"%(playlist_title)s",
	"resetFoldernameFormat",
);

// Max active downloads validation parameters
const maxDownloadsInput = getId("maxDownloads");
if (localStorage.getItem("maxActiveDownloads")) {
	maxDownloadsInput.value = localStorage.getItem("maxActiveDownloads");
}
maxDownloadsInput.addEventListener("input", () => {
	const num = Number(maxDownloadsInput.value);
	const resolved = num < 1 ? "1" : String(num);
	localStorage.setItem("maxActiveDownloads", resolved);
});

// UI Switches triggers
function bindCheckboxToStorage(
	checkboxId,
	storageKey,
	checkValue = "true",
	uncheckValue = "false",
	onChangeCallback = null,
) {
	const cb = getId(checkboxId);
	cb.checked = localStorage.getItem(storageKey) === checkValue;

	cb.addEventListener("change", () => {
		const value = cb.checked ? checkValue : uncheckValue;
		localStorage.setItem(storageKey, value);
		if (onChangeCallback) onChangeCallback(cb.checked);
	});
}

bindCheckboxToStorage(
	"closeToTray",
	"closeToTray",
	"true",
	"false",
	(checked) => {
		ipcRenderer.send("useTray", checked);
	},
);

if (localStorage.getItem("closeToTray") === "true") {
	ipcRenderer.send("useTray", true);
}

bindCheckboxToStorage("autoUpdateDisabled", "autoUpdate", "false", "true");
bindCheckboxToStorage("showMoreFormats", "showMoreFormats", "true", "false");

function showPopup(text, isError = false) {
	let popupContainer = getId("popupContainer");
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

	popupContainer.appendChild(popup);

	setTimeout(() => {
		popup.style.opacity = "0";
		setTimeout(() => {
			popup.remove();
			if (popupContainer.childElementCount === 0) {
				popupContainer.remove();
			}
		}, 400);
	}, 2200);
}
