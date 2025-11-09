const I18n = require("../translations/i18n");
const i18n = new I18n();

(async () => {
	await i18n.init();
	document.dispatchEvent(new Event("translations-loaded"));
})();

window.i18n = i18n;
