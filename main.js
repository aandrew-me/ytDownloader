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
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
const fs = require("fs");
const path = require("path");
const DownloadHistory = require("./src/history");
autoUpdater.autoDownload = false;
/**@type {BrowserWindow} */
let win = null;
let secondaryWindow = null;
let tray = null;
let isQuiting = false;
let indexIsOpen = true;
let trayEnabled = false;
const configFile = path.join(app.getPath("userData"), "config.json");
let downloadHistory = null;

function createWindow() {
	const bounds = JSON.parse((getItem("bounds", configFile) || "{}"));
	console.log("bounds:", bounds)

	win = new BrowserWindow({
		autoHideMenuBar: true,
		show: false,
		icon: __dirname + "/assets/images/icon.png",
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			spellcheck: false,
		},
	});
	win.setBounds(bounds)
	win.on("close", (event) => {
		if (!isQuiting && trayEnabled) {
			event.preventDefault();
			win.hide();
			if (app.dock) app.dock.hide();
		}
		return false;
	});

	win.on("resize", (event) => {
		setItem("bounds", JSON.stringify(win.getBounds()), configFile);
	});

	win.loadFile("html/index.html");
	// win.setMenu(null)
	win.show();

	autoUpdater.checkForUpdates().then(result => {
		// Removing unnecesary files for windows
		if (result && process.platform === "win32") {
			if (result.updateInfo.version === app.getVersion()) {
				fs.readdir(path.join(process.env.LOCALAPPDATA, "ytdownloader-updater"), {encoding: "utf-8", withFileTypes: true}, (err, files) => {
					if (err) {
						console.log("No update directory to clear")
					} else {
						files.forEach(file => {
							if (file.isFile()) {
								fs.rm(path.join(file.path, file.name), (_err) => {
									console.log("Removed file:", file.name)
								})
							} else {
								fs.rm(path.join(file.path, file.name), { recursive: true}, (err) => {
									console.log("Removed directory:", file.name)
								})
							}
						})
					}
				})

			}
		}
	});
}
let loadedLanguage;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on("second-instance", (event, commandLine, workingDirectory) => {
		if (win) {
			win.show();
		}
	});
}

app.whenReady().then(() => {
	// Logging
	console.log("Locale:" + app.getLocale());
	console.log("Version: " + app.getVersion());

	let locale = app.getLocale();

	if (fs.existsSync(path.join(__dirname, "translations", locale + ".json"))) {
		loadedLanguage = JSON.parse(
			fs.readFileSync(
				path.join(__dirname, "translations", locale + ".json"),
				"utf8"
			)
		);
	} else {
		loadedLanguage = JSON.parse(
			fs.readFileSync(
				path.join(__dirname, "translations", "en.json"),
				"utf8"
			)
		);
	}

	// Tray context menu
	const contextMenu = Menu.buildFromTemplate([
		{
			label: i18n("Open app"),
			click() {
				win.show();
				if (app.dock) app.dock.show();
			},
		},
		{
			label: i18n("Paste video link"),
			click() {
				const text = clipboard.readText();
				if (indexIsOpen) {
					win.show();
					if (app.dock) app.dock.show();
					win.webContents.send("link", text);
				} else {
					win.loadFile("html/index.html");
					win.show();
					indexIsOpen = true;
					let sent = false;
					ipcMain.on("ready-for-links", () => {
						if (!sent) {
							win.webContents.send("link", text);
							sent = true;
						}
					});
				}
			},
		},
		{
			label: i18n("Download playlist"),
			click() {
				indexIsOpen = false;
				win.loadFile("html/playlist.html");
				win.show();
				if (app.dock) app.dock.show();
			},
		},
		{
			label: i18n("Quit"),
			click() {
				isQuiting = true;
				app.quit();
			},
		},
	]);

	let trayInUse = false;
	// TODO: Find why tray icon isn't showing properly on gnome
	let icon;
	if (process.platform == "win32") {
		icon = path.join(__dirname, "resources/icon.ico");
	} else if (process.platform == "darwin") {
		icon = path.join(__dirname, "resources/icons/16x16.png");
	} else {
		icon = path.join(__dirname, "resources/icons/256x256.png");
	}
	ipcMain.on("useTray", (_, enabled) => {
		if (enabled && !trayInUse) {
			trayEnabled = true;
			trayInUse = true;
			tray = new Tray(icon);
			tray.setToolTip("ytDownloader");
			tray.setContextMenu(contextMenu);
			tray.on("click", () => {
				win.show();
				if (app.dock) app.dock.show();
			});
		} else if (!enabled) {
			trayEnabled = false;
		}
	});

	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
	if (process.platform === "win32") {
		app.setAppUserModelId(app.name);
	}
});

