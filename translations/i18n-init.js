const I18nClass = window.I18n;
const i18nInstance = new I18nClass();

(async () => {
	await i18nInstance.init();
	document.dispatchEvent(new Event("translations-loaded"));
})();

window.i18n = i18nInstance;
