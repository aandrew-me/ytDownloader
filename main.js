const { app, BrowserWindow } = require('electron')
const path = require('path')
require("./app.js")

function createWindow () {
  const win = new BrowserWindow({
    show:false
  })

  win.loadURL("http://localhost:3000")
  win.maximize()
  win.show()
}

app.whenReady().then(() => {
  createWindow()

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
