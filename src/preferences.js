import { getId, showPopup } from "./utils.js";

const {
	ipcRenderer,
	shell,
	accessSync,
	constants,
	fs,
	join,
	homedir,
	platform,
	exec,
	env,
} = window.electronAPI;

function initPreferencesUI() {
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
	if (searchInput) {
		searchInput.addEventListener("input", (e) => {
			const query = e.target.value.toLowerCase().trim();
			const tabContainer = document.querySelector(".tab-container");
			const tabContents = document.querySelectorAll(".tab-content");
			const structuralSections = document.querySelectorAll(".settings-section");

			if (query.length > 0) {
				tabContainer.classList.add("search-active");
				tabContents.forEach((content) =>
					content.classList.add("search-override"),
				);

				structuralSections.forEach((section) => {
					const headerEl = section.querySelector(
						"#outputTemplateTxt, .title-box",
					);
					const headerMatches =
						headerEl && headerEl.textContent.toLowerCase().includes(query);

					const searchableItems = section.querySelectorAll(
						".prefBox, .outputTemplateItem, .ytdlpInfoItem, #ytDlpArgBox, .configBox",
					);
					let visibleChildrenCount = 0;

					searchableItems.forEach((item) => {
						if (headerMatches) {
							item.classList.remove("item-hidden");
							visibleChildrenCount++;
						} else {
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
								innerTextData +
								" " +
								inputPlaceholdersText.toLowerCase();

							if (totalHaystack.includes(query)) {
								item.classList.remove("item-hidden");
								visibleChildrenCount++;
							} else {
								item.classList.add("item-hidden");
							}
						}
					});

					if (visibleChildrenCount > 0 || headerMatches) {
						section.classList.remove("item-hidden");
					} else {
						section.classList.add("item-hidden");
					}
				});
			} else {
				tabContainer.classList.remove("search-active");
				tabContents.forEach((content) =>
					content.classList.remove("search-override"),
				);

				document
					.querySelectorAll(
						".prefBox, .outputTemplateItem, .ytdlpInfoItem, #ytDlpArgBox, .configBox, .settings-section",
					)
					.forEach((item) => item.classList.remove("item-hidden"));
			}
		});
	}
}

const storageTheme = localStorage.getItem("theme") || "frappe";
document.documentElement.setAttribute("theme", storageTheme);

// Handle Layout Direction
function updateDirectionality() {
	let isRtl = localStorage.getItem("rightToLeft");
	const currentLocale = localStorage.getItem("locale") || "";
	const rtlLocales = ["fa", "ar", "fa-IR", "ar-SA"];

	if (isRtl === null && rtlLocales.includes(currentLocale)) {
		isRtl = "true";
		localStorage.setItem("rightToLeft", "true");
	}

	if (isRtl === "true") {
		document.body.classList.add("rtl");
	} else {
		document.body.classList.remove("rtl");
	}
}

