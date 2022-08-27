const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
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
			contextIsolation: false,
		},
	});

	win.loadFile("html/index.html");
	win.maximize();
	// win.setMenu(null)
	win.show();
	// win.webContents.openDevTools();
	autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
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
	// win.loadFile(file);
	secondaryWindow.loadFile(file);
	secondaryWindow.setMenu(null)
	secondaryWindow.maximize();
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
		buttons: ["Ok"],
		title: "Application Update",
		message: process.platform === "win32" ? releaseNotes : releaseName,
		detail: "A new version is being downloaded.",
	};
	dialog.showMessageBox(dialogOpts, (response) => {});
});

autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
	const dialogOpts = {
		type: "info",
		buttons: ["Restart", "Later"],
		title: "Application Update",
		message: process.platform === "win32" ? releaseNotes : releaseName,
		detail: "A new version has been downloaded. Restart the application to apply the updates.",
	};
	dialog.showMessageBox(dialogOpts).then((returnValue) => {
		if (returnValue.response === 0) autoUpdater.quitAndInstall();
	});
});
