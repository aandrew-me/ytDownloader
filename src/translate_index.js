const {platform} = require("os");

function getId(id) {
	return document.getElementById(id);
}
function querySelector(element) {
	return document.querySelector(element);
}
const i18n = new (require("../translations/i18n"))();

// Translating texts
getId("pasteText").textContent = i18n.__(
	"Click to paste video link from clipboard"
);

if (platform() === "darwin") {
	getId("pasteCtrlKey").textContent = "⌘";
}
querySelector("#popup p").textContent = i18n.__("yt-dlp is being downloaded");
getId("preferenceWin").textContent = i18n.__("Preferences");
getId("aboutWin").textContent = i18n.__("About");
getId("playlistWin").textContent = i18n.__("Download playlist");
getId("compressorWin").textContent = i18n.__("Compressor");
getId("historyWin").textContent = i18n.__("Download History");
document.querySelectorAll(".formatSelect").forEach((element) => {
	element.textContent = i18n.__("Select Format ");
});
getId("videoDownload").textContent = i18n.__("Download");
getId("audioDownload").textContent = i18n.__("Download");
getId("videoToggle").textContent = i18n.__("Video");
getId("videoHeader").textContent = i18n.__("Video");
getId("audioToggle").textContent = i18n.__("Audio");
getId("audioHeader").textContent = i18n.__("Audio");
getId("advancedVideoToggle").textContent = i18n.__("More options");
getId("advancedAudioToggle").textContent = i18n.__("More options");
getId("rangeText").textContent = i18n.__("Download particular time-range");
getId("processing").textContent = i18n.__("Processing");
getId("subHeader").textContent = i18n.__("Subtitles");
getId("subTxt").textContent = i18n.__("Download subtitles if available");
getId("extractHeader").textContent = i18n.__("Extract Audio");
getId("extractBtn").textContent = i18n.__("Extract");
getId("errorBtn").textContent = i18n.__("Error Details")+" ▼"
getId("extractQualitySelectTxt").textContent = i18n.__("Select Quality")
getId("extractQualityNormal").textContent = i18n.__("Normal")
getId("extractQualityBest").textContent = i18n.__("Best")
getId("extractQualityGood").textContent = i18n.__("Good")
getId("extractQualityBad").textContent = i18n.__("Bad")
getId("extractQualityWorst").textContent = i18n.__("Worst")
getId("quitTxt").textContent = i18n.__("Close app when download finishes")
getId("clText").textContent = i18n.__("Current download location - ")
getId("selectLocation").textContent = i18n.__("Select Download Location");
getId("themeTxt").textContent = i18n.__("Theme");

getId("lightTxt").textContent = i18n.__("Light");
getId("darkTxt").textContent = i18n.__("Dark");
getId("frappeTxt").textContent = i18n.__("Frappé");
getId("onedarkTxt").textContent = i18n.__("One Dark");
getId("matrixTxt").textContent = i18n.__("Matrix");
getId("githubTxt").textContent = i18n.__("Github");
getId("latteTxt").textContent = i18n.__("Latte");
getId("solarizedDarkTxt").textContent = i18n.__("Solarized Dark");
getId("clearBtn").textContent = i18n.__("Clear Downloads");
getId("popupMacTxt").textContent = i18n.__("You need to download yt-dlp from homebrew first");
getId("openHomebrew").textContent = i18n.__("Open Homebrew");

