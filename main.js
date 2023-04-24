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
const { autoUpdater } = require("electron-updater");
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;
const fs = require("fs");
const path = require("path");

autoUpdater.autoDownload = false;
let win = null;
let secondaryWindow = null;
let tray = null;
let isQuiting = false;
let indexIsOpen = true;
let trayEnabled = false;

app.commandLine.appendSwitch("--enable-features", "Metal");

function createWindow() {
	let isTransparent = false;
	if (process.platform == "linux") {
		isTransparent = true;
	}

	win = new BrowserWindow({
		show: false,
		icon: __dirname + "/assets/images/icon.png",
		spellcheck: false,
		transparent: isTransparent,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});
	win.on("close", (event) => {
		if (!isQuiting && trayEnabled) {
			event.preventDefault();
			win.hide();
			if (app.dock) app.dock.hide();
		}
		return false;
	});
	win.loadFile("html/index.html");
	win.maximize();
	// win.setMenu(null)
	win.show();
	// win.webContents.openDevTools();
	autoUpdater.checkForUpdates();
}
let loadedLanguage;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on("second-instance", (event, commandLine, workingDirectory) => {
		// Someone tried to run a second instance, we should focus our window.
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
		transparent: true
	});
	secondaryWindow.loadFile(file);
	secondaryWindow.setMenu(null);
	// secondaryWindow.maximize();
	secondaryWindow.show();
});

ipcMain.on("close-secondary", () => {
	secondaryWindow.close();
	secondaryWindow = null;
});

ipcMain.on("select-location", () => {
	const location = dialog.showOpenDialogSync(secondaryWindow, {
		properties: ["openDirectory"],
	});

	if (location) {
		if (secondaryWindow){
			secondaryWindow.webContents.send("downloadPath", location);
		}
		else{
			win.webContents.send("downloadPath", location);
		}
		
	}
});

ipcMain.on("select-config", () => {
	const location = dialog.showOpenDialogSync(secondaryWindow, {
		properties: ["openFile"],
	});

	if (location) {
		secondaryWindow.webContents.send("configPath", location);
	}
});

ipcMain.on("quit", ()=>{
	isQuiting = true;
	app.quit()
})

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
							shell.openExternal(
								"https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Mac.zip"
							);
						}
					});
				}
				// For Windows and Linux
				else {
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

autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
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
			autoUpdater.autoInstallOnAppQuit();
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
