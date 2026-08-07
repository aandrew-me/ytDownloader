/**
 * Download History UI Renderer for Single Page Application
 */

const { ipcRenderer, clipboard } = window.electronAPI || {};

let allHistory = [];
let filteredHistory = [];

function t(key, fallback) {
	if (window.i18n && typeof window.i18n.__ === "function") {
		const res = window.i18n.__(key);
		if (res && res !== key) return res;
	}
	return fallback;
}

export function loadHistory() {
	if (!ipcRenderer || !ipcRenderer.invoke) return;
	ipcRenderer
		.invoke("get-download-history")
		.then((history) => {
			allHistory = history || [];
			filterHistory();
			updateStats();
		})
		.catch((error) => {
			console.error("Failed to load download history:", error);
		});
}

export function filterHistory() {
	const searchInput = document.getElementById("searchBox");
	const formatSelect = document.getElementById("formatFilter");
	const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
	const format = formatSelect ? formatSelect.value.toLowerCase() : "";

	filteredHistory = allHistory.filter((item) => {
		const matchesSearch =
			!searchTerm ||
			(item.title && item.title.toLowerCase().includes(searchTerm)) ||
			(item.url && item.url.toLowerCase().includes(searchTerm));

		const matchesFormat =
			!format || (item.format && item.format.toLowerCase() === format);

		return matchesSearch && matchesFormat;
	});

	renderHistory(filteredHistory);
}

export function renderHistory(historyItems) {
	const container = document.getElementById("historyListContainer");
	if (!container) return;

	container.innerHTML = "";

	if (!historyItems || historyItems.length === 0) {
		const emptyState = document.createElement("div");
		emptyState.className = "empty-state";
		emptyState.style.textAlign = "center";
		emptyState.style.padding = "40px";
		emptyState.style.opacity = "0.7";

		const icon = document.createElement("div");
		icon.style.fontSize = "48px";
		icon.style.marginBottom = "10px";
		icon.textContent = "📭";

		const heading = document.createElement("h2");
		heading.textContent = t("noDownloadsYet", "No Downloads Yet");

		const text = document.createElement("p");
		text.textContent = t(
			"yourDownloadHistoryWillAppearHere",
			"Your download history will appear here",
		);

		emptyState.appendChild(icon);
		emptyState.appendChild(heading);
		emptyState.appendChild(text);
		container.appendChild(emptyState);
		return;
	}

	historyItems.forEach((item) => {
		const itemDiv = document.createElement("div");
		itemDiv.className = "history-item";
		itemDiv.dataset.id = item.id;

		const thumbnail = document.createElement(item.thumbnail ? "img" : "div");
		thumbnail.className = "history-item-thumbnail";
		if (item.thumbnail) {
			thumbnail.src = item.thumbnail;
			thumbnail.alt = "thumbnail";
		}
		itemDiv.appendChild(thumbnail);

		const info = document.createElement("div");
		info.className = "history-item-info";

		const title = document.createElement("div");
		title.className = "history-item-title";
		title.title = item.title || "Untitled";
		title.textContent = item.title || "Untitled";
		info.appendChild(title);

		const meta = document.createElement("div");
		meta.className = "history-item-meta";

		const formatSpan = document.createElement("span");
		formatSpan.textContent = "Format: ";
		const formatStrong = document.createElement("strong");
		formatStrong.textContent = item.format || "unknown";
		formatSpan.appendChild(formatStrong);
		meta.appendChild(formatSpan);

		const sizeSpan = document.createElement("span");
		sizeSpan.textContent = "Size: ";
		const sizeStrong = document.createElement("strong");
		sizeStrong.textContent = formatFileSize(item.fileSize);
		sizeSpan.appendChild(sizeStrong);
		meta.appendChild(sizeSpan);

		const dateSpan = document.createElement("span");
		dateSpan.textContent = "Date: ";
		const dateStrong = document.createElement("strong");
		dateStrong.textContent = item.downloadDate
			? new Date(item.downloadDate).toLocaleDateString()
			: "N/A";
		dateSpan.appendChild(dateStrong);
		meta.appendChild(dateSpan);

		if (item.duration) {
			const durationSpan = document.createElement("span");
			durationSpan.textContent = "Duration: ";
			const durationStrong = document.createElement("strong");
			durationStrong.textContent = formatDuration(item.duration);
			durationSpan.appendChild(durationStrong);
			meta.appendChild(durationSpan);
		}

		info.appendChild(meta);
		itemDiv.appendChild(info);

		const actions = document.createElement("div");
		actions.className = "history-item-actions";

		if (item.url && clipboard) {
			const copyBtn = document.createElement("button");
			copyBtn.className = "copy-url-btn";
			copyBtn.textContent = t("copyUrl", "Copy URL");
			copyBtn.addEventListener("click", () => {
				clipboard.writeText(item.url);
			});
			actions.appendChild(copyBtn);
		}

		if (item.filePath) {
			const openBtn = document.createElement("button");
			openBtn.className = "open-file-btn";
			openBtn.textContent = t("open", "Open");
			openBtn.addEventListener("click", () => {
				ipcRenderer.invoke("show-file", item.filePath);
			});
			actions.appendChild(openBtn);
		}

		const deleteBtn = document.createElement("button");
		deleteBtn.className = "delete-btn";
		deleteBtn.textContent = t("delete", "Delete");
		deleteBtn.addEventListener("click", () => {
			if (confirm(t("confirmDeleteHistoryItem", "Delete this item?"))) {
				ipcRenderer
					.invoke("delete-history-item", item.id)
					.then(() => {
						loadHistory();
					})
					.catch((err) => console.error("Failed to delete item:", err));
			}
		});
		actions.appendChild(deleteBtn);

		itemDiv.appendChild(actions);
		container.appendChild(itemDiv);
	});
}

