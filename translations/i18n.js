const path = require("path")
const electron = require('electron')
const fs = require('fs');
const { ipcRenderer } = require("electron");
let loadedLanguage;
let locale;
if(electron.app){
     locale = app.getLocale()
}
else{
     ipcRenderer.send("get-locale")
     ipcRenderer.once("locale", (event, locale)=>{
          locale = locale
     })
}

module.exports = i18n;

function i18n() {
    if(fs.existsSync(path.join(__dirname, locale + '.json'))) {
         loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, locale + '.json'), 'utf8'))
    }
    else {
         loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8'))
    }
}

i18n.prototype.__ = function(phrase) {
    let translation = loadedLanguage[phrase]
    if(translation === undefined) {
         translation = phrase
    }
    return translation
}