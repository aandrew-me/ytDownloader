const path = require("path");
const fs = require("fs");
const {ipcRenderer} = require("electron");

function normalizeLocale(locale) {
	if (!locale) return "en";
	const parts = locale.split("-");
	const lang = parts[0].toLowerCase();
	const region = parts[1] ? parts[1].toUpperCase() : null;

	const defaultRegions = {
		zh: "CN",
		en: "US",
		ru: "RU",
		pt: "BR",
		fi: "FI",
		fr: "FR",
		es: "ES",
		de: "DE",
		it: "IT",
		ja: "JP",
		ar: "SA",
	};

	if (!region && defaultRegions[lang]) {
		return `${lang}-${defaultRegions[lang]}`;
	}

	return region ? `${lang}-${region}` : lang;
}

function getLocaleSync() {
	try {
		const saved = localStorage.getItem("locale");
		if (saved) return saved;
	} catch (e) {}

	let locale = null;
	try {
		locale = ipcRenderer.sendSync("get-system-locale");
	} catch (e) {}

	if (!locale && typeof navigator !== "undefined") {
		locale = navigator.language || (navigator.languages && navigator.languages[0]);
	}

	const normalized = normalizeLocale(locale || "en");

	try {
		localStorage.setItem("locale", normalized);
	} catch (e) {}

	return normalized;
}

function I18n() {
	this.locale = getLocaleSync();

	const localeFile = path.join(__dirname, `${this.locale}.json`);
	const fallbackFile = path.join(__dirname, "en.json");

	if (fs.existsSync(localeFile)) {
		this.loadedLanguage = JSON.parse(fs.readFileSync(localeFile, "utf8"));
	} else {
		this.loadedLanguage = JSON.parse(fs.readFileSync(fallbackFile, "utf8"));
	}

	this.__ = function (phrase) {
		return this.loadedLanguage[phrase] !== undefined
			? this.loadedLanguage[phrase]
			: phrase;
	};


	this.setLocale = function (newLocale) {
		const normalized = normalizeLocale(newLocale);
		localStorage.setItem("locale", normalized);
		const file = path.join(__dirname, `${normalized}.json`);
		const data = fs.existsSync(file)
			? fs.readFileSync(file, "utf8")
			: fs.readFileSync(path.join(__dirname, "en.json"), "utf8");
		this.loadedLanguage = JSON.parse(data);
		this.locale = normalized;
	};
}

module.exports = I18n;
