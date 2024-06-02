const { shell } = require("electron");

function getId(id) {
	return document.getElementById(id);
}
function querySelectorAll(element) {
	return document.querySelectorAll(element);
}
var i18n = new (require("../translations/i18n"))();

// Translating texts
getId("title").textContent = i18n.__("Preferences");
getId("back").textContent = i18n.__("Homepage");
getId("dlText").textContent = i18n.__("Download location");
getId("clText").innerHTML = i18n.__("Current download location - ");
getId("selectLocation").textContent = i18n.__("Select Download Location");
getId("preferences").textContent = i18n.__("Preferences");
getId("selectLn").textContent = i18n.__("Select Language (Requires relaunch)");
getId("browserInfo").title = i18n.__(
	"This option lets you download restricted content. You will get errors if cookies are not there"
);
getId("browserTxt").textContent = i18n.__("Select browser to use cookies from");
getId("none").textContent = i18n.__("None");
querySelectorAll(".autoTxt").forEach((item) => {
	item.textContent = i18n.__("Automatic");
});
getId("preferredAudioTxt").textContent = i18n.__("Preferred audio format");
getId("preferredVideoTxt").textContent = i18n.__("Preferred video quality");
getId("restart").textContent = i18n.__("Restart app");
getId("configTxt").textContent = i18n.__("Use configuration file");
getId("configBtn").textContent = i18n.__("Select config file");
getId("configPathTxt").textContent = i18n.__("Path:");
getId("fileFormatTxt").textContent = i18n.__("Filename format for playlists");
getId("dirFormatTxt").textContent = i18n.__("Folder name format for playlists");
getId("resetFilenameFormat").textContent = i18n.__("Reset to default");
getId("resetFoldernameFormat").textContent = i18n.__("Reset to default");
getId("maxTxt").textContent = i18n.__("Maximum number of active downloads");
getId("trayTxt").textContent = i18n.__("Close app to system tray");
getId("autoUpdateTxt").textContent = i18n.__("Disable auto updates");
getId("showMoreFormatsTxt").textContent = i18n.__("Show more format options");
getId("preferredVideoCodecTxt").textContent = i18n.__("Preferred video codec");
getId("proxyTitle").textContent = i18n.__("Proxy");

if (process.env.FLATPAK_ID) {
	getId("flatpakTxt").textContent = i18n.__(
		"You need to give the app permission to access home directory to use this. You can do it with Flatseal by enabling the permission with text 'filesystem=home'"
	);
	getId("flatpakTxt").addEventListener("click", () => {
		shell.openExternal("https://flathub.org/apps/com.github.tchx84.Flatseal")
	})
}

if (process.env.FLATPAK_ID || process.env.SNAP_NAME) {
	getId("autoUpdatesBox").style.display = "none"
}