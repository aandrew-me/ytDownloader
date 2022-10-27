const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");

autoUpdater.autoDownload = false;
let win, secondaryWindow;

app.commandLine.appendSwitch("--enable-features", "Metal");

function createWindow() {
	let isTransparent = false;
	if (process.platform == "linux") {
		isTransparent = true;
	}

	win = new BrowserWindow({
		show: false,
		icon: __dirname + "/public/icon.png",
		spellcheck: false,
		transparent: isTransparent,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	win.loadFile("html/index.html");
	win.maximize();
	// win.setMenu(null)
	win.show();
	// win.webContents.openDevTools();
	autoUpdater.checkForUpdates();
}
let loadedLanguage;
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

ipcMain.on("restart", () => {
	app.relaunch();
	app.exit();
});

ipcMain.on("get-version", () => {
	const version = app.getVersion();
	secondaryWindow.webContents.send("version", version);
});

ipcMain.on("load-win", (event, file) => {
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
	secondaryWindow.show();
});

ipcMain.on("close-secondary", () => {
	secondaryWindow.close();
	secondaryWindow = null;
});

ipcMain.on("select-location", () => {
	const location = dialog.showOpenDialogSync(secondaryWindow, {
		properties: ["openFile", "openDirectory"],
	});

	if (location) {
		secondaryWindow.webContents.send("downloadPath", location);
	}
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// Auto updater events
autoUpdater.on("update-available", (_event, releaseNotes, releaseName) => {
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
			detail: process.platform === "win32" ? releaseNotes : releaseName,
			message: i18n("A new version is available, do you want to update?"),
		};
		dialog.showMessageBox(dialogOpts).then((returnValue) => {
			if (returnValue.response === 0) {
				autoUpdater.downloadUpdate();
			}
		});
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
