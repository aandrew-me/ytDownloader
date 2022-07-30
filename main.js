const { app, BrowserWindow } = require('electron')
const { autoUpdater } = require("electron-updater")
const path = require('path')
require("./app.js")

function createWindow () {
  const win = new BrowserWindow({
    show:false
  })

  win.loadURL("http://localhost:59876")
  win.maximize()
  win.show()
}

app.whenReady().then(() => {
  createWindow()
  autoUpdater.checkForUpdatesAndNotify()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