ipcMain.on("reload", () => {
	if (win) {
		win.reload();
	}
	if (secondaryWindow) {
		secondaryWindow.reload();
	}
});

ipcMain.on("get-version", () => {
	const version = app.getVersion();
	secondaryWindow.webContents.send("version", version);
});

ipcMain.on("show-file", (_event, fullPath) => {
	if (fullPath && fs.existsSync(fullPath)) {
		shell.showItemInFolder(fullPath);
	}
});

ipcMain.handle("open-file-safe", async (_event, fullPath) => {
	try {
		if (!fullPath || typeof fullPath !== "string") {
			return { success: false, error: "Invalid file path" };
		}

		if (!fs.existsSync(fullPath)) {
			return { success: false, error: "File not found - it may have been deleted or moved" };
		}

		shell.showItemInFolder(fullPath);
		return { success: true };
	} catch (error) {
		return { success: false, error: error.message };
	}
});

ipcMain.on("load-win", (event, file) => {
	if (file.includes("playlist.html")) {
		indexIsOpen = false;
	} else {
		indexIsOpen = true;
	}
	win.loadFile(file);
});
ipcMain.on("load-page", (event, file) => {
	secondaryWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
		parent: win,
		modal: true,
		show: false,
	});
	secondaryWindow.loadFile(file);
	secondaryWindow.setMenu(null);
	// secondaryWindow.maximize();
	// secondaryWindow.webContents.openDevTools()
	secondaryWindow.show();
	
});

ipcMain.on("close-secondary", () => {
	secondaryWindow.close();
	secondaryWindow = null;
});

ipcMain.on("select-location-main", () => {
	const location = dialog.showOpenDialogSync({
		properties: ["openDirectory"],
	});

	if (location) {
		win.webContents.send("downloadPath", location);
	}
});

ipcMain.on("select-location-secondary", () => {
	const location = dialog.showOpenDialogSync({
		properties: ["openDirectory"],
	});

	if (location) {
		secondaryWindow.webContents.send("downloadPath", location);
	}
});

ipcMain.on("get-directory", () => {
	const location = dialog.showOpenDialogSync({
		properties: ["openDirectory"],
	});

	if (location) {
		win.webContents.send("directory-path", location);
	}
});

ipcMain.on("select-config", () => {
	const location = dialog.showOpenDialogSync({
		properties: ["openFile"],
	});

	if (location) {
		secondaryWindow.webContents.send("configPath", location);
	}
});

ipcMain.on("quit", () => {
	isQuiting = true;
	app.quit();
});

// ipcMain.handle('get-proxy', async (event, url) => {
//   const sess = event.sender.session; // get session from sender
//   const proxy = await sess.resolveProxy(url);
//   return proxy;
// });
// Auto update
let autoUpdate = false;

ipcMain.on("autoUpdate", (event, status) => {
	autoUpdate = status;
	console.log("Auto update:", status);

	if (autoUpdate === true) {
		// Auto updater events
		autoUpdater.on(
			"update-available",
			(_event, releaseNotes, releaseName) => {
				// For macOS
				if (process.platform === "darwin") {
					/**
					 * @type {Electron.MessageBoxOptions}
					 */
					const dialogOpts = {
						type: "info",
						buttons: [i18n("Download"), i18n("No")],
						title: "Update Available",
						detail: releaseName,
						message: i18n(
							"A new version is available, do you want to download it?"
						),
					};
					dialog.showMessageBox(dialogOpts).then((returnValue) => {
						if (returnValue.response === 0) {
							if (process.arch === 'x64') {
								shell.openExternal(
									"https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Mac_x64.dmg"
								);
							} else {
								shell.openExternal(
									"https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Mac_arm64.dmg"
								);
							}
						}
					});
				}
				// For Windows and Linux
				else {
					/**
					 * @type {Electron.MessageBoxOptions}
					 */
					const dialogOpts = {
						type: "info",
						buttons: [i18n("Update"), i18n("No")],
						title: "Update Available",
						detail:
							process.platform === "win32"
								? releaseNotes
								: releaseName,
						message: i18n(
							"A new version is available, do you want to update?"
						),
					};
					dialog.showMessageBox(dialogOpts).then((returnValue) => {
						if (returnValue.response === 0) {
							autoUpdater.downloadUpdate();
						}
					});
				}
			}
		);
	}
});

