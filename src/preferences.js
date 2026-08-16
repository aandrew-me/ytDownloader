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
	__dirname,
	windowsStore,
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
			const structuralSections = document.querySelectorAll(".settings-section, .dep-card");

			if (query.length > 0) {
				tabContainer.classList.add("search-active");
				tabContents.forEach((content) =>
					content.classList.add("search-override"),
				);

				structuralSections.forEach((section) => {
					const headerEl = section.querySelector(
						"#outputTemplateTxt, .title-box, .dep-title",
					);
					const headerMatches =
						headerEl && headerEl.textContent.toLowerCase().includes(query);

					const searchableItems = section.querySelectorAll(
						".prefBox, .outputTemplateItem, .ytdlpInfoItem, #ytDlpArgBox, .dep-segmented-group, .dep-options-container, .dep-sub-details, .dep-card-footer",
					);
					let visibleChildrenCount = 0;

					if (searchableItems.length > 0) {
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
					} else {
						// Fallback if section has no searchable child items directly
						const sectionText = section.textContent.toLowerCase();
						if (headerMatches || sectionText.includes(query)) {
							visibleChildrenCount = 1;
						}
					}

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
						".prefBox, .outputTemplateItem, .ytdlpInfoItem, #ytDlpArgBox, .settings-section, .dep-card, .dep-segmented-group, .dep-options-container, .dep-sub-details, .dep-card-footer",
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

	let downloadPath =
		localStorage.getItem("downloadPath") || (homedir ? join(homedir(), "Downloads") : "");
	const updateAllPathDisplays = (pathVal) => {
		document.querySelectorAll("#path, #pathPref, #pathPlaylist").forEach((el) => {
			el.textContent = pathVal;
		});
	};
	updateAllPathDisplays(downloadPath);

	getId("back")?.addEventListener("click", () => {
		flushPendingCookieSync();
		ipcRenderer.send("close-secondary");
	});

	(getId("selectLocationPref") || getId("selectLocation"))?.addEventListener("click", () => {
		ipcRenderer.send("select-location-secondary", "");
	});

	// Localization Setup
	const langSelectEl = getId("selectLanguage") || getId("select");
	const activeLang = localStorage.getItem("locale");
	if (activeLang && langSelectEl) {
		langSelectEl.value = activeLang.startsWith("en") ? "en" : activeLang;
	}

	if (langSelectEl) {
		const updateLang = async (e) => {
			const chosenLang = e.target.value;
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
			if (window.i18n && typeof window.i18n.setLocale === "function") {
				await window.i18n.setLocale(chosenLang);
			} else {
				localStorage.setItem("locale", chosenLang);
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

	function extractDomainsFromNetscape(text) {
		if (!text) return [];
		const lines = text.split("\n");
		const domains = new Set();
		for (let line of lines) {
			line = line.trim();
			if (!line) continue;
			if (line.startsWith("#HttpOnly_")) {
				line = line.replace("#HttpOnly_", "");
			} else if (line.startsWith("#")) {
				continue;
			}
			const parts = line.split(/\s+/);
			if (parts.length >= 7) {
				let domain = parts[0].trim();
				if (domain.startsWith(".")) domain = domain.substring(1);
				if (domain) domains.add(domain);
			}
		}
		return Array.from(domains);
	}

	let cookieBlocks = [];

	function loadCookieBlocks() {
		try {
			const rawBlocks = localStorage.getItem("netscapeCookieBlocks");
			if (rawBlocks) {
				const parsed = JSON.parse(rawBlocks);
				if (Array.isArray(parsed)) {
					cookieBlocks = parsed.map((item) => {
						if (typeof item === "string") {
							return { id: Date.now().toString() + Math.random(), content: item };
						}
						return item;
					});
				}
			}
		} catch (e) {
			cookieBlocks = [];
		}

		const savedNetscapeCookies = localStorage.getItem("netscapeCookies") || "";

		if (!Array.isArray(cookieBlocks) || cookieBlocks.length === 0) {
			if (savedNetscapeCookies.trim().length > 0) {
				cookieBlocks = [
					{ id: Date.now().toString(), content: savedNetscapeCookies },
				];
			} else {
				cookieBlocks = [{ id: Date.now().toString(), content: "" }];
			}
		}
	}

	let syncTimer = null;
	let cachedCookiesPath = null;

	async function getCookiesPathCached() {
		if (!cachedCookiesPath && ipcRenderer && ipcRenderer.invoke) {
			try {
				cachedCookiesPath = await ipcRenderer.invoke("get-cookies-path");
			} catch (err) {
				console.error("Failed to get cookies path:", err);
			}
		}
		return cachedCookiesPath;
	}

	async function syncCookiesToFile() {
		try {
			const cookiesPath = await getCookiesPathCached();
			if (!cookiesPath) return;

			const latestCombined = localStorage.getItem("netscapeCookies") || "";

			if (!latestCombined || !latestCombined.trim()) {
				if (fs && fs.existsSync && fs.existsSync(cookiesPath)) {
					try {
						fs.unlinkSync(cookiesPath);
					} catch (e) {
						fs.writeFileSync(cookiesPath, "", {
							encoding: "utf8",
							mode: 0o600,
						});
					}
				}
			} else {
				if (fs && fs.writeFileSync) {
					fs.writeFileSync(cookiesPath, latestCombined, {
						encoding: "utf8",
						mode: 0o600,
					});
				}
			}
		} catch (err) {
			console.error("Failed to save cookies.txt:", err);
		}
	}

	function saveAndSyncCookieBlocks(immediate = false) {
		localStorage.setItem("netscapeCookieBlocks", JSON.stringify(cookieBlocks));
		const combinedText = cookieBlocks
			.map((b) => (b && b.content ? b.content.trim() : ""))
			.filter(Boolean)
			.join("\n\n");
		localStorage.setItem("netscapeCookies", combinedText);

		if (immediate) {
			if (syncTimer) {
				clearTimeout(syncTimer);
				syncTimer = null;
			}
			syncCookiesToFile();
		} else {
			if (syncTimer) clearTimeout(syncTimer);
			syncTimer = setTimeout(() => {
				syncTimer = null;
				syncCookiesToFile();
			}, 300);
		}
	}

	function flushPendingCookieSync() {
		if (syncTimer) {
			clearTimeout(syncTimer);
			syncTimer = null;
			syncCookiesToFile();
		}
	}

	window.addEventListener("beforeunload", () => {
		flushPendingCookieSync();
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			flushPendingCookieSync();
		}
	});

	function renderCookieBlocks() {
		const container = getId("cookieBlocksContainer");
		if (!container) return;
		container.innerHTML = "";

		cookieBlocks.forEach((block, index) => {
			const domains = extractDomainsFromNetscape(block.content);
			const card = document.createElement("div");
			card.className = "cookie-block-card";

			const header = document.createElement("div");
			header.className = "cookie-block-header";

			const badge = document.createElement("span");
			badge.className = "cookie-domain-badge";
			const getNoDomainText = () =>
				window.i18n && window.i18n.loadedLanguage && window.i18n.loadedLanguage.noDomainDetected
					? window.i18n.__("noDomainDetected")
					: "No domain detected";
			if (domains.length > 0) {
				badge.textContent = `🌐 ${domains.join(", ")}`;
				badge.removeAttribute("data-translate");
			} else {
				badge.setAttribute("data-translate", "noDomainDetected");
				badge.textContent = getNoDomainText();
			}

			const removeBtn = document.createElement("button");
			removeBtn.className = "btn redBtn sm";
			removeBtn.setAttribute("data-translate", "remove");
			const removeText =
				window.i18n && window.i18n.loadedLanguage && window.i18n.loadedLanguage.remove
					? window.i18n.__("remove")
					: "Remove";
			removeBtn.textContent = removeText;
			removeBtn.addEventListener("click", () => {
				cookieBlocks.splice(index, 1);
				if (cookieBlocks.length === 0) {
					cookieBlocks.push({ id: Date.now().toString(), content: "" });
				}
				saveAndSyncCookieBlocks(true);
				renderCookieBlocks();
			});

			header.appendChild(badge);
			header.appendChild(removeBtn);

			const textarea = document.createElement("textarea");
			textarea.className = "cookie-block-textarea";
			textarea.spellcheck = false;
			textarea.setAttribute("data-translate-placeholder", "cookieBlockPlaceholder");
			const placeholderText =
				window.i18n && window.i18n.loadedLanguage && window.i18n.loadedLanguage.cookieBlockPlaceholder
					? window.i18n.__("cookieBlockPlaceholder")
					: "# Paste Netscape formatted cookies here";
			textarea.placeholder = placeholderText;
			textarea.value = block.content || "";

			textarea.addEventListener("input", (e) => {
				block.content = e.target.value;
				saveAndSyncCookieBlocks(false);
				const updatedDomains = extractDomainsFromNetscape(block.content);
				if (updatedDomains.length > 0) {
					badge.textContent = `🌐 ${updatedDomains.join(", ")}`;
					badge.removeAttribute("data-translate");
				} else {
					badge.setAttribute("data-translate", "noDomainDetected");
					badge.textContent = getNoDomainText();
				}
			});

			card.appendChild(header);
			card.appendChild(textarea);
			container.appendChild(card);
		});
	}

	getId("addCookieBlockBtn")?.addEventListener("click", () => {
		cookieBlocks.push({ id: Date.now().toString(), content: "" });
		saveAndSyncCookieBlocks(true);
		renderCookieBlocks();
	});

	getId("addCookieBlockBtn")?.addEventListener("ytdownloader-refresh-blocks", () => {
		renderCookieBlocks();
	});

	function updateCookieSourceUI(source) {
		if (source === "browser") {
			if (browserSelectBox) browserSelectBox.style.display = "flex";
			if (netscapeCookiesBox) netscapeCookiesBox.style.display = "none";
		} else if (source === "file") {
			if (browserSelectBox) browserSelectBox.style.display = "none";
			if (netscapeCookiesBox) netscapeCookiesBox.style.display = "flex";
			loadCookieBlocks();
			renderCookieBlocks();
			saveAndSyncCookieBlocks(true);
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

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function updateInputHighlight(inputId, backdropId) {
		const inputEl = getId(inputId);
		const backdropEl = getId(backdropId);
		if (!inputEl || !backdropEl) return;

		const val = inputEl.value || "";
		if (!val) {
			backdropEl.innerHTML = "";
			return;
		}

		let html = "";
		let lastIndex = 0;
		const tagRegex = /%\([^)]+\)[-+0 #]*(?:\d+)?(?:\.\d+)?[a-zA-Z]?/g;
		let match;

		while ((match = tagRegex.exec(val)) !== null) {
			if (match.index > lastIndex) {
				html += escapeHtml(val.substring(lastIndex, match.index));
			}
			html += `<span class="input-tag-highlight">${escapeHtml(match[0])}</span>`;
			lastIndex = tagRegex.lastIndex;
		}
		if (lastIndex < val.length) {
			html += escapeHtml(val.substring(lastIndex));
		}

		if (val.endsWith(" ")) {
			html += "&nbsp;";
		}

		backdropEl.innerHTML = html;
		backdropEl.scrollLeft = inputEl.scrollLeft;
	}

	// Dynamic configuration fields abstractions helper function
	function bindInputToStorage(inputId, storageKey, fallbackValue, resetId, backdropId) {
		const inputEl = getId(inputId);
		if (!inputEl) return;
		const savedVal = localStorage.getItem(storageKey);

		if (savedVal !== null) {
			inputEl.value = savedVal;
		}

		const updateInput = () => {
			localStorage.setItem(storageKey, inputEl.value);
			if (backdropId) {
				updateInputHighlight(inputId, backdropId);
			}
		};
		inputEl.addEventListener("input", updateInput);
		inputEl.addEventListener("change", updateInput);
		if (backdropId) {
			inputEl.addEventListener("scroll", () => {
				const backdrop = getId(backdropId);
				if (backdrop) backdrop.scrollLeft = inputEl.scrollLeft;
			});
			inputEl.addEventListener("keyup", () => updateInputHighlight(inputId, backdropId));
			inputEl.addEventListener("focus", () => updateInputHighlight(inputId, backdropId));
		}

		if (resetId) {
			getId(resetId)?.addEventListener("click", () => {
				inputEl.value = fallbackValue;
				localStorage.setItem(storageKey, fallbackValue);
				if (backdropId) {
					updateInputHighlight(inputId, backdropId);
				}
			});
		}

		if (backdropId) {
			updateInputHighlight(inputId, backdropId);
		}
	}

	bindInputToStorage(
		"filenameTemplateVideo",
		"filenameTemplateVideo",
		"%(title)s.%(ext)s",
		"resetFilenameTemplateVideo",
		"backdropFilenameTemplateVideo",
	);
	bindInputToStorage(
		"filenameTemplateAudio",
		"filenameTemplateAudio",
		"%(title)s.%(ext)s",
		"resetAudioFilenameTemplate",
		"backdropFilenameTemplateAudio",
	);
	bindInputToStorage(
		"filenameFormat",
		"filenameFormat",
		"%(playlist_index)s.%(title)s.%(ext)s",
		"resetFilenameFormat",
		"backdropFilenameFormat",
	);
	bindInputToStorage(
		"foldernameFormat",
		"foldernameFormat",
		"%(playlist_title)s",
		"resetFoldernameFormat",
		"backdropFoldernameFormat",
	);

	// Output template input tracker and Ctrl+Z preserving inserter
	let lastFocusedTemplateInput = getId("filenameTemplateVideo") || getId("filenameTemplateAudio");
	const templateInputIds = [
		"filenameTemplateAudio",
		"filenameTemplateVideo",
		"filenameFormat",
		"foldernameFormat",
	];

	templateInputIds.forEach((id) => {
		const el = getId(id);
		if (el) {
			el.addEventListener("focus", () => {
				lastFocusedTemplateInput = el;
			});
		}
	});

	function insertTextIntoInput(targetInput, textToInsert) {
		if (!targetInput) return;
		targetInput.focus();

		let inserted = false;
		try {
			inserted = document.execCommand("insertText", false, textToInsert);
		} catch (_) {
			inserted = false;
		}

		if (!inserted) {
			const start = targetInput.selectionStart ?? targetInput.value.length;
			const end = targetInput.selectionEnd ?? targetInput.value.length;
			targetInput.setRangeText(textToInsert, start, end, "end");
		}

		targetInput.dispatchEvent(new Event("input", { bubbles: true }));
	}

	document.querySelectorAll(".template-tag-chip").forEach((chip) => {
		chip.addEventListener("click", () => {
			const tag = chip.getAttribute("data-tag");
			if (!tag) return;
			const targetInput =
				lastFocusedTemplateInput ||
				getId("filenameTemplateVideo") ||
				getId("filenameTemplateAudio");
			insertTextIntoInput(targetInput, tag);
		});
	});

	document.querySelectorAll(".template-preset-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const preset = btn.getAttribute("data-preset");
			if (!preset) return;
			const targetInput =
				lastFocusedTemplateInput ||
				getId("filenameTemplateVideo") ||
				getId("filenameTemplateAudio");
			if (!targetInput) return;

			targetInput.focus();
			targetInput.select();
			insertTextIntoInput(targetInput, preset);
		});
	});

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

	const defaultAccel = platform() === "darwin" ? "Cmd+Shift+D" : "Ctrl+Shift+D";

	function sendHotkeyConfig() {
		const enabled = localStorage.getItem("globalHotkeyEnabled") === "true";
		const accelerator = localStorage.getItem("globalHotkeyAccelerator") || defaultAccel;
		ipcRenderer.send("useGlobalHotkey", { enabled, accelerator });
	}

	bindCheckboxToStorage(
		"globalHotkeyEnabled",
		"globalHotkeyEnabled",
		"true",
		"false",
		() => sendHotkeyConfig(),
	);

	if (localStorage.getItem("globalHotkeyEnabled") === "true") {
		sendHotkeyConfig();
	}

	// Key recorder — renders kbd chips
	const hotkeyRecorder = getId("hotkeyRecorder");
	if (hotkeyRecorder) {
		function renderHotkey(accelerator) {
			if (!accelerator) {
				const hint = window.i18n ? window.i18n.__("hotkeyClickToRecord") : "Click to record";
				hotkeyRecorder.innerHTML = `<span class="hotkey-hint">${hint}</span>`;
				return;
			}
			const displayMap = { Cmd: "⌘", Super: "⊞" };
			const parts = accelerator.split("+");
			hotkeyRecorder.innerHTML = parts
				.map((p, i) =>
					`<kbd>${displayMap[p] ?? p}</kbd>${i < parts.length - 1 ? '<span class="hotkey-plus">+</span>' : ""}`,
				)
				.join("");
		}

		renderHotkey(localStorage.getItem("globalHotkeyAccelerator") || defaultAccel);

		let cleanupActiveRecording = null;

		hotkeyRecorder.addEventListener("click", () => {
			if (cleanupActiveRecording) {
				cleanupActiveRecording();
			}

			// Unregister while recording so the current combo isn't swallowed by the OS
			ipcRenderer.send("useGlobalHotkey", { enabled: false });

			const recordingText = window.i18n ? window.i18n.__("hotkeyRecording") : "Press keys...";
			hotkeyRecorder.innerHTML = `<span class="hotkey-hint">${recordingText}</span>`;
			hotkeyRecorder.classList.add("recording");

			function stopRecording() {
				hotkeyRecorder.classList.remove("recording");
				document.removeEventListener("keydown", onKeyDown, true);
				hotkeyRecorder.removeEventListener("blur", onBlur);
				cleanupActiveRecording = null;
			}

			function onKeyDown(e) {
				e.preventDefault();
				e.stopPropagation();

				const modKeys = ["Control", "Alt", "Shift", "Meta"];
				if (modKeys.includes(e.key)) return; // wait for a non-modifier

				const parts = [];
				if (e.ctrlKey) parts.push("Ctrl");
				if (e.altKey) parts.push("Alt");
				if (e.shiftKey) parts.push("Shift");
				if (e.metaKey) parts.push(platform() === "darwin" ? "Cmd" : "Super");

				const keyMap = {
					" ": "Space", ArrowUp: "Up", ArrowDown: "Down",
					ArrowLeft: "Left", ArrowRight: "Right",
					Enter: "Return", Escape: "Escape", Delete: "Delete",
					Backspace: "Backspace", Tab: "Tab",
					Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
					Insert: "Insert",
				};
				const mapped = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
				const isFKey = /^F\d+$/.test(mapped);

				// Require at least one modifier unless it's an F-key
				if (!isFKey && parts.length === 0) return;

				parts.push(mapped);
				const accelerator = parts.join("+");

				localStorage.setItem("globalHotkeyAccelerator", accelerator);
				stopRecording();
				renderHotkey(accelerator);
				sendHotkeyConfig();
			}

			function onBlur() {
				// Cancelled — restore chips and re-register the old hotkey
				stopRecording();
				renderHotkey(localStorage.getItem("globalHotkeyAccelerator") || defaultAccel);
				sendHotkeyConfig();
			}

			cleanupActiveRecording = () => {
				document.removeEventListener("keydown", onKeyDown, true);
				hotkeyRecorder.removeEventListener("blur", onBlur);
				cleanupActiveRecording = null;
			};

			document.addEventListener("keydown", onKeyDown, true);
			hotkeyRecorder.addEventListener("blur", onBlur);
		});
	}

	bindCheckboxToStorage("autoUpdateDisabled", "autoUpdate", "false", "true");
	bindCheckboxToStorage("showMoreFormats", "showMoreFormats", "true", "false");

	initDependenciesTab();
}

function initDependenciesTab() {
	const depYtdlpSource = getId("depYtdlpSource");
	const depYtdlpChannel = getId("depYtdlpChannel");
	const depYtdlpChannelBox = getId("depYtdlpChannelBox");
	const depFfmpegSource = getId("depFfmpegSource");

	const rawYtdlpSource = localStorage.getItem("ytdlpSource") || "bundled";
	const currentYtdlpSource = rawYtdlpSource === "system" ? "system" : "bundled";
	const currentYtdlpChannel = localStorage.getItem("ytdlpChannel") || (["nightly", "stable", "master"].includes(rawYtdlpSource) ? rawYtdlpSource : "nightly");
	const currentFfmpegSource = localStorage.getItem("ffmpegSource") || "bundled";

	if (depYtdlpSource) {
		depYtdlpSource.value = currentYtdlpSource;
	}
	if (depYtdlpChannel) {
		depYtdlpChannel.value = currentYtdlpChannel;
	}
	if (depYtdlpChannelBox) {
		depYtdlpChannelBox.style.display = currentYtdlpSource === "bundled" ? "block" : "none";
	}
	if (depFfmpegSource) {
		depFfmpegSource.value = currentFfmpegSource;
	}

	const notFoundText = () => (window.i18n ? window.i18n.__("notFound") : "Not found");
	const isTestMode = window.electronAPI && window.electronAPI.isTest;

	function checkYtdlp() {
		const source = depYtdlpSource ? depYtdlpSource.value : currentYtdlpSource;
		const channel = depYtdlpChannel ? depYtdlpChannel.value : currentYtdlpChannel;

		const versionEl = getId("depYtdlpVersion");
		const pathEl = getId("depYtdlpPath");
		const legacyVerEl = getId("ytDlpVersion");
		const legacyPathEl = getId("ytDlpPath");

		const setUI = (versionText, pathText, isError = false) => {
			if (versionEl) {
				versionEl.textContent = versionText;
				versionEl.style.color = isError ? "var(--red, #ff5555)" : "";
			}
			if (pathEl) pathEl.textContent = pathText;
			if (legacyVerEl) legacyVerEl.textContent = versionText;
			if (legacyPathEl) legacyPathEl.textContent = pathText;
		};

		if (isTestMode) {
			setUI(source === "system" ? "2024.12.13 (system)" : `2024.12.13 (${channel})`, "mock-ytdlp", false);
			return;
		}

		if (source === "system") {
			if (!exec || !platform) {
				setUI(notFoundText(), "", true);
				return;
			}
			const cmd = platform() === "win32" ? "where yt-dlp" : "which yt-dlp";
			exec(cmd, (err, stdout) => {
				if (err || !stdout || !stdout.trim()) {
					setUI(notFoundText(), notFoundText(), true);
				} else {
					const sysPath = stdout.trim().split(/\r?\n/)[0].trim();
					exec(`"${sysPath}" --version`, (verErr, verOut) => {
						if (verErr || !verOut) {
							setUI(notFoundText(), sysPath, true);
						} else {
							setUI(verOut.trim(), sysPath, false);
						}
					});
				}
			});
		} else {
			const savedPath = localStorage.getItem("ytdlp");
			let targetPath = savedPath;
			if (!targetPath && homedir) {
				const exeName = platform && platform() === "win32" ? "ytdlp.exe" : "ytdlp";
				targetPath = join(homedir(), ".ytDownloader", exeName);
			}
			if (targetPath && fs && fs.existsSync && fs.existsSync(targetPath)) {
				exec(`"${targetPath}" --version`, (err, stdout) => {
					if (!err && stdout) {
						setUI(`${stdout.trim()} (${channel})`, targetPath, false);
					} else {
						setUI(`Bundled (${channel})`, targetPath, false);
					}
				});
			} else {
				setUI(`Bundled (${channel})`, targetPath || "", false);
			}
		}
	}

	function checkFfmpegAndFfprobe() {
		const source = depFfmpegSource ? depFfmpegSource.value : currentFfmpegSource;

		const ffmpegVerEl = getId("depFfmpegVersion");
		const ffprobeVerEl = getId("depFfprobeVersion");
		const ffmpegPathEl = getId("depFfmpegPath");

		const setFfmpegUI = (ver, p, isErr) => {
			if (ffmpegVerEl) {
				ffmpegVerEl.textContent = ver;
				ffmpegVerEl.style.color = isErr ? "var(--red, #ff5555)" : "";
			}
			if (ffmpegPathEl) ffmpegPathEl.textContent = p;
		};
		const setFfprobeUI = (ver, isErr) => {
			if (ffprobeVerEl) {
				ffprobeVerEl.textContent = ver;
				ffprobeVerEl.style.color = isErr ? "var(--red, #ff5555)" : "";
			}
		};

		if (isTestMode) {
			setFfmpegUI("6.0", "mock-ffmpeg", false);
			setFfprobeUI("6.0", false);
			return;
		}

		if (source === "system") {
			if (!exec || !platform) {
				setFfmpegUI(notFoundText(), "", true);
				setFfprobeUI(notFoundText(), true);
				return;
			}
			const ffmpegCmd = platform() === "win32" ? "where ffmpeg" : "which ffmpeg";
			exec(ffmpegCmd, (err, stdout) => {
				if (err || !stdout || !stdout.trim()) {
					setFfmpegUI(notFoundText(), notFoundText(), true);
				} else {
					const sysPath = stdout.trim().split(/\r?\n/)[0].trim();
					exec(`"${sysPath}" -version`, (verErr, verOut) => {
						if (verErr || !verOut) {
							setFfmpegUI(notFoundText(), sysPath, true);
						} else {
							const firstLine = verOut.trim().split(/\r?\n/)[0] || "";
							const versionMatch = firstLine.match(/ffmpeg version (\S+)/i);
							setFfmpegUI(versionMatch ? versionMatch[1] : firstLine, sysPath, false);
						}
					});
				}
			});

			const ffprobeCmd = platform() === "win32" ? "where ffprobe" : "which ffprobe";
			exec(ffprobeCmd, (err, stdout) => {
				if (err || !stdout || !stdout.trim()) {
					setFfprobeUI(notFoundText(), true);
				} else {
					const sysPath = stdout.trim().split(/\r?\n/)[0].trim();
					exec(`"${sysPath}" -version`, (verErr, verOut) => {
						if (verErr || !verOut) {
							setFfprobeUI(notFoundText(), true);
						} else {
							const firstLine = verOut.trim().split(/\r?\n/)[0] || "";
							const versionMatch = firstLine.match(/ffprobe version (\S+)/i);
							setFfprobeUI(versionMatch ? versionMatch[1] : firstLine, false);
						}
					});
				}
			});
		} else {
			let bundledFfmpegBin = "";
			const exeName = platform && platform() === "win32" ? "ffmpeg.exe" : "ffmpeg";
			if (windowsStore && homedir) {
				bundledFfmpegBin = join(homedir(), ".ytDownloader", "ffmpeg", "bin", exeName);
			} else if (__dirname) {
				bundledFfmpegBin = join(__dirname, "..", "ffmpeg", "bin", exeName);
				if (!fs.existsSync(bundledFfmpegBin) && homedir) {
					bundledFfmpegBin = join(homedir(), ".ytDownloader", "ffmpeg", "bin", exeName);
				}
			} else if (homedir) {
				bundledFfmpegBin = join(homedir(), ".ytDownloader", "ffmpeg", "bin", exeName);
			}
			if (bundledFfmpegBin && fs && fs.existsSync && fs.existsSync(bundledFfmpegBin)) {
				exec(`"${bundledFfmpegBin}" -version`, (err, stdout) => {
					if (!err && stdout) {
						const firstLine = stdout.trim().split(/\r?\n/)[0] || "";
						const match = firstLine.match(/ffmpeg version (\S+)/i);
						setFfmpegUI(match ? match[1] : "Bundled", bundledFfmpegBin, false);
					} else {
						setFfmpegUI("Bundled", bundledFfmpegBin, false);
					}
				});
				const bundledFfprobeBin = bundledFfmpegBin.replace(/ffmpeg(\.exe)?$/, "ffprobe$1");
				if (fs.existsSync(bundledFfprobeBin)) {
					exec(`"${bundledFfprobeBin}" -version`, (err, stdout) => {
						if (!err && stdout) {
							const firstLine = stdout.trim().split(/\r?\n/)[0] || "";
							const match = firstLine.match(/ffprobe version (\S+)/i);
							setFfprobeUI(match ? match[1] : "Bundled", false);
						} else {
							setFfprobeUI("Bundled", false);
						}
					});
				} else {
					setFfprobeUI("Bundled", false);
				}
			} else {
				setFfmpegUI("Bundled", bundledFfmpegBin || "", false);
				setFfprobeUI("Bundled", false);
			}
		}
	}

	function checkJsRuntime() {
		const versionEl = getId("depJsRuntimeVersion");
		if (versionEl) {
			if (typeof process !== "undefined" && process.version) {
				versionEl.textContent = process.version;
			} else if (exec) {
				exec("node -v", (err, stdout) => {
					if (!err && stdout) {
						versionEl.textContent = stdout.trim();
					} else {
						versionEl.textContent = "Node.js";
					}
				});
			} else {
				versionEl.textContent = "Node.js";
			}
		}
	}

	function switchYtdlpChannel(channelVal) {
		if (isTestMode) {
			checkYtdlp();
			return;
		}

		const versionEl = getId("depYtdlpVersion");
		if (versionEl) versionEl.textContent = `Installing (${channelVal})...`;

		let targetPath = localStorage.getItem("ytdlp");
		if (!targetPath && homedir) {
			const exeName = platform && platform() === "win32" ? "ytdlp.exe" : "ytdlp";
			targetPath = join(homedir(), ".ytDownloader", exeName);
		}

		if (window.electronAPI && window.electronAPI.YTDlpWrap && typeof window.electronAPI.YTDlpWrap.downloadFromGithub === "function") {
			window.electronAPI.YTDlpWrap.downloadFromGithub(
				targetPath,
				undefined,
				undefined,
				(progress) => {
					if (versionEl) {
						versionEl.textContent = `Downloading (${channelVal}): ${(progress * 100).toFixed(0)}%`;
					}
				},
				channelVal
			).then(() => {
				localStorage.setItem("ytdlp", targetPath);
				checkYtdlp();
				window.dispatchEvent(new CustomEvent("ytdownloader-reload-binaries"));
			}).catch((err) => {
				console.error("Failed to download yt-dlp for channel:", channelVal, err);
				checkYtdlp();
			});
		} else {
			checkYtdlp();
		}
	}

	if (depYtdlpSource) {
		depYtdlpSource.addEventListener("change", () => {
			const sourceVal = depYtdlpSource.value;
			localStorage.setItem("ytdlpSource", sourceVal);
			if (sourceVal === "system") {
				localStorage.removeItem("ytdlp");
			}
			syncSegmentedUI("depYtdlpSegmented", depYtdlpSource);
			if (sourceVal === "bundled") {
				if (depYtdlpChannelBox) depYtdlpChannelBox.style.display = "block";
				let targetPath = localStorage.getItem("ytdlp");
				if (!targetPath && homedir) {
					const exeName = platform && platform() === "win32" ? "ytdlp.exe" : "ytdlp";
					targetPath = join(homedir(), ".ytDownloader", exeName);
				}
				if (targetPath && fs && fs.existsSync && fs.existsSync(targetPath)) {
					checkYtdlp();
					window.dispatchEvent(new CustomEvent("ytdownloader-reload-binaries"));
				} else {
					// switchYtdlpChannel starts async download and dispatches ytdownloader-reload-binaries in its .then() when finished
					switchYtdlpChannel(depYtdlpChannel ? depYtdlpChannel.value : "nightly");
				}
			} else {
				if (depYtdlpChannelBox) depYtdlpChannelBox.style.display = "none";
				checkYtdlp();
				window.dispatchEvent(new CustomEvent("ytdownloader-reload-binaries"));
			}
		});
	}

	if (depYtdlpChannel) {
		depYtdlpChannel.addEventListener("change", () => {
			const channelVal = depYtdlpChannel.value;
			localStorage.setItem("ytdlpChannel", channelVal);
			syncChannelOptionUI(depYtdlpChannel);
			switchYtdlpChannel(channelVal);
		});
	}

	if (depFfmpegSource) {
		depFfmpegSource.addEventListener("change", () => {
			const sourceVal = depFfmpegSource.value;
			localStorage.setItem("ffmpegSource", sourceVal);
			syncSegmentedUI("depFfmpegSegmented", depFfmpegSource);
			checkFfmpegAndFfprobe();
			window.dispatchEvent(new CustomEvent("ytdownloader-reload-binaries"));
		});
	}

	function syncSegmentedUI(containerId, selectEl) {
		const container = getId(containerId);
		if (!container || !selectEl) return;
		const buttons = container.querySelectorAll(".dep-segment-btn");
		buttons.forEach((btn) => {
			if (btn.dataset.value === selectEl.value) {
				btn.classList.add("active");
			} else {
				btn.classList.remove("active");
			}
		});
	}

	function syncChannelOptionUI(selectEl) {
		const list = document.querySelector("#depYtdlpChannelBox .dep-option-list");
		if (!list || !selectEl) return;
		const items = list.querySelectorAll(".dep-option-item");
		items.forEach((item) => {
			if (item.dataset.channel === selectEl.value) {
				item.classList.add("active");
			} else {
				item.classList.remove("active");
			}
		});
	}

	function setupSegmentedClick(containerId, selectEl) {
		const container = getId(containerId);
		if (!container || !selectEl) return;
		const buttons = container.querySelectorAll(".dep-segment-btn");
		buttons.forEach((btn) => {
			btn.addEventListener("click", () => {
				const val = btn.dataset.value;
				if (val && selectEl.value !== val) {
					selectEl.value = val;
					selectEl.dispatchEvent(new Event("change"));
				}
			});
		});
	}

	function setupChannelOptionsClick(selectEl) {
		const list = document.querySelector("#depYtdlpChannelBox .dep-option-list");
		if (!list || !selectEl) return;
		const items = list.querySelectorAll(".dep-option-item");
		items.forEach((item) => {
			item.addEventListener("click", () => {
				const channel = item.dataset.channel;
				if (channel && selectEl.value !== channel) {
					selectEl.value = channel;
					selectEl.dispatchEvent(new Event("change"));
				}
			});
		});
	}

	setupSegmentedClick("depYtdlpSegmented", depYtdlpSource);
	setupSegmentedClick("depFfmpegSegmented", depFfmpegSource);
	setupChannelOptionsClick(depYtdlpChannel);

	syncSegmentedUI("depYtdlpSegmented", depYtdlpSource);
	syncSegmentedUI("depFfmpegSegmented", depFfmpegSource);
	syncChannelOptionUI(depYtdlpChannel);

	getId("linkYtdlpGithub")?.addEventListener("click", (e) => {
		e.preventDefault();
		if (shell && shell.openExternal) shell.openExternal("https://github.com/yt-dlp/yt-dlp");
	});
	getId("linkFfmpegWebsite")?.addEventListener("click", (e) => {
		e.preventDefault();
		if (shell && shell.openExternal) shell.openExternal("https://ffmpeg.org");
	});

	checkYtdlp();
	checkFfmpegAndFfprobe();
	checkJsRuntime();
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
	const cookieContainer = getId("cookieBlocksContainer");
	if (cookieContainer && cookieContainer.children.length > 0) {
		const cookieSourceSelect = getId("cookieSource");
		if (cookieSourceSelect && cookieSourceSelect.value === "file") {
			// Trigger re-render of cookie blocks with translated strings
			const addBtn = getId("addCookieBlockBtn");
			if (addBtn) addBtn.dispatchEvent(new Event("ytdownloader-refresh-blocks"));
		}
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
		document.querySelectorAll("#path, #pathPref, #pathPlaylist").forEach((el) => {
			el.textContent = pathArray[0];
		});
	} catch (error) {
		showPopup(
			window.i18n
				? window.i18n.__("unableToAccessDir")
				: "Unable to access directory",
			true,
		);
	}
});
