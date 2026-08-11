const fs = require("fs");
const path = require("path");
const os = require("os");

const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2 MB per log file
const MAX_BACKUPS = 2; // Keep app.log, app.1.log, app.2.log

const origConsole = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
};

class Logger {
	constructor() {
		this.logDir = null;
		this.logFile = null;
		this.initialized = false;
		this.consoleHooked = false;
	}

	/**
	 * Initializes the logger with the application user data directory.
	 * @param {string} userDataPath
	 */
	init(userDataPath) {
		try {
			this.logDir = path.join(userDataPath, "logs");
			if (!fs.existsSync(this.logDir)) {
				fs.mkdirSync(this.logDir, { recursive: true });
			}
			this.logFile = path.join(this.logDir, "app.log");
			this.initialized = true;
			this.cleanOldLogs();
			this.hookConsole();
			this.info("Logger initialized.", "Main");
		} catch (err) {
			origConsole.error("Failed to initialize logger:", err);
		}
	}

	/**
	 * Intercepts standard console calls in the process to redirect them to logger.
	 */
	hookConsole() {
		if (this.consoleHooked) return;
		this.consoleHooked = true;

		console.log = (...args) => {
			const msg = args.map(a => typeof a === "object" ? (a instanceof Error ? a.stack : JSON.stringify(a)) : String(a)).join(" ");
			this.info(msg, "Main");
		};
		console.warn = (...args) => {
			const msg = args.map(a => typeof a === "object" ? (a instanceof Error ? a.stack : JSON.stringify(a)) : String(a)).join(" ");
			this.warn(msg, "Main");
		};
		console.error = (...args) => {
			const msg = args.map(a => typeof a === "object" ? (a instanceof Error ? a.stack : JSON.stringify(a)) : String(a)).join(" ");
			this.error(msg, "Main");
		};
	}

	getLogDir() {
		return this.logDir;
	}

	/**
	 * Formats a log line.
	 */
	formatLine(level, message, source = "Main") {
		const timestamp = new Date().toISOString();
		const formattedMsg = typeof message === "object" ? JSON.stringify(message) : String(message);
		return `[${timestamp}] [${level.toUpperCase()}] [${source}] ${formattedMsg}\n`;
	}

	/**
	 * Rotates log files if current app.log exceeds MAX_LOG_SIZE.
	 */
	rotateIfNeeded() {
		if (!this.initialized || !this.logFile) return;

		try {
			if (!fs.existsSync(this.logFile)) return;

			const stats = fs.statSync(this.logFile);
			if (stats.size < MAX_LOG_SIZE) return;

			// Rotate backup files: app.2.log deleted, app.1.log -> app.2.log, app.log -> app.1.log
			for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
				const currentBackup = path.join(this.logDir, `app.${i}.log`);
				const nextBackup = path.join(this.logDir, `app.${i + 1}.log`);

				if (fs.existsSync(currentBackup)) {
					if (i === MAX_BACKUPS - 1 && fs.existsSync(nextBackup)) {
						fs.unlinkSync(nextBackup);
					}
					fs.renameSync(currentBackup, nextBackup);
				}
			}

			const firstBackup = path.join(this.logDir, "app.1.log");
			if (fs.existsSync(firstBackup)) {
				fs.unlinkSync(firstBackup);
			}
			fs.renameSync(this.logFile, firstBackup);
		} catch (err) {
			origConsole.error("Failed to rotate log files:", err);
		}
	}

	/**
	 * Clean up any extraneous or old log files in the directory.
	 */
	cleanOldLogs() {
		if (!this.logDir || !fs.existsSync(this.logDir)) return;
		try {
			const files = fs.readdirSync(this.logDir);
			const now = Date.now();
			const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

			for (const file of files) {
				const filePath = path.join(this.logDir, file);
				const stats = fs.statSync(filePath);
				if (now - stats.mtimeMs > SEVEN_DAYS_MS) {
					fs.unlinkSync(filePath);
				}
			}
		} catch (_) { }
	}

	/**
	 * Appends entry to the log file.
	 */
	write(level, message, source = "Main") {
		const line = this.formatLine(level, message, source);

		// Always print to original console
		if (level.toUpperCase() === "ERROR") {
			origConsole.error(line.trim());
		} else if (level.toUpperCase() === "WARN") {
			origConsole.warn(line.trim());
		} else {
			origConsole.log(line.trim());
		}

		if (!this.initialized || !this.logFile) return;

		try {
			this.rotateIfNeeded();
			fs.appendFileSync(this.logFile, line, "utf8");
		} catch (err) {
			origConsole.error("Failed to write to log file:", err);
		}
	}

	info(msg, source) {
		this.write("INFO", msg, source);
	}

	warn(msg, source) {
		this.write("WARN", msg, source);
	}

	error(msg, source) {
		this.write("ERROR", msg, source);
	}

	debug(msg, source) {
		this.write("DEBUG", msg, source);
	}

	/**
	 * Reads all active log files in chronological order and returns combined string with system info header.
	 * @param {object} sysInfo
	 */
	getCombinedLogs(sysInfo = {}) {
		let output = "=== YTDownloader System Diagnostic Info ===\n";
		output += `App Version: ${sysInfo.version || "Unknown"}\n`;
		output += `OS: ${os.type()} ${os.release()} (${os.arch()})\n`;
		output += `Node: ${process.versions.node}\n`;
		output += `Electron: ${process.versions.electron}\n`;
		output += `Date: ${new Date().toISOString()}\n`;
		output += `yt-dlp Path: ${sysInfo.ytDlpPath || "Unknown"}\n`;
		output += `ffmpeg Path: ${sysInfo.ffmpegPath || "Unknown"}\n`;
		output += "===========================================\n\n";
		output += "=== Application Logs ===\n";

		if (!this.initialized || !this.logDir || !fs.existsSync(this.logDir)) {
			output += "(No logs found)\n";
			return output;
		}

		try {
			const filesToRead = [];
			for (let i = MAX_BACKUPS; i >= 1; i--) {
				const backupPath = path.join(this.logDir, `app.${i}.log`);
				if (fs.existsSync(backupPath)) filesToRead.push(backupPath);
			}
			if (fs.existsSync(this.logFile)) filesToRead.push(this.logFile);

			if (filesToRead.length === 0) {
				output += "(No log files available)\n";
			} else {
				for (const filePath of filesToRead) {
					output += `--- File: ${path.basename(filePath)} ---\n`;
					output += fs.readFileSync(filePath, "utf8") + "\n";
				}
			}
		} catch (err) {
			output += `Failed to read log files: ${err.message}\n`;
		}

		return output;
	}
}

const logger = new Logger();
module.exports = logger;
