const {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	shell,
	Tray,
	Menu,
	clipboard,
} = require("electron");
const {autoUpdater} = require("electron-updater");
const fs = require("fs").promises;
const {existsSync, readFileSync} = require("fs");
const path = require("path");
const DownloadHistory = require("./src/history");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
autoUpdater.autoDownload = false;

const USER_DATA_PATH = app.getPath("userData");
const CONFIG_FILE_PATH = path.join(USER_DATA_PATH, "ytdownloader.json");

const appState = {
	/** @type {BrowserWindow | null} */
	mainWindow: null,
	/** @type {BrowserWindow | null} */
	secondaryWindow: null,
	/** @type {Tray | null} */
	tray: null,
	isQuitting: false,
	indexPageIsOpen: true,
	trayEnabled: false,
	loadedLanguage: {},
	config: {},
	downloadHistory: new DownloadHistory(),
	autoUpdateEnabled: false,
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (appState.mainWindow) {
			if (appState.mainWindow.isMinimized())
				appState.mainWindow.restore();
			appState.mainWindow.show();
			appState.mainWindow.focus();
		}
	});
}

app.whenReady().then(async () => {
	await initialize();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("before-quit", async () => {
	appState.isQuitting = true;
	try {
		// Save the final config state before exiting.
		await saveConfiguration();
	} catch (error) {
		console.error("Failed to save configuration during quit:", error);
	}
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

/**
 * Initializes the application by loading config, translations,
 * and setting up handlers.
 */
async function initialize() {
	await loadConfiguration();
	await loadTranslations();

	registerIpcHandlers();
	registerAutoUpdaterEvents();

	createWindow();

	if (process.platform === "win32") {
		app.setAppUserModelId(app.name);
	}
}

function createWindow() {
	const bounds = appState.config.bounds || {};

	appState.mainWindow = new BrowserWindow({
		...bounds,
		minWidth: 800,
		minHeight: 600,
		autoHideMenuBar: true,
		show: false,
		icon: path.join(__dirname, "/assets/images/icon.png"),
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			spellcheck: false,
		},
	});

	appState.mainWindow.loadFile("html/index.html");

	appState.mainWindow.once("ready-to-show", () => {
		if (appState.config.isMaximized) {
			appState.mainWindow.maximize();
		}
		appState.mainWindow.show();
	});

	const saveBounds = () => {
		if (appState.mainWindow && !appState.mainWindow.isMaximized()) {
			appState.config.bounds = appState.mainWindow.getBounds();
		}
	};

	appState.mainWindow.on("resize", saveBounds);
	appState.mainWindow.on("move", saveBounds);

	appState.mainWindow.on("maximize", () => {
		appState.config.isMaximized = true;
	});

	appState.mainWindow.on("unmaximize", () => {
		appState.config.isMaximized = false;
	});

	appState.mainWindow.on("close", (event) => {
		if (!appState.isQuitting && appState.trayEnabled) {
			event.preventDefault();
			appState.mainWindow.hide();
			if (app.dock) app.dock.hide();
		}
	});
}

/**
 * @param {string} file The HTML file to load.
 */
function createSecondaryWindow(file) {
	if (appState.secondaryWindow) {
		appState.secondaryWindow.focus();
		return;
	}

	appState.secondaryWindow = new BrowserWindow({
		parent: appState.mainWindow,
		modal: true,
		show: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
		width: 1000,
		height: 800,
	});

	// appState.secondaryWindow.webContents.openDevTools();
	appState.secondaryWindow.loadFile(file);
	appState.secondaryWindow.setMenu(null);
	appState.secondaryWindow.once("ready-to-show", () => {
		appState.secondaryWindow.show();
	});

	appState.secondaryWindow.on("closed", () => {
		appState.secondaryWindow = null;
	});
}

/**
 * Creates the system tray icon
 */
function createTray() {
	if (appState.tray) return;

	let iconPath;
	if (process.platform === "win32") {
		iconPath = path.join(__dirname, "resources/icon.ico");
	} else if (process.platform === "darwin") {
		iconPath = path.join(__dirname, "resources/icons/16x16.png");
	} else {
		iconPath = path.join(__dirname, "resources/icons/256x256.png");
	}

	appState.tray = new Tray(iconPath);

	const contextMenu = Menu.buildFromTemplate([
		{
			label: i18n("openApp"),
			click: () => {
				appState.mainWindow?.show();
				if (app.dock) app.dock.show();
			},
		},
		{
			label: i18n("pasteVideoLink"),
			click: async () => {
				const text = clipboard.readText();
				appState.mainWindow?.show();
				if (app.dock) app.dock.show();
				if (appState.indexPageIsOpen) {
					appState.mainWindow.webContents.send("link", text);
				} else {
					await appState.mainWindow.loadFile("html/index.html");
					appState.indexPageIsOpen = true;
					appState.mainWindow.webContents.once(
						"did-finish-load",
						() => {
							appState.mainWindow.webContents.send("link", text);
						}
					);
				}
			},
		},
		{
			label: i18n("downloadPlaylistButton"),
			click: () => {
				appState.indexPageIsOpen = false;
				appState.mainWindow?.loadFile("html/playlist.html");
				appState.mainWindow?.show();
				if (app.dock) app.dock.show();
			},
		},
		{
			label: i18n("quit"),
			click: () => {
				app.quit();
			},
		},
	]);

	appState.tray.setToolTip("ytDownloader");
	appState.tray.setContextMenu(contextMenu);
	appState.tray.on("click", () => {
		appState.mainWindow?.show();

		if (app.dock) app.dock.show();
	});
}

function registerIpcHandlers() {
	ipcMain.on("autoUpdate", (_event, status) => {
		appState.autoUpdateEnabled = status;

		if (status) {
			autoUpdater.checkForUpdates();
		}
	});

	ipcMain.on("reload", () => {
		appState.mainWindow?.reload();
		appState.secondaryWindow?.reload();
	});

	ipcMain.on("get-version", (event) => {
		event.sender.send("version", app.getVersion());
	});

	ipcMain.on("show-file", async (_event, fullPath) => {
		try {
			await fs.stat(fullPath);
			shell.showItemInFolder(fullPath);
		} catch (error) {}
	});

	ipcMain.handle("show-file", async (_event, fullPath) => {
		try {
			await fs.stat(fullPath);
			shell.showItemInFolder(fullPath);

			return {success: true};
		} catch (error) {
			return {success: false, error: error.message};
		}
	});


	ipcMain.handle("open-folder", async (_event, folderPath) => {
		try {
			await fs.stat(folderPath);
			const result = await shell.openPath(folderPath);
			if (result) {
				return {success: false, error: result};
			} else {
				return {success: true};
			}
		} catch (error) {
			return {success: false, error: error.message};
		}
	});

	ipcMain.on("load-win", (_event, file) => {
		appState.indexPageIsOpen = file.includes("index.html");
		appState.mainWindow?.loadFile(file);
	});

	ipcMain.on("load-page", (_event, file) => {
		createSecondaryWindow(file);
	});

	ipcMain.on("close-secondary", () => {
		appState.secondaryWindow?.close();
	});

	ipcMain.on("quit", () => {
		app.quit();
	});

	ipcMain.on("select-location-main", async () => {
		if (!appState.mainWindow) return;
		const {canceled, filePaths} = await dialog.showOpenDialog(
			appState.mainWindow,
			{properties: ["openDirectory"]}
		);
		if (!canceled && filePaths.length > 0) {
			appState.mainWindow.webContents.send("downloadPath", filePaths);
		}
	});

	ipcMain.on("select-location-secondary", async () => {
		if (!appState.secondaryWindow) return;
		const {canceled, filePaths} = await dialog.showOpenDialog(
			appState.secondaryWindow,
			{properties: ["openDirectory"]}
		);
		if (!canceled && filePaths.length > 0) {
			appState.secondaryWindow.webContents.send(
				"downloadPath",
				filePaths
			);
		}
	});

	ipcMain.on("get-directory", async () => {
		if (!appState.mainWindow) return;
		const {canceled, filePaths} = await dialog.showOpenDialog(
			appState.mainWindow,
			{properties: ["openDirectory"]}
		);
		if (!canceled && filePaths.length > 0) {
			appState.mainWindow.webContents.send("directory-path", filePaths);
		}
	});

	ipcMain.on("select-config", async () => {
		if (!appState.secondaryWindow) return;
		const {canceled, filePaths} = await dialog.showOpenDialog(
			appState.secondaryWindow,
			{properties: ["openFile"]}
		);
		if (!canceled && filePaths.length > 0) {
			appState.secondaryWindow.webContents.send("configPath", filePaths);
		}
	});

	ipcMain.on("useTray", (_event, enabled) => {
		appState.trayEnabled = enabled;
		if (enabled) createTray();
		else {
			appState.tray?.destroy();
			appState.tray = null;
		}
	});

	ipcMain.on("progress", (_event, percentage) => {
		if (appState.mainWindow) appState.mainWindow.setProgressBar(percentage);
	});

	ipcMain.on("error_dialog", async (_event, message) => {
		const {response} = await dialog.showMessageBox(appState.mainWindow, {
			type: "error",
			title: "Error",
			message: message,
			buttons: ["Ok", "Copy error"],
		});
		if (response === 1) clipboard.writeText(message);
	});

	ipcMain.on("get-system-locale", (event) => {
		event.returnValue = app.getSystemLocale();
	});

	ipcMain.handle("get-translation", (_event, locale) => {
		const fallbackFile = path.join(__dirname, "translations", "en.json");
		const localeFile = path.join(
			__dirname,
			"translations",
			`${locale}.json`
		);

		const fallbackData = JSON.parse(readFileSync(fallbackFile, "utf8"));

		let localeData = {};
		if (locale !== "en" && existsSync(localeFile)) {
			try {
				localeData = JSON.parse(readFileSync(localeFile, "utf8"));
			} catch (e) {
				console.error(`Could not parse ${localeFile}`, e);
			}
		}

		const mergedTranslations = {...fallbackData, ...localeData};

		return mergedTranslations;
	});

	ipcMain.handle("get-download-history", () =>
		appState.downloadHistory.getHistory()
	);
	ipcMain.handle("add-to-history", (_, info) =>
		appState.downloadHistory.addDownload(info)
	);
	ipcMain.handle("get-download-stats", () =>
		appState.downloadHistory.getStats()
	);
	ipcMain.handle("delete-history-item", (_, id) =>
		appState.downloadHistory.removeHistoryItem(id)
	);
	ipcMain.handle("clear-all-history", async () => {
		await appState.downloadHistory.clearHistory();
		return true;
	});
	ipcMain.handle("export-history-json", () =>
		appState.downloadHistory.exportAsJSON()
	);
	ipcMain.handle("export-history-csv", () =>
		appState.downloadHistory.exportAsCSV()
	);
}

function registerAutoUpdaterEvents() {
	autoUpdater.on("update-available", async (info) => {
		const dialogOpts = {
			type: "info",
			buttons: [i18n("update"), i18n("no")],
			title: "Update Available",
			message: i18n("updateAvailablePrompt"),
			detail:
				info.releaseNotes?.toString().replace(/<[^>]*>?/gm, "") ||
				"No details available.",
		};
		const {response} = await dialog.showMessageBox(
			appState.mainWindow,
			dialogOpts
		);
		if (response === 0) {
			autoUpdater.downloadUpdate();
		}
	});

	autoUpdater.on("update-downloaded", async () => {
		const dialogOpts = {
			type: "info",
			buttons: [i18n("restart"), i18n("later")],
			title: "Update Ready",
			message: i18n("installAndRestartPrompt"),
		};
		const {response} = await dialog.showMessageBox(
			appState.mainWindow,
			dialogOpts
		);
		if (response === 0) {
			autoUpdater.quitAndInstall();
		}
	});

	autoUpdater.on("error", (error) => {
		console.error("Auto-update error:", error);
		dialog.showErrorBox(
			"Update Error",
			i18n("updateError")
		);
	});
}

/**
 * @param {string} phrase The key to translate.
 * @returns {string} The translated string or the key itself.
 */
function i18n(phrase) {
	return appState.loadedLanguage[phrase] || phrase;
}

/**
 * Loads the configuration from the config file.
 */
async function loadConfiguration() {
	try {
		const fileContent = await fs.readFile(CONFIG_FILE_PATH, "utf8");
		appState.config = JSON.parse(fileContent);
	} catch (error) {
		console.log(
			"Could not load config file, using defaults.",
			error.message
		);
		appState.config = {
			bounds: {width: 1024, height: 768},
			isMaximized: false,
		};
	}
}

async function saveConfiguration() {
	try {
		await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(appState.config));
	} catch (error) {
		console.error("Failed to save configuration:", error);
	}
}

async function loadTranslations() {
	const locale = app.getSystemLocale();
	console.log({locale});
	const defaultLangPath = path.join(__dirname, "translations", "en.json");
	let langPath = path.join(__dirname, "translations", `${locale}.json`);

	try {
		await fs.access(langPath);
	} catch {
		langPath = defaultLangPath;
	}

	try {
		const fileContent = await fs.readFile(langPath, "utf8");
		appState.loadedLanguage = JSON.parse(fileContent);
	} catch (error) {
		console.error("Failed to load translation file:", error);
		appState.loadedLanguage = {};
	}
}
