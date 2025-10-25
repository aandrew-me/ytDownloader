/**
 * Download History Manager
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

class DownloadHistory {
	constructor() {
		this.historyFile = path.join(app.getPath("userData"), "download_history.json");
		this.maxHistoryItems = 800;
		this.history = [];
		this.initialized = this._loadHistory().then(history => {
			this.history = history;
		});
	}
	_generateUniqueId() {
		return crypto.randomUUID();
	}

	async _loadHistory() {
		try {
			if (fs.existsSync(this.historyFile)) {
				const data = await fs.promises.readFile(this.historyFile, "utf8");
				return JSON.parse(data) || [];
			}
		} catch (error) {
			console.error("Error loading history:", error);
		}
		return [];
	}

	async _saveHistory() {
		try {
			await fs.promises.writeFile(this.historyFile, JSON.stringify(this.history, null, 2));
		} catch (error) {
			console.error("Error saving history:", error);
		}
	}

	async addDownload(downloadInfo) {
		await this.initialized;
		
		const historyItem = {
			id: this._generateUniqueId(),
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

		await this._saveHistory();
		return historyItem;
	}

	async getHistory() {
		await this.initialized;
		return this.history;
	}

	async getFilteredHistory(options = {}) {
		await this.initialized;
		
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

	async getHistoryItem(id) {
		await this.initialized;
		return this.history.find((item) => item.id === id) || null;
	}

	async removeHistoryItem(id) {
		await this.initialized;
		
		const index = this.history.findIndex((item) => item.id === id);
		if (index !== -1) {
			this.history.splice(index, 1);
			await this._saveHistory();
			return true;
		}
		return false;
	}

	async clearHistory() {
		await this.initialized;
		
		this.history = [];
		await this._saveHistory();
	}

	async getStats() {
		await this.initialized;
		
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

	async exportAsJSON() {
		await this.initialized;
		return JSON.stringify(this.history, null, 2);
	}

	_sanitizeCSVField(value) {
		if (value == null) {
			value = "";
		}
		
		const stringValue = String(value);
			
		let sanitized = stringValue.replace(/"/g, '""');
		
		const dangerousChars = ['=', '+', '-', '@'];
		if (sanitized.length > 0 && dangerousChars.includes(sanitized[0])) {
			sanitized = "'" + sanitized;
		}
		
		return `"${sanitized}"`;
	}

	async exportAsCSV() {
		await this.initialized;
		
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
			this._sanitizeCSVField(item.title),
			this._sanitizeCSVField(item.url),
			this._sanitizeCSVField(item.filename),
			this._sanitizeCSVField(item.format),
			this._sanitizeCSVField(item.fileSize),
			this._sanitizeCSVField(item.downloadDate),
		]);

		return (
			headers.join(",") +
			"\n" +
			rows.map((row) => row.join(",")).join("\n")
		);
	}
}

module.exports = DownloadHistory;
