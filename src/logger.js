/**
 * Session-based Logger for ytDownloader
 * Zero-dependency logger with in-memory ring buffer and size-capped file rotation.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
let app;
try {
	app = require("electron").app;
} catch (_) {}

class Logger {
	constructor(options = {}) {
		this.maxEntries = options.maxEntries || 1000;
		this.maxFileSizeBytes = options.maxFileSizeBytes || 2 * 1024 * 1024; // 2 MB
		this.logsDir =
			options.logsDir ||
			(app && typeof app.getPath === "function"
				? path.join(app.getPath("userData"), "logs")
				: path.join(os.tmpdir(), "ytdownloader_logs"));
		this.sessionLogPath = path.join(this.logsDir, "session.log");
		this.prevLogPath = path.join(this.logsDir, "session.prev.log");

		this.buffer = [];
		this.listeners = new Set();

		this._initDirectoriesAndRotation();
	}

	_initDirectoriesAndRotation() {
		try {
			if (!fs.existsSync(this.logsDir)) {
				fs.mkdirSync(this.logsDir, { recursive: true });
			}

			// Rotate previous session log on startup
			if (fs.existsSync(this.sessionLogPath)) {
				try {
					if (fs.existsSync(this.prevLogPath)) {
						fs.unlinkSync(this.prevLogPath);
					}
					fs.renameSync(this.sessionLogPath, this.prevLogPath);
				} catch (err) {
					console.error("Failed to rotate session log:", err);
				}
			}

			// Initialize clean session file with header
			const header = `=== ytDownloader Session Log Started at ${new Date().toISOString()} ===\n`;
			fs.writeFileSync(this.sessionLogPath, header, { encoding: "utf8" });
		} catch (err) {
			console.error("Logger initialization error:", err);
		}
	}

	_sanitize(entry) {
		const level = String(entry.level || "INFO").toUpperCase();
		let message = String(entry.message || "");
		let command = entry.command ? String(entry.command) : "";
		let url = entry.url ? String(entry.url) : "";
		let details = entry.details ? String(entry.details) : "";

		// Prevent single huge strings from bloating memory
		if (message.length > 1000) message = message.slice(0, 1000) + "… [truncated]";
		if (command.length > 2000) command = command.slice(0, 2000) + "… [truncated]";
		if (url.length > 500) url = url.slice(0, 500);
		if (details.length > 3000) details = details.slice(0, 3000) + "\n… [truncated]";

		return {
			id: entry.id || crypto.randomUUID(),
			timestamp: entry.timestamp || Date.now(),
			level: ["COMMAND", "SUCCESS", "INFO", "ERROR", "DETAIL"].includes(level) ? level : "INFO",
			message,
			command,
			url,
			details,
		};
	}

	addLog(entryData) {
		const entry = this._sanitize(entryData);

		// Maintain in-memory ring buffer (newest at the beginning or end; unshift for reverse-chrono)
		this.buffer.unshift(entry);
		if (this.buffer.length > this.maxEntries) {
			this.buffer.length = this.maxEntries;
		}

		// Write to disk asynchronously
		this._appendToFile(entry);

		// Notify listeners (e.g. IPC broadcast to renderer)
		for (const listener of this.listeners) {
			try {
				listener(entry);
			} catch (_) {}
		}

		return entry;
	}

	onLog(callback) {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	_appendToFile(entry) {
		try {
			const timeStr = new Date(entry.timestamp).toISOString();
			let line = `[${timeStr}] [${entry.level}] ${entry.message}`;
			if (entry.command) line += ` | CMD: ${entry.command}`;
			if (entry.url) line += ` | URL: ${entry.url}`;
			if (entry.details) line += `\n  DETAILS: ${entry.details.replace(/\n/g, "\n  ")}`;
			line += "\n";

			fs.appendFileSync(this.sessionLogPath, line, { encoding: "utf8" });

			// Check file size occasionally
			if (this.buffer.length % 50 === 0 && fs.existsSync(this.sessionLogPath)) {
				const stats = fs.statSync(this.sessionLogPath);
				if (stats && stats.size > this.maxFileSizeBytes) {
					// Truncate to keep recent half
					const data = fs.readFileSync(this.sessionLogPath, "utf8");
					const half = data.slice(Math.floor(data.length / 2));
					const firstNewline = half.indexOf("\n");
					const trimmed =
						`=== [Log truncated due to size limit] ===\n` +
						(firstNewline !== -1 ? half.slice(firstNewline + 1) : half);
					fs.writeFileSync(this.sessionLogPath, trimmed, "utf8");
				}
			}
		} catch (err) {
			console.error("Error writing to session log file:", err);
		}
	}

	getLogs(options = {}) {
		let logs = [...this.buffer];

		if (options.level && options.level !== "ALL") {
			const targetLevel = options.level.toUpperCase();
			logs = logs.filter((item) => item.level === targetLevel);
		}

		if (options.searchTerm) {
			const term = options.searchTerm.toLowerCase();
			logs = logs.filter(
				(item) =>
					(item.message && item.message.toLowerCase().includes(term)) ||
					(item.url && item.url.toLowerCase().includes(term)) ||
					(item.command && item.command.toLowerCase().includes(term)) ||
					(item.details && item.details.toLowerCase().includes(term))
			);
		}

		if (options.limit && options.limit > 0) {
			logs = logs.slice(0, options.limit);
		}

		return logs;
	}

	async clearLogs() {
		this.buffer = [];
		try {
			const header = `=== ytDownloader Session Log Cleared at ${new Date().toISOString()} ===\n`;
			await fs.promises.writeFile(this.sessionLogPath, header, { encoding: "utf8" });
		} catch (err) {
			console.error("Failed to clear session log file:", err);
		}
		return true;
	}

	async exportLogs(format = "txt") {
		if (format === "json") {
			return JSON.stringify(this.buffer, null, 2);
		}

		// Plain text export
		const lines = this.buffer.map((entry) => {
			const timeStr = new Date(entry.timestamp).toLocaleString();
			let out = `[${timeStr}] [${entry.level}] ${entry.message}`;
			if (entry.url) out += `\n  URL: ${entry.url}`;
			if (entry.command) out += `\n  CMD: ${entry.command}`;
			if (entry.details) out += `\n  DETAILS: ${entry.details}`;
			return out;
		});

		return lines.join("\n\n");
	}

	getLogsDirectory() {
		return this.logsDir;
	}
}

module.exports = Logger;
