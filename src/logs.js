export const MAX_LOGS = 500;
export const logBuffer = [];

export function formatLogArg(arg) {
	if (arg instanceof Error) {
		return arg.stack || `${arg.name}: ${arg.message}`;
	}

	if (typeof arg === "object" && arg !== null) {
		// Detect and condense yt-dlp fetch metadata
		if (Array.isArray(arg.formats) && (arg.id || arg.extractor || arg.extractor_key || arg.webpage_url)) {
			return `[yt-dlp video info] ID: ${arg.id || "N/A"} | Title: "${arg.title || "Unknown"}" | Extractor: ${arg.extractor || arg.extractor_key || "unknown"} | Duration: ${arg.duration != null ? arg.duration + "s" : "N/A"} | Formats: ${arg.formats.length}`;
		}

		// Detect and condense playlist metadata
		if (arg._type === "playlist" || (Array.isArray(arg.entries) && arg.title)) {
			return `[yt-dlp playlist info] Title: "${arg.title || "Unknown"}" | Entries: ${arg.entries ? arg.entries.length : 0}`;
		}

		try {
			const str = JSON.stringify(arg);

			return str.length > 1500 ? str.slice(0, 1500) + "... [truncated]" : str;
		} catch (_) {
			return String(arg);
		}
	}
	if (typeof arg === "string") {
		return arg.length > 2000 ? arg.slice(0, 2000) + "... [truncated]" : arg;
	}
	return String(arg);
}

export function addLogEntry(level, args, source = "renderer", timestamp = null) {
	const time = timestamp || new Date().toLocaleTimeString();
	const message = Array.isArray(args) ? args.map(formatLogArg).join(" ") : formatLogArg(args);
	const entry = { time, level, source, message };
	logBuffer.push(entry);
	if (logBuffer.length > MAX_LOGS) {
		logBuffer.shift();
	}
	if (typeof window !== "undefined" && typeof window.appendLogEntryToUI === "function") {
		window.appendLogEntryToUI(entry);
	}
	return entry;
}

// Hook console methods early
if (typeof console !== "undefined") {
	const origLog = console.log.bind(console);
	const origWarn = console.warn.bind(console);
	const origError = console.error.bind(console);
	const origInfo = console.info.bind(console);

	console.log = (...args) => {
		origLog(...args);
		addLogEntry("log", args, "renderer");
	};
	console.info = (...args) => {
		origInfo(...args);
		addLogEntry("info", args, "renderer");
	};
	console.warn = (...args) => {
		origWarn(...args);
		addLogEntry("warn", args, "renderer");
	};
	console.error = (...args) => {
		origError(...args);
		addLogEntry("error", args, "renderer");
	};
}

export function getSystemDiagnostics() {
	if (typeof window === "undefined") {
		return { version: "unknown", platform: "unknown", ytDlpPath: "N/A", ffmpegPath: "N/A", jsRuntimePath: "N/A" };
	}

	const os = window.electronAPI?.os;
	const basePlat = typeof os?.platform === "function" ? os.platform() : (navigator?.platform || "unknown");
	const arch = typeof os?.arch === "function" ? os.arch() : "";
	const release = typeof os?.release === "function" ? os.release() : "";
	const extra = [arch, release].filter(Boolean).join(", ");
	const plat = extra ? `${basePlat} (${extra})` : basePlat;
	let version = "4.0.2";
	try {
		const pkgPath = window.electronAPI?.path?.join(window.electronAPI.__dirname, "../package.json");
		if (pkgPath && window.electronAPI?.readFileSync) {
			const pkg = JSON.parse(window.electronAPI.readFileSync(pkgPath, "utf8"));
			if (pkg.version) version = pkg.version;
		}
	} catch (_) {}

	const ytDlpPath = window.AppBinaries?.ytDlpPath || window.app?.state?.ytDlpPath || "Not resolved";
	const ffmpegPath = window.AppBinaries?.ffmpegPath || window.app?.state?.ffmpegPath || "Not resolved";
	const jsRuntimePath = window.AppBinaries?.jsRuntimePath || window.app?.state?.jsRuntimePath || "Not resolved";

	return {
		version,
		platform: plat,
		ytDlpPath,
		ffmpegPath,
		jsRuntimePath,
	};
}