ipcMain.on("progress", (_event, percentage) => {
	if (win) {
		win.setProgressBar(percentage)
	}
})

ipcMain.on("error_dialog", (_event, message) => {
	dialog.showMessageBox(win, {
		type: "error",
		title: "Error",
		message: message,
		buttons: [
			"Ok", "Copy error"
		]
	}).then((result) => {
		if (result.response == 1) {
			clipboard.writeText(message)
		}
	})
})

autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
	/**
	 * @type {Electron.MessageBoxOptions}
	 */
	const dialogOpts = {
		type: "info",
		buttons: [i18n("Restart"), i18n("Later")],
		title: "Update Ready",
		message: i18n("Install and restart now?"),
	};
	dialog.showMessageBox(dialogOpts).then((returnValue) => {
		if (returnValue.response === 0) {
			autoUpdater.quitAndInstall();
		} else {
			autoUpdater.autoInstallOnAppQuit;
		}
	});
});

// Translation
function i18n(phrase) {
	let translation = loadedLanguage[phrase];
	if (translation === undefined) {
		translation = phrase;
	}
	return translation;
}

/**
 * @param {string} itemName
 * @param {string} itemContent
 * @param {string} configPath
 */
function setItem(itemName, itemContent, configPath) {
	let config = {};
	if (fs.existsSync(configPath)) {
		const fileContent = fs.readFileSync(configPath).toString();
		try {
			config = fileContent ? JSON.parse(fileContent) : {};
			config[itemName] = itemContent;
		} catch (error) {
			console.log("Error has occured trying to save window info", error)
		}
	} else {
		config[itemName] = itemContent;
	}

	fs.writeFileSync(configPath, JSON.stringify(config));
}

/**
 * @param {string} item
 * @param {string} configPath
 * @returns {string}
 */
function getItem(item, configPath) {
	if (fs.existsSync(configPath)) {
		try {
			const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
			return configData[item] || "";
		} catch (err) {
			return "";
		}
	} else {
		return "";
	}
}

// Download History
app.whenReady().then(() => {
	downloadHistory = new DownloadHistory();
});

ipcMain.handle("get-download-history", async () => {
	try {
		if (!downloadHistory) {
			downloadHistory = new DownloadHistory();
		}
		return downloadHistory.getHistory();
	} catch (error) {
		console.error("Error getting download history:", error);
		throw new Error("Failed to retrieve download history");
	}
});

ipcMain.handle("add-to-history", async (event, downloadInfo) => {
	try {
		if (!downloadHistory) {
			downloadHistory = new DownloadHistory();
		}
		return downloadHistory.addDownload(downloadInfo);
	} catch (error) {
		console.error("Error adding to history:", error);
		throw new Error("Failed to add download to history");
	}
});

ipcMain.handle("get-download-stats", async () => {
	try {
		if (!downloadHistory) {
			downloadHistory = new DownloadHistory();
		}
		return downloadHistory.getStats();
	} catch (error) {
		console.error("Error getting download stats:", error);
		throw new Error("Failed to retrieve download statistics");
	}
});

ipcMain.handle("delete-history-item", async (event, id) => {
	try {
		if (!downloadHistory) {
			downloadHistory = new DownloadHistory();
		}
		return downloadHistory.removeHistoryItem(id);
	} catch (error) {
		console.error("Error deleting history item:", error);
		throw new Error("Failed to delete history item");
	}
});

ipcMain.handle("clear-all-history", async () => {
	try {
		if (!downloadHistory) {
			downloadHistory = new DownloadHistory();
		}
		downloadHistory.clearHistory();
		return true;
	} catch (error) {
		console.error("Error clearing history:", error);
		throw new Error("Failed to clear download history");
	}
});

ipcMain.handle("export-history-json", async () => {
	try {
		if (!downloadHistory) {
			downloadHistory = new DownloadHistory();
		}
		return downloadHistory.exportAsJSON();
	} catch (error) {
		console.error("Error exporting history as JSON:", error);
		throw new Error("Failed to export history as JSON");
	}
});

ipcMain.handle("export-history-csv", async () => {
	try {
		if (!downloadHistory) {
			downloadHistory = new DownloadHistory();
		}
		return downloadHistory.exportAsCSV();
	} catch (error) {
		console.error("Error exporting history as CSV:", error);
		throw new Error("Failed to export history as CSV");
	}
});