function initPreferences() {
	updateDirectionality();

	// Check yt-dlp version
	const ytdlpPath = localStorage.getItem("ytdlp");
	if (ytdlpPath) {
		exec(`"${ytdlpPath}" --version`, (error, stdout, _stderr) => {
			if (!error) {
				const version = stdout.trim();
				if (getId("ytDlpVersion")) getId("ytDlpVersion").textContent = version;
				if (getId("ytDlpPath")) getId("ytDlpPath").textContent = ytdlpPath;
			}
		});
	} else if (platform) {
		const cmd = platform() === "win32" ? "where yt-dlp" : "which yt-dlp";
		exec(cmd, (err, stdout) => {
			if (!err && stdout) {
				const systemPath = stdout.trim().split("\n")[0];
				exec(`"${systemPath}" --version`, (error, out) => {
					if (!error) {
						if (getId("ytDlpVersion")) getId("ytDlpVersion").textContent = out.trim();
						if (getId("ytDlpPath")) getId("ytDlpPath").textContent = systemPath;
					}
				});
			}
		});
	}

	// Download Path Setup
	let downloadPath =
		localStorage.getItem("downloadPath") || (homedir ? join(homedir(), "Downloads") : "");
	const pathEl = getId("path");
	if (pathEl) pathEl.textContent = downloadPath;

	getId("back")?.addEventListener("click", () => {
		ipcRenderer.send("close-secondary");
	});

	getId("selectLocation")?.addEventListener("click", () => {
		ipcRenderer.send("select-location-secondary", "");
	});

	getId("configBtn")?.addEventListener("click", () => {
		ipcRenderer.send("select-config", "");
	});

	const configCheck = getId("configCheck");
	if (configCheck) {
		configCheck.addEventListener("change", () => {
			if (configCheck.checked) {
				const opts = getId("configOpts");
				if (opts) opts.style.display = "flex";
			} else {
				const opts = getId("configOpts");
				if (opts) opts.style.display = "none";
				localStorage.setItem("configPath", "");
			}
		});

		const savedConfigPath = localStorage.getItem("configPath");
		if (savedConfigPath) {
			const cfgPathEl = getId("configPath");
			if (cfgPathEl) cfgPathEl.textContent = savedConfigPath;
			configCheck.checked = true;
			const opts = getId("configOpts");
			if (opts) opts.style.display = "flex";
		}
	}

	// Localization Setup
	const langSelectEl = getId("selectLanguage") || getId("select");
	const activeLang = localStorage.getItem("locale");
	if (activeLang && langSelectEl) {
		langSelectEl.value = activeLang.startsWith("en") ? "en" : activeLang;
	}

	if (langSelectEl) {
		const updateLang = (e) => {
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
		};
		langSelectEl.addEventListener("change", updateLang);
		langSelectEl.addEventListener("input", updateLang);
	}

	// Cookie Source & Netscape Cookies Setup
	const savedCookieSource =
		localStorage.getItem("cookieSource") ||
		(localStorage.getItem("browser") ? "browser" : "none");
	const cookieSourceSelect = getId("cookieSource");
	const browserSelectBox = getId("browserSelectBox");
	const netscapeCookiesBox = getId("netscapeCookiesBox");

	function updateCookieSourceUI(source) {
		if (source === "browser") {
			if (browserSelectBox) browserSelectBox.style.display = "flex";
			if (netscapeCookiesBox) netscapeCookiesBox.style.display = "none";
		} else if (source === "file") {
			if (browserSelectBox) browserSelectBox.style.display = "none";
			if (netscapeCookiesBox) netscapeCookiesBox.style.display = "flex";
		} else {
			if (browserSelectBox) browserSelectBox.style.display = "none";
			if (netscapeCookiesBox) netscapeCookiesBox.style.display = "none";
		}
	}

	if (cookieSourceSelect) {
		cookieSourceSelect.value = savedCookieSource;
		updateCookieSourceUI(savedCookieSource);

		const updateCookieSource = (e) => {
			const newSource = e.target.value;
			localStorage.setItem("cookieSource", newSource);
			updateCookieSourceUI(newSource);
		};
		cookieSourceSelect.addEventListener("change", updateCookieSource);
		cookieSourceSelect.addEventListener("input", updateCookieSource);
	}

	const savedBrowser = localStorage.getItem("browser") || "chrome";
	if (getId("browser")) {
		getId("browser").value = savedBrowser;
		getId("browser").addEventListener("change", (e) => {
			localStorage.setItem("browser", e.target.value);
		});
	}

	if (platform && platform() === "darwin") {
		const sourceBox = getId("ytdlpSourceBox");
		if (sourceBox) sourceBox.style.display = "none";
	} else {
		const ytdlpSource = localStorage.getItem("ytdlpSource") || "nightly";
		const ytdlpSourceSelect = getId("ytdlpSource");
		if (ytdlpSourceSelect) {
			ytdlpSourceSelect.value = ytdlpSource;
			ytdlpSourceSelect.addEventListener("change", () => {
				localStorage.setItem("ytdlpSource", ytdlpSourceSelect.value);
				localStorage.removeItem("ytdlp");
				ipcRenderer.send("reload");
			});
		}
	}

	function bindSelectToStorage(elementId, storageKey) {
		const el = getId(elementId);
		if (!el) return;
		const value = localStorage.getItem(storageKey);
		if (value) el.value = value;

		const updateVal = (e) => localStorage.setItem(storageKey, e.target.value);
		el.addEventListener("change", updateVal);
		el.addEventListener("input", updateVal);
	}

	bindSelectToStorage("preferredVideoQuality", "preferredVideoQuality");
	bindSelectToStorage("preferredAudioQuality", "preferredAudioQuality");
	bindSelectToStorage("preferredVideoCodec", "preferredVideoCodec");

	// Proxy Setting Updates
	const proxyEl = getId("proxyTxt");
	if (proxyEl) {
		const savedProxy = localStorage.getItem("proxy");
		if (savedProxy) proxyEl.value = savedProxy;
		const updateProxy = (e) => localStorage.setItem("proxy", e.target.value);
		proxyEl.addEventListener("change", updateProxy);
		proxyEl.addEventListener("input", updateProxy);
	}

	// Custom yt-dlp arguments
	const ytDlpArgsInput = getId("customArgsInput");
	if (ytDlpArgsInput) {
		let customYtDlpArgs = localStorage.getItem("customYtDlpArgs");
		if (customYtDlpArgs) {
			ytDlpArgsInput.value = customYtDlpArgs;
			ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
		}
		const updateArgs = () => {
			localStorage.setItem("customYtDlpArgs", ytDlpArgsInput.value.trim());
			ytDlpArgsInput.style.height = "auto";
			ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
		};
		ytDlpArgsInput.addEventListener("input", updateArgs);
		ytDlpArgsInput.addEventListener("change", updateArgs);
	}

	getId("learnMoreYtdlpArgs")?.addEventListener("click", () => {
		shell.openExternal(
			"https://github.com/aandrew-me/ytDownloader/wiki/Custom-yt%E2%80%90dlp-options",
		);
	});

	getId("learnMoreCookies")?.addEventListener("click", () => {
		shell.openExternal("https://github.com/aandrew-me/ytDownloader/wiki/Cookies-Guide");
	});

	getId("learnMoreOutputTemplates")?.addEventListener("click", () => {
		shell.openExternal("https://github.com/yt-dlp/yt-dlp#output-template");
	});

	getId("restart")?.addEventListener("click", () => {
		ipcRenderer.send("reload");
	});

	// Dynamic configuration fields abstractions helper function
	function bindInputToStorage(inputId, storageKey, fallbackValue, resetId) {
		const inputEl = getId(inputId);
		if (!inputEl) return;
		const savedVal = localStorage.getItem(storageKey);

		if (savedVal !== null) {
			inputEl.value = savedVal;
		}

		const updateInput = () => {
			localStorage.setItem(storageKey, inputEl.value);
		};
		inputEl.addEventListener("input", updateInput);
		inputEl.addEventListener("change", updateInput);

		if (resetId) {
			getId(resetId)?.addEventListener("click", () => {
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
	if (maxDownloadsInput) {
		if (localStorage.getItem("maxActiveDownloads")) {
			maxDownloadsInput.value = localStorage.getItem("maxActiveDownloads");
		}
		const updateMax = () => {
			const num = Number(maxDownloadsInput.value);
			const resolved = Number.isFinite(num) && num >= 1 ? String(num) : "1";
			localStorage.setItem("maxActiveDownloads", resolved);
		};
		maxDownloadsInput.addEventListener("input", updateMax);
		maxDownloadsInput.addEventListener("change", updateMax);
	}

	// UI Switches triggers
	function bindCheckboxToStorage(
		checkboxId,
		storageKey,
		checkValue = "true",
		uncheckValue = "false",
		onChangeCallback = null,
	) {
		const cb = getId(checkboxId);
		if (!cb) return;
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
}

function startPreferences() {
	initPreferencesUI();
	initPreferences();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", startPreferences);
} else {
	startPreferences();
}

document.addEventListener("translations-loaded", () => {
	if (window.i18n && typeof window.i18n.translatePage === "function") {
		window.i18n.translatePage();
	}

	if (env && env.FLATPAK_ID) {
		const flatpakEl = getId("flatpakTxt");
		if (flatpakEl) {
			flatpakEl.addEventListener("click", () => {
				shell.openExternal(
					"https://flathub.org/apps/com.github.tchx84.Flatseal",
				);
			});
			flatpakEl.style.display = "block";
		}
	}
});

ipcRenderer.on("downloadPath", (_event, pathArray) => {
	try {
		accessSync(pathArray[0], constants.W_OK);
		localStorage.setItem("downloadPath", pathArray[0]);
		const pathEl = getId("path");
		if (pathEl) pathEl.textContent = pathArray[0];
	} catch (error) {
		showPopup(
			window.i18n
				? window.i18n.__("unableToAccessDir")
				: "Unable to access directory",
			true,
		);
	}
});

ipcRenderer.on("configPath", (event, configPath) => {
	localStorage.setItem("configPath", configPath);
	const cfgPathEl = getId("configPath");
	if (cfgPathEl) cfgPathEl.textContent = configPath;
});
