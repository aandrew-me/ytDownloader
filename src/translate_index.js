function getId(id) {
	return document.getElementById(id);
}
function querySelector(element) {
	return document.querySelector(element);
}
const i18n = new (require("../translations/i18n"))();

// Translating texts
getId("pasteUrl").textContent = i18n.__(
	"Click to paste video link from clipboard [Ctrl + V]"
);
querySelector("#popup p").textContent = i18n.__("yt-dlp is being downloaded");
getId("preferenceWin").textContent = i18n.__("Preferences");
getId("aboutWin").textContent = i18n.__("About");
getId("playlistWin").textContent = i18n.__("Download playlist");
document.querySelectorAll(".formatSelect").forEach((element) => {
	element.textContent = i18n.__("Select Format ");
});
getId("videoDownload").textContent = i18n.__("Download");
getId("audioDownload").textContent = i18n.__("Download");
getId("videoToggle").textContent = i18n.__("Video");
getId("audioToggle").textContent = i18n.__("Audio");
getId("advancedVideoToggle").textContent = i18n.__("More options");
getId("advancedAudioToggle").textContent = i18n.__("More options");
getId("rangeText").textContent = i18n.__("Download particular time-range");
getId("startTime").title = i18n.__(
	"If kept empty, it will start from the beginning"
);
getId("endTime").title = i18n.__(
	"If kept empty, it will be downloaded to the end"
);
getId("processing").textContent = i18n.__("Processing");
getId("start").textContent = i18n.__("Start");
getId("end").textContent = i18n.__("End");
getId("subHeader").textContent = i18n.__("Subtitles");
getId("subTxt").textContent = i18n.__("Download subtitles if available");
getId("extractHeader").textContent = i18n.__("Extract Audio");
getId("extractBtn").textContent = i18n.__("Extract");
getId("errorBtn").textContent = i18n.__("Error Details")+" ▼"
