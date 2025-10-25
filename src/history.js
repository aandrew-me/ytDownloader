/**
 * Download History Manager
 */

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class DownloadHistory {
	constructor() {
		this.historyFile = path.join(app.getPath("userData"), "download_history.json");
		this.maxHistoryItems = 200;
		this.history = this._loadHistory();
	}

	_loadHistory() {
		try {
			if (fs.existsSync(this.historyFile)) {
				const data = fs.readFileSync(this.historyFile, "utf8");
				return JSON.parse(data) || [];
			}
		} catch (error) {
			console.error("Error loading history:", error);
		}
		return [];
	}

	_saveHistory() {
		try {
			fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
		} catch (error) {
			console.error("Error saving history:", error);
		}
	}

	addDownload(downloadInfo) {
		const historyItem = {
			id: Date.now().toString(),
			title: downloadInfo.title || "Unknown",
			url: downloadInfo.url || "",
			filename: downloadInfo.filename || "",
			filePath: downloadInfo.filePath || "",
			fileSize: downloadInfo.fileSize || 0,
			format: downloadInfo.format || "unknown",
			thumbnail: downloadInfo.thumbnail || "",
			duration: downloadInfo.duration || 0,
			downloadDate: new Date().toISOString(),
			timestamp: Date.now(),
		};

		// Add to beginning for most recent first
		this.history.unshift(historyItem);

		// Keep only recent items
		if (this.history.length > this.maxHistoryItems) {
			this.history = this.history.slice(0, this.maxHistoryItems);
		}

		this._saveHistory();
		return historyItem;
	}

	getHistory() {
		return this.history;
	}

	getFilteredHistory(options = {}) {
		let filtered = [...this.history];

		if (options.format) {
			filtered = filtered.filter(
				(item) => item.format.toLowerCase() === options.format.toLowerCase()
			);
		}

		if (options.searchTerm) {
			const term = options.searchTerm.toLowerCase();
			filtered = filtered.filter(
				(item) =>
					item.title.toLowerCase().includes(term) ||
					item.url.toLowerCase().includes(term)
			);
		}

		if (options.limit) {
			filtered = filtered.slice(0, options.limit);
		}

		return filtered;
	}

	getHistoryItem(id) {
		return this.history.find((item) => item.id === id) || null;
	}

	removeHistoryItem(id) {
		const index = this.history.findIndex((item) => item.id === id);
		if (index !== -1) {
			this.history.splice(index, 1);
			this._saveHistory();
			return true;
		}
		return false;
	}

	clearHistory() {
		this.history = [];
		this._saveHistory();
	}

	getStats() {
		const stats = {
			totalDownloads: this.history.length,
			totalSize: 0,
			byFormat: {},
			oldestDownload: null,
			newestDownload: null,
		};

		this.history.forEach((item) => {
			stats.totalSize += item.fileSize || 0;

			const fmt = item.format.toLowerCase();
			stats.byFormat[fmt] = (stats.byFormat[fmt] || 0) + 1;
		});

		if (this.history.length > 0) {
			stats.newestDownload = this.history[0];
			stats.oldestDownload = this.history[this.history.length - 1];
		}

		return stats;
	}

	exportAsJSON() {
		return JSON.stringify(this.history, null, 2);
	}

	exportAsCSV() {
		if (this.history.length === 0) return "No history to export\n";

		const headers = [
			"Title",
			"URL",
			"Filename",
			"Format",
			"File Size (bytes)",
			"Download Date",
		];
		const rows = this.history.map((item) => [
			`"${item.title.replace(/"/g, '""')}"`,
			`"${item.url.replace(/"/g, '""')}"`,
			`"${item.filename.replace(/"/g, '""')}"`,
			item.format,
			item.fileSize,
			item.downloadDate,
		]);

		return (
			headers.join(",") +
			"\n" +
			rows.map((row) => row.join(",")).join("\n")
		);
	}
}

module.exports = DownloadHistory;
