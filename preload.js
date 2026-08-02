const { contextBridge, ipcRenderer, shell, clipboard } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const originalFs = require("original-fs");
const { exec, execFile, execSync, spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const si = require("systeminformation");
const { default: YTDlpWrap } = require("yt-dlp-wrap-plus");

function normalizeSignal(options, cancellationSignal) {
	let signalToUse = null;
	const localOpts = options ? { ...options } : {};
	const incomingSignal = localOpts.signal || cancellationSignal;

	if (incomingSignal) {
		if (incomingSignal instanceof AbortSignal) {
			signalToUse = incomingSignal;
		} else {
			const ac = new AbortController();
			signalToUse = ac.signal;
			if (incomingSignal.aborted) {
				ac.abort();
			} else if (typeof incomingSignal.addEventListener === "function") {
				incomingSignal.addEventListener("abort", () => ac.abort());
			}
		}
	}

	delete localOpts.signal;
	return { options: localOpts, signal: signalToUse };
}

function killProcessSafely(proc, signal) {
	if (!proc) return;
	try {
		if (process.platform === "win32" && proc.pid) {
			execSync(`taskkill /pid ${proc.pid} /T /F`);
		} else {
			proc.kill(signal || "SIGKILL");
		}
	} catch (e) {
		try {
			proc.kill(signal || "SIGKILL");
		} catch (_) { }
	}
}

function createYTDlpWrapInstance(binaryPath) {
	const instance = new YTDlpWrap(binaryPath);
	return {
		exec: (args = [], options = {}, cancellationSignal) => {
			const { options: localOpts, signal: realSignal } = normalizeSignal(options, cancellationSignal);
			const proc = instance.exec(args, localOpts, realSignal);
			const spawnargs =
				proc.ytDlpProcess && proc.ytDlpProcess.spawnargs
					? [...proc.ytDlpProcess.spawnargs]
					: Array.isArray(args)
						? args
						: [];

			const procWrapper = {
				on: (event, cb) => {
					proc.on(event, (...eventArgs) => cb(...eventArgs));
					return procWrapper;
				},
				once: (event, cb) => {
					proc.once(event, (...eventArgs) => cb(...eventArgs));
					return procWrapper;
				},
				off: (event, cb) => {
					proc.off(event, (...eventArgs) => cb(...eventArgs));
					return procWrapper;
				},
				removeListener: (event, cb) => {
					proc.removeListener(event, (...eventArgs) => cb(...eventArgs));
					return procWrapper;
				},
				removeAllListeners: (event) => {
					proc.removeAllListeners(event);
					return procWrapper;
				},
				ytDlpProcess: {
					spawnargs: spawnargs,
					kill: (signal) => killProcessSafely(proc.ytDlpProcess, signal),
					get killed() {
						return proc.ytDlpProcess ? proc.ytDlpProcess.killed : false;
					},
					get pid() {
						return proc.ytDlpProcess ? proc.ytDlpProcess.pid : undefined;
					},
					stdout: {
						on: (event, cb) => {
							if (proc.ytDlpProcess && proc.ytDlpProcess.stdout) {
								proc.ytDlpProcess.stdout.on(event, (data) =>
									cb(typeof data === "string" ? data : data.toString()),
								);
							}
						},
					},
					stderr: {
						on: (event, cb) => {
							if (proc.ytDlpProcess && proc.ytDlpProcess.stderr) {
								proc.ytDlpProcess.stderr.on(event, (data) =>
									cb(typeof data === "string" ? data : data.toString()),
								);
							}
						},
					},
				},
				kill: (signal) => killProcessSafely(proc.ytDlpProcess || proc, signal),
				get killed() {
					return proc.ytDlpProcess ? proc.ytDlpProcess.killed : false;
				},
			};
			return procWrapper;
		},
		execPromise: (args = [], options = {}, cancellationSignal) => {
			const { options: localOpts, signal: realSignal } = normalizeSignal(options, cancellationSignal);
			return instance.execPromise(args, localOpts, realSignal);
		},
		getExtractorTitles: () => {
			return instance.getExtractorTitles();
		},
		version: () => {
			return instance.version();
		},
	};
}

function YTDlpWrapConstructor(binaryPath) {
	return createYTDlpWrapInstance(binaryPath);
}

YTDlpWrapConstructor.downloadFromGithub = (filePath, version, platform, callback) => {
	return YTDlpWrap.downloadFromGithub(
		filePath,
		version,
		platform,
		(progress, downloaded, total) => {
			if (callback) callback(progress, downloaded, total);
		},
	);
};

const spawnWrapper = (command, args = [], options = {}) => {
	const child = spawn(command, args, options);
	const childWrapper = {
		stdout: {
			on: (event, cb) => {
				child.stdout?.on(event, (data) =>
					cb(typeof data === "string" ? data : data.toString()),
				);
			},
		},
		stderr: {
			on: (event, cb) => {
				child.stderr?.on(event, (data) =>
					cb(typeof data === "string" ? data : data.toString()),
				);
			},
		},
		on: (event, cb) => {
			child.on(event, (...eventArgs) => cb(...eventArgs));
			return childWrapper;
		},
		once: (event, cb) => {
			child.once(event, (...eventArgs) => cb(...eventArgs));
			return childWrapper;
		},
		off: (event, cb) => {
			child.off(event, (...eventArgs) => cb(...eventArgs));
			return childWrapper;
		},
		removeListener: (event, cb) => {
			child.removeListener(event, (...eventArgs) => cb(...eventArgs));
			return childWrapper;
		},
		removeAllListeners: (event) => {
			child.removeAllListeners(event);
			return childWrapper;
		},
		kill: (signal) => killProcessSafely(child, signal),
		get killed() {
			return child.killed;
		},
		get pid() {
			return child.pid;
		},
	};
	return childWrapper;
};

const envObj = {
	FLATPAK_ID: process.env.FLATPAK_ID,
	LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
	YTDOWNLOADER_NODE_PATH: process.env.YTDOWNLOADER_NODE_PATH,
	YTDOWNLOADER_DENO_PATH: process.env.YTDOWNLOADER_DENO_PATH,
	YTDOWNLOADER_FFMPEG_PATH: process.env.YTDOWNLOADER_FFMPEG_PATH,
	YTDOWNLOADER_YTDLP_PATH: process.env.YTDOWNLOADER_YTDLP_PATH,
	YTDOWNLOADER_AUTO_UPDATES: process.env.YTDOWNLOADER_AUTO_UPDATES,
};

contextBridge.exposeInMainWorld("electronAPI", {
	ipcRenderer: {
		send: (channel, ...args) => ipcRenderer.send(channel, ...args),
		on: (channel, listener) => {
			const sub = (event, ...args) => listener(event, ...args);
			ipcRenderer.on(channel, sub);
			return sub;
		},
		once: (channel, listener) => {
			ipcRenderer.once(channel, (event, ...args) => listener(event, ...args));
		},
		removeListener: (channel, listener) => {
			ipcRenderer.removeListener(channel, listener);
		},
		removeAllListeners: (channel) => {
			ipcRenderer.removeAllListeners(channel);
		},
		invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
	},
	shell: {
		openExternal: (url) => shell.openExternal(url),
		showItemInFolder: (p) => shell.showItemInFolder(p),
		openPath: (p) => shell.openPath(p),
	},
	clipboard: {
		readText: () => clipboard.readText(),
		writeText: (text) => clipboard.writeText(text),
	},
	path: {
		join: (...args) => path.join(...args),
		extname: (p) => path.extname(p),
		basename: (p, ext) => path.basename(p, ext),
		dirname: (p) => path.dirname(p),
		resolve: (...args) => path.resolve(...args),
		parse: (p) => path.parse(p),
		format: (obj) => path.format(obj),
		isAbsolute: (p) => path.isAbsolute(p),
		normalize: (p) => path.normalize(p),
		relative: (from, to) => path.relative(from, to),
		sep: path.sep,
	},
	join: (...args) => path.join(...args),
	extname: (p) => path.extname(p),
	basename: (p, ext) => path.basename(p, ext),
	dirname: (p) => path.dirname(p),
	resolve: (...args) => path.resolve(...args),
	parse: (p) => path.parse(p),
	format: (obj) => path.format(obj),
	isAbsolute: (p) => path.isAbsolute(p),
	normalize: (p) => path.normalize(p),
	relative: (from, to) => path.relative(from, to),
	sep: path.sep,

	os: {
		platform: () => os.platform(),
		homedir: () => os.homedir(),
		tmpdir: () => os.tmpdir(),
		cpus: () => os.cpus(),
	},
	platform: () => os.platform(),
	homedir: () => os.homedir(),
	tmpdir: () => os.tmpdir(),
	cpus: () => os.cpus(),

	fs: {
		existsSync: (p) => fs.existsSync(p),
		readFileSync: (p, options) => fs.readFileSync(p, options),
		writeFileSync: (p, data, options) => fs.writeFileSync(p, data, options),
		mkdirSync: (p, options) => fs.mkdirSync(p, options),
		unlinkSync: (p) => fs.unlinkSync(p),
		copyFileSync: (src, dest, flags) => fs.copyFileSync(src, dest, flags),
		cpSync: (src, dest, options) => fs.cpSync ? fs.cpSync(src, dest, options) : null,
		accessSync: (p, mode) => fs.accessSync(p, mode),
		rmSync: (p, options) => fs.rmSync(p, options),
		readdirSync: (p, options) => fs.readdirSync(p, options),
		statSync: (p) => fs.statSync(p),
		lstatSync: (p) => fs.lstatSync(p),
		promises: {
			readFile: (p, options) => fs.promises.readFile(p, options),
			writeFile: (p, data, options) => fs.promises.writeFile(p, data, options),
			access: (p, mode) => fs.promises.access(p, mode),
			unlink: (p) => fs.promises.unlink(p),
			stat: (p) => fs.promises.stat(p),
			lstat: (p) => fs.promises.lstat(p),
			mkdir: (p, options) => fs.promises.mkdir(p, options),
			readdir: (p, options) => fs.promises.readdir(p, options),
		},
		constants: {
			W_OK: fs.constants.W_OK,
			F_OK: fs.constants.F_OK,
			R_OK: fs.constants.R_OK,
			X_OK: fs.constants.X_OK,
		},
		originalFs: {
			accessSync: (p, mode) => {
				try {
					return originalFs.accessSync(p, mode);
				} catch (e) {
					return fs.accessSync(p, mode);
				}
			},
		},
	},
	existsSync: (p) => fs.existsSync(p),
	readFileSync: (p, options) => fs.readFileSync(p, options),
	writeFileSync: (p, data, options) => fs.writeFileSync(p, data, options),
	mkdirSync: (p, options) => fs.mkdirSync(p, options),
	unlinkSync: (p) => fs.unlinkSync(p),
	copyFileSync: (src, dest, flags) => fs.copyFileSync(src, dest, flags),
	cpSync: (src, dest, options) => fs.cpSync ? fs.cpSync(src, dest, options) : null,
	accessSync: (p, mode) => {
		try {
			return originalFs.accessSync(p, mode);
		} catch (e) {
			return fs.accessSync(p, mode);
		}
	},
	rmSync: (p, options) => fs.rmSync(p, options),
	readdirSync: (p, options) => fs.readdirSync(p, options),
	statSync: (p) => fs.statSync(p),
	lstatSync: (p) => fs.lstatSync(p),
	promises: {
		readFile: (p, options) => fs.promises.readFile(p, options),
		writeFile: (p, data, options) => fs.promises.writeFile(p, data, options),
		access: (p, mode) => fs.promises.access(p, mode),
		unlink: (p) => fs.promises.unlink(p),
		stat: (p) => fs.promises.stat(p),
		lstat: (p) => fs.promises.lstat(p),
		mkdir: (p, options) => fs.promises.mkdir(p, options),
		readdir: (p, options) => fs.promises.readdir(p, options),
	},
	constants: {
		W_OK: fs.constants.W_OK,
		F_OK: fs.constants.F_OK,
		R_OK: fs.constants.R_OK,
		X_OK: fs.constants.X_OK,
	},

	spawn: spawnWrapper,
	spawnSync: (command, args, options) => spawnSync(command, args, options),
	exec: (command, options, callback) => exec(command, options, callback),
	execFile: (file, args, options, callback) => execFile(file, args, options, callback),
	execSync: (command, options) => execSync(command, options),
	si: {
		graphics: () => si.graphics(),
	},
	crypto: {
		randomUUID: () => crypto.randomUUID(),
		randomBytes: (size) => crypto.randomBytes(size),
	},
	YTDlpWrap: YTDlpWrapConstructor,
	getEnv: (key) => process.env[key],
	env: envObj,
	setEnv: (key, value) => {
		process.env[key] = value;
		envObj[key] = value;
	},
	windowsStore: process.windowsStore,
	__dirname: path.join(__dirname, "html"),
});