export function formatLogsText(entries) {
	return entries
		.map((e) => `[${e.time}] [${e.source || "renderer"}] [${e.level.toUpperCase()}] ${e.message}`)
		.join("\n");
}

export function buildIssueMarkdown(diag, entries) {
	const logsText = formatLogsText(entries);

	return [
		"### Environment",
		`- **ytDownloader Version:** v${diag.version}`,
		`- **Platform / OS:** ${diag.platform}`,
		`- **yt-dlp Path:** \`${diag.ytDlpPath}\``,
		`- **FFmpeg Path:** \`${diag.ffmpegPath}\``,
		`- **JS Runtime:** \`${diag.jsRuntimePath}\``,
		"",
		"### Description",
		"<!-- Please describe the issue and what you were trying to download or do -->",
		"",
		"### Steps to Reproduce",
		"1. ",
		"2. ",
		"",
		"### Logs",
		"```text",
		logsText || "No logs recorded.",
		"```",
	].join("\n");
}

export function buildGitHubIssueUrl(diag, _entries = [], repo = "aandrew-me/ytDownloader") {
	const title = "[Bug]: ";

	const body = [
		"### Environment",
		`- **ytDownloader Version:** v${diag.version}`,
		`- **Platform / OS:** ${diag.platform}`,
		`- **yt-dlp Path:** \`${diag.ytDlpPath}\``,
		`- **FFmpeg Path:** \`${diag.ffmpegPath}\``,
		`- **JS Runtime:** \`${diag.jsRuntimePath}\``,
		"",
		"### Description",
		"<!-- Please describe the issue and what you were trying to download or do -->",
		"",
		"### Steps to Reproduce",
		"1. ",
		"2. ",
		"",
		"### Relevant Logs",
		"<!-- Full logs & diagnostics were copied to your clipboard. Paste them below (Ctrl+V / Cmd+V) -->",
		"```text",
		"",
		"```",
	].join("\n");

	return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function showToast(msg) {
	const toast = document.getElementById("logsToast");
	if (!toast) return;
	toast.textContent = msg;
	toast.style.display = "block";
	clearTimeout(toast._timeout);
	toast._timeout = setTimeout(() => {
		toast.style.display = "none";
	}, 2800);
}

export function updateLogsUI() {
	if (typeof document === "undefined") return;

	const diag = getSystemDiagnostics();
	const sysBar = document.getElementById("logsSysInfoBar");
	if (sysBar) {
		sysBar.innerHTML = `
			<div class="logs-sys-item"><strong>App:</strong> v${escapeHtml(diag.version)}</div>
			<div class="logs-sys-item"><strong>OS:</strong> ${escapeHtml(diag.platform)}</div>
			<div class="logs-sys-item" title="${escapeHtml(diag.ytDlpPath)}"><strong>yt-dlp:</strong> ${diag.ytDlpPath !== "Not resolved" ? "✓ Ready" : "✗ Missing"}</div>
			<div class="logs-sys-item" title="${escapeHtml(diag.ffmpegPath)}"><strong>FFmpeg:</strong> ${diag.ffmpegPath !== "Not resolved" ? "✓ Ready" : "✗ Missing"}</div>
			<div class="logs-sys-item" title="${escapeHtml(diag.jsRuntimePath)}"><strong>JS Runtime:</strong> ${diag.jsRuntimePath !== "Not resolved" ? "✓ Ready" : "✗ Missing"}</div>
		`;
	}

	const badge = document.getElementById("logsCountBadge");
	if (badge) {
		badge.textContent = `${logBuffer.length} entries`;
	}

	const consoleEl = document.getElementById("logsConsole");
	if (!consoleEl) return;

	if (logBuffer.length === 0) {
		const emptyText = window.i18n?.__ ? window.i18n.__("noLogsYet") : "No logs recorded yet.";
		consoleEl.innerHTML = `<div class="logs-empty" id="logsEmptyState">${escapeHtml(emptyText)}</div>`;
		return;
	}

	consoleEl.innerHTML = logBuffer
		.map(
			(entry) =>
				`<div class="log-entry log-entry-${escapeHtml(entry.level)}">` +
				`<span class="log-time">${escapeHtml(entry.time)}</span>` +
				(entry.source === "main" ? `<span class="log-source">MAIN</span>` : "") +
				`<span class="log-level log-level-${escapeHtml(entry.level)}">${escapeHtml(entry.level)}</span>` +
				`<span class="log-msg">${escapeHtml(entry.message)}</span>` +
				`</div>`,
		)
		.join("");

	consoleEl.scrollTop = consoleEl.scrollHeight;
}

export function appendLogEntryToUI(entry) {
	if (typeof document === "undefined") return;
	const viewLogs = document.getElementById("view-logs");
	if (!viewLogs || !viewLogs.classList.contains("active")) return;

	const consoleEl = document.getElementById("logsConsole");
	if (!consoleEl) return;

	const empty = document.getElementById("logsEmptyState");
	if (empty) empty.remove();

	const row = document.createElement("div");
	row.className = `log-entry log-entry-${entry.level}`;
	row.innerHTML =
		`<span class="log-time">${escapeHtml(entry.time)}</span>` +
		(entry.source === "main" ? `<span class="log-source">MAIN</span>` : "") +
		`<span class="log-level log-level-${escapeHtml(entry.level)}">${escapeHtml(entry.level)}</span>` +
		`<span class="log-msg">${escapeHtml(entry.message)}</span>`;

	consoleEl.appendChild(row);
	while (consoleEl.children.length > MAX_LOGS) {
		consoleEl.firstElementChild?.remove();
	}
	consoleEl.scrollTop = consoleEl.scrollHeight;

	const badge = document.getElementById("logsCountBadge");
	if (badge) {
		badge.textContent = `${logBuffer.length} entries`;
	}
}

if (typeof window !== "undefined") {
	window.updateLogsUI = updateLogsUI;
	window.appendLogEntryToUI = appendLogEntryToUI;

	// Listen for main process logs via IPC
	if (window.electronAPI?.ipcRenderer) {
		window.electronAPI.ipcRenderer.on("main-log-entry", (_event, entry) => {
			addLogEntry(entry.level || "log", entry.message, "main", entry.time);
		});

		window.electronAPI.ipcRenderer
			.invoke("get-main-logs")
			.then((mainLogs) => {
				if (Array.isArray(mainLogs)) {
					for (const item of mainLogs) {
						addLogEntry(item.level || "log", item.message, "main", item.time);
					}
				}
			})
			.catch(() => {});
	}

	document.addEventListener("DOMContentLoaded", () => {
		document.getElementById("reportIssueBtn")?.addEventListener("click", async () => {
			const diag = getSystemDiagnostics();
			const fullReport = buildIssueMarkdown(diag, logBuffer);

			// Copy full report to clipboard
			try {
				if (window.electronAPI?.clipboard?.writeText) {
					await window.electronAPI.clipboard.writeText(fullReport);
				} else if (navigator?.clipboard?.writeText) {
					await navigator.clipboard.writeText(fullReport);
				}
			} catch (_) {}

			const url = buildGitHubIssueUrl(diag, logBuffer);
			if (window.electronAPI?.shell?.openExternal) {
				window.electronAPI.shell.openExternal(url);
			} else {
				window.open(url, "_blank");
			}

			const copiedMsg = window.i18n?.__ ? window.i18n.__("logsCopied") : "Logs copied to clipboard!";
			const openMsg = window.i18n?.__ ? window.i18n.__("openingGithub") : "Opening GitHub Issues...";
			showToast(`${copiedMsg} ${openMsg}`);
		});

		document.getElementById("copyLogsBtn")?.addEventListener("click", async () => {
			const text = formatLogsText(logBuffer);
			try {
				if (window.electronAPI?.clipboard?.writeText) {
					await window.electronAPI.clipboard.writeText(text);
				} else if (navigator?.clipboard?.writeText) {
					await navigator.clipboard.writeText(text);
				}
			} catch (_) {}

			const copiedMsg = window.i18n?.__ ? window.i18n.__("logsCopied") : "Logs copied to clipboard!";
			showToast(copiedMsg);
		});

		document.getElementById("clearLogsBtn")?.addEventListener("click", () => {
			logBuffer.length = 0;
			updateLogsUI();
		});
	});
}

