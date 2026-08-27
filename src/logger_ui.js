/**
 * Logs UI Controller
 */

import { getId } from "./utils.js";

let allLogs = [];
let currentFilter = "ALL";
let searchTerm = "";
let showDetails = false;
let isInitialized = false;

function escapeHtml(str) {
	if (!str) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function formatTimestamp(timestamp) {
	if (!timestamp) return "";
	const d = new Date(timestamp);
	const day = d.getDate();
	const month = d.toLocaleString("default", { month: "short" });
	let hours = d.getHours();
	const minutes = String(d.getMinutes()).padStart(2, "0");
	const seconds = String(d.getSeconds()).padStart(2, "0");
	const ampm = hours >= 12 ? "pm" : "am";
	hours = hours % 12 || 12;
	return `${day} ${month}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

function t(key, fallback) {
	if (window.i18n && typeof window.i18n.__ === "function") {
		const res = window.i18n.__(key);
		if (res && res !== key) return res;
	}
	return fallback;
}

export async function loadLogs() {
	if (!window.electronAPI) return;
	try {
		const logs = await (window.electronAPI.logger?.getLogs() ||
			window.electronAPI.ipcRenderer.invoke("get-logs"));
		allLogs = Array.isArray(logs) ? logs : [];
		renderLogs();
	} catch (error) {
		console.error("Failed to load logs:", error);
	}
}

export function renderLogs() {
	const container = getId("logListContainer");
	if (!container) return;

	let filtered = [...allLogs];

	// Filter by level
	if (currentFilter !== "ALL") {
		filtered = filtered.filter((item) => item.level === currentFilter);
	}

	// Filter by search term
	if (searchTerm.trim()) {
		const term = searchTerm.toLowerCase();
		filtered = filtered.filter(
			(item) =>
				(item.message && item.message.toLowerCase().includes(term)) ||
				(item.url && item.url.toLowerCase().includes(term)) ||
				(item.command && item.command.toLowerCase().includes(term)) ||
				(item.details && item.details.toLowerCase().includes(term))
		);
	}

	container.innerHTML = "";

	if (filtered.length === 0) {
		const emptyState = document.createElement("div");
		emptyState.className = "log-empty-state";
		emptyState.innerHTML = `
			<svg viewBox="0 0 24 24" class="log-empty-icon">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
				<polyline points="14 2 14 8 20 8"></polyline>
				<line x1="16" y1="13" x2="8" y2="13"></line>
				<line x1="16" y1="17" x2="8" y2="17"></line>
				<polyline points="10 9 9 9 8 9"></polyline>
			</svg>
			<p data-translate="noLogsPlaceholder">${t("noLogsPlaceholder", "No logs recorded for this session")}</p>
		`;
		container.appendChild(emptyState);
		return;
	}

	const fragment = document.createDocumentFragment();

	filtered.forEach((item) => {
		const card = document.createElement("div");
		card.className = `log-card log-level-${(item.level || "info").toLowerCase()}`;
		card.dataset.id = item.id;

		let badgeLabel = item.level;
		let badgeIcon = "";

		if (item.level === "COMMAND") {
			badgeLabel = "COMMAND";
			badgeIcon = `<svg viewBox="0 0 24 24" class="log-badge-icon"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`;
		} else if (item.level === "INFO") {
			badgeIcon = `<svg viewBox="0 0 24 24" class="log-badge-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
		} else if (item.level === "SUCCESS") {
			badgeIcon = `<svg viewBox="0 0 24 24" class="log-badge-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
		} else if (item.level === "ERROR") {
			badgeIcon = `<svg viewBox="0 0 24 24" class="log-badge-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
		} else if (item.level === "DETAIL") {
			badgeIcon = `<svg viewBox="0 0 24 24" class="log-badge-icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
		}

		const timeFormatted = formatTimestamp(item.timestamp);

		let contentHtml = "";
		if (item.command) {
			contentHtml += `<div class="log-command-line"><code>${escapeHtml(item.command)}</code></div>`;
		} else if (item.message) {
			contentHtml += `<div class="log-message-line">${escapeHtml(item.message)}</div>`;
		}

		if (item.url) {
			contentHtml += `<div class="log-url-line"><span class="log-url-label">URL:</span> <span class="log-url-value">${escapeHtml(item.url)}</span></div>`;
		}

		const hasDetails = Boolean(item.details && item.details.trim());
		const shouldShowDetail = showDetails && hasDetails;

		if (hasDetails) {
			contentHtml += `
				<div class="log-details-container ${shouldShowDetail ? "expanded" : "collapsed"}">
					<pre class="log-details-text">${escapeHtml(item.details)}</pre>
				</div>
			`;
		}

		card.innerHTML = `
			<div class="log-card-header">
				<div class="log-header-left">
					<span class="log-badge badge-${(item.level || "info").toLowerCase()}">${badgeIcon} ${badgeLabel}</span>
					<span class="log-timestamp">${timeFormatted}</span>
				</div>
				<div class="log-header-right">
					<button class="log-copy-btn" title="Copy to clipboard">
						<svg viewBox="0 0 24 24" class="log-copy-icon">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
						</svg>
					</button>
				</div>
			</div>
			<div class="log-card-body">
				${contentHtml}
			</div>
		`;

		const copyBtn = card.querySelector(".log-copy-btn");
		if (copyBtn) {
			copyBtn.addEventListener("click", () => {
				let copyText = `[${timeFormatted}] [${item.level}] ${item.message || ""}`;
				if (item.command) copyText += `\nCommand: ${item.command}`;
				if (item.url) copyText += `\nURL: ${item.url}`;
				if (item.details) copyText += `\nDetails:\n${item.details}`;

				if (window.electronAPI?.clipboard?.writeText) {
					window.electronAPI.clipboard.writeText(copyText);
				} else if (navigator.clipboard) {
					navigator.clipboard.writeText(copyText);
				}

				copyBtn.classList.add("copied");
				setTimeout(() => copyBtn.classList.remove("copied"), 1500);
			});
		}

		fragment.appendChild(card);
	});

	container.appendChild(fragment);
}

export function initLogsUI() {
	if (isInitialized) return;
	isInitialized = true;

	const searchInput = getId("logSearchInput");
	const filterButtons = document.querySelectorAll(".log-filter-btn");
	const detailToggle = getId("logDetailToggle");
	const refreshBtn = getId("logRefreshBtn");
	const exportBtn = getId("logExportBtn");
	const clearBtn = getId("logClearBtn");

	if (searchInput) {
		let debounceTimer;
		searchInput.addEventListener("input", (e) => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				searchTerm = e.target.value;
				renderLogs();
			}, 150);
		});
	}

	filterButtons.forEach((btn) => {
		btn.addEventListener("click", () => {
			filterButtons.forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			currentFilter = (btn.dataset.filter || "ALL").toUpperCase();
			renderLogs();
		});
	});

	if (detailToggle) {
		detailToggle.addEventListener("change", (e) => {
			showDetails = e.target.checked;
			renderLogs();
		});
	}

	if (refreshBtn) {
		refreshBtn.addEventListener("click", () => {
			refreshBtn.classList.add("rotating");
			loadLogs().finally(() => {
				setTimeout(() => refreshBtn.classList.remove("rotating"), 500);
			});
		});
	}

	if (exportBtn) {
		exportBtn.addEventListener("click", async () => {
			try {
				const result = await (window.electronAPI?.logger?.exportLogs("txt") ||
					window.electronAPI?.ipcRenderer?.invoke("export-logs", "txt"));
				if (result?.success) {
					// Feedback
					exportBtn.classList.add("success");
					setTimeout(() => exportBtn.classList.remove("success"), 1500);
				}
			} catch (err) {
				console.error("Failed to export logs:", err);
			}
		});
	}

	if (clearBtn) {
		clearBtn.addEventListener("click", async () => {
			try {
				await (window.electronAPI?.logger?.clearLogs() ||
					window.electronAPI?.ipcRenderer?.invoke("clear-logs"));
				allLogs = [];
				renderLogs();
			} catch (err) {
				console.error("Failed to clear logs:", err);
			}
		});
	}

	// Real-time listener for incoming logs
	if (window.electronAPI?.logger?.onNewLog) {
		window.electronAPI.logger.onNewLog((entry) => {
			allLogs.unshift(entry);
			const viewLogs = getId("view-logs");
			if (viewLogs && !viewLogs.classList.contains("hidden")) {
				renderLogs();
			}
		});
	}
}

window.loadLogs = loadLogs;
window.initLogsUI = initLogsUI;

// Auto-init on DOMContentLoaded
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		initLogsUI();
	});
} else {
	initLogsUI();
}
