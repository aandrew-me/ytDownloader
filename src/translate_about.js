function getId(id) {
	return document.getElementById(id);
}
const i18n = new (require("../translations/i18n"))();

// Translating texts
getId("back").textContent = i18n.__("Homepage");
getId("txt1").textContent = i18n.__(
	"ytDownloader lets you download videos and audios from hundreds of sites like Youtube, Facebook, Instagram, Tiktok, Twitter and so on"
);
getId("txt2").textContent = i18n.__(
	"It's a Free and Open Source app built on top of Node.js and Electron. yt-dlp has been used for downloading"
);
getId("txt3").textContent = i18n.__("Source Code is available ");
getId("sourceLink").textContent = i18n.__("here");
