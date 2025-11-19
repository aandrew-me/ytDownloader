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

async function getLocale() {
	try {
		const saved = localStorage.getItem("locale");
		if (saved) return saved;
	} catch (e) {}

	let locale = null;
	try {
		locale = await ipcRenderer.invoke("get-system-locale");
	} catch (e) {
		console.log(e)
	}

	if (!locale && typeof navigator !== "undefined") {
		locale =
			navigator.language ||
			(navigator.languages && navigator.languages[0]);
	}

	const normalized = normalizeLocale(locale || "en");

	try {
		localStorage.setItem("locale", normalized);
	} catch (e) {}

	return normalized;
}

function I18n() {
	this.loadedLanguage = {};
	this.locale = "en";

	this.init = async () => {
		try {
			this.locale = await getLocale();
			this.loadedLanguage = await ipcRenderer.invoke(
				"get-translation",
				this.locale
			);
		} catch (error) {
			console.error("Error loading translations:", error);
			this.loadedLanguage = {};
		}
	};

	this.__ = function (phrase) {
		return this.loadedLanguage[phrase] !== undefined
			? this.loadedLanguage[phrase]
			: phrase;
	};

	this.translatePage = () => {
		document.querySelectorAll("[data-translate]").forEach((element) => {
			const key = element.getAttribute("data-translate");
			element.textContent = this.__(key);
		});

		document
			.querySelectorAll("[data-translate-placeholder]")
			.forEach((element) => {
				const key = element.getAttribute("data-translate-placeholder");
				element.placeholder = this.__(key);
			});

		document
			.querySelectorAll("[data-translate-title]")
			.forEach((element) => {
				const key = element.getAttribute("data-translate-title");
				element.title = this.__(key);
			});
	};

	this.setLocale = async function (newLocale) {
		const normalized = normalizeLocale(newLocale);
		localStorage.setItem("locale", normalized);
		this.loadedLanguage = await ipcRenderer.invoke(
			"get-translation",
			normalized
		);
		this.locale = normalized;

		this.translatePage();
	};
}

module.exports = I18n;
