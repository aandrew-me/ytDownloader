const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
autoUpdater.autoDownload = false;
let win, secondaryWindow;

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
			contextIsolation: false
		},
	});

	win.loadFile("html/index.html");
	win.maximize();
	// win.setMenu(null)
	win.show();
	// win.webContents.openDevTools();
	autoUpdater.checkForUpdates();
}

app.whenReady().then(() => {
	// Logging
	console.log("Locale:" + app.getLocale());
	console.log("Version: " + app.getVersion());

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
})

ipcMain.on("get-version", () => {
	const version = app.getVersion();
	secondaryWindow.webContents.send("version", version);
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
	const dialogOpts = {
		type: "info",
		buttons: ["Update", "No"],
		title: "Update Available",
		detail: process.platform === "win32" ? releaseNotes : releaseName,
		message: "A new version is available, do you want to update?",
	};
	dialog.showMessageBox(dialogOpts).then((returnValue) =>{
		if (returnValue.response === 0) {
			autoUpdater.downloadUpdate();
		}
	});
});

autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
	const dialogOpts = {
		type: "info",
		buttons: ["Restart", "Later"],
		title: "Update Ready",
		message: "Install and restart now?",
	};
	dialog.showMessageBox(dialogOpts).then((returnValue) => {
		if (returnValue.response === 0) {
			autoUpdater.quitAndInstall();
		} else {
			autoUpdater.autoInstallOnAppQuit();
		}
	});
});
