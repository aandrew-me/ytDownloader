const path = require("path");
const electron = require("electron");
const fs = require("fs");
let loadedLanguage;
let userSelectedLanguage = false;
let locale;
if (electron.app) {
	locale = electron.app.getLocale();
} else {
	locale = navigator.language
}

// Check localstorage for language
if (localStorage.getItem("language")){
	locale =  localStorage.getItem("language")
	userSelectedLanguage = true;
}
else{
	localStorage.setItem("language", locale.slice(0, 2))
}

module.exports = i18n;

function i18n() {
	if (fs.existsSync(path.join(__dirname, locale + ".json"))) {
		loadedLanguage = JSON.parse(
			fs.readFileSync(path.join(__dirname, locale + ".json"), "utf8")
		);
	} else {
		loadedLanguage = JSON.parse(
			fs.readFileSync(path.join(__dirname, "en.json"), "utf8")
		);
	}
}

i18n.prototype.__ = function (phrase) {
	let translation = loadedLanguage[phrase];
	if (translation === undefined) {
		translation = phrase;
	}
	return translation;
};