function formatFileSize(bytes) {
	if (!bytes || bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function formatDuration(seconds) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

export function updateStats() {
	if (!ipcRenderer || !ipcRenderer.invoke) return;
	ipcRenderer
		.invoke("get-download-stats")
		.then((stats) => {
			const statsContainer = document.getElementById("statsContainer");
			if (!statsContainer) return;
			statsContainer.innerHTML = "";

			const createStatCard = (title, value) => {
				const card = document.createElement("div");
				card.className = "stat-card";
				const titleElement = document.createElement("h3");
				titleElement.textContent = title;
				const valueElement = document.createElement("div");
				valueElement.className = "value";
				valueElement.textContent = value;
				card.appendChild(titleElement);
				card.appendChild(valueElement);
				return card;
			};

			const mostCommonFormat =
				stats.byFormat && Object.keys(stats.byFormat).length > 0
					? Object.entries(stats.byFormat)
							.sort((a, b) => b[1] - a[1])[0][0]
							.toUpperCase()
					: "N/A";

			statsContainer.appendChild(
				createStatCard("Total Downloads", stats.totalDownloads || 0),
			);
			statsContainer.appendChild(
				createStatCard("Total Size", formatFileSize(stats.totalSize || 0)),
			);
			statsContainer.appendChild(
				createStatCard("Most Common Format", mostCommonFormat),
			);
		})
		.catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
	const searchBox = document.getElementById("searchBox");
	const formatFilter = document.getElementById("formatFilter");
	const clearAllBtn = document.getElementById("clearAllBtn");

	if (searchBox) searchBox.addEventListener("input", filterHistory);
	if (formatFilter) formatFilter.addEventListener("change", filterHistory);
	if (clearAllBtn) {
		clearAllBtn.addEventListener("click", () => {
			if (
				confirm(
					t(
						"confirmClearAllHistory",
						"Are you sure you want to clear all history?",
					),
				)
			) {
				ipcRenderer
					.invoke("clear-all-history")
					.then(() => {
						loadHistory();
					})
					.catch((err) => console.error("Failed to clear history:", err));
			}
		});
	}
});

window.loadHistory = loadHistory;
