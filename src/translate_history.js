function getId(id) {
	return document.getElementById(id);
}

const i18n = new (require("../translations/i18n"))();

getId("historyTitle").textContent = i18n.__("Download History");
getId("closeBtn").textContent = i18n.__("Close");
getId("searchBox").placeholder = i18n.__("Search by title or URL...");

const formatOptions = document.querySelectorAll("#formatFilter option");
if (formatOptions[0]) {
	formatOptions[0].textContent = i18n.__("All Formats");
}

getId("exportJsonBtn").textContent = i18n.__("Export as JSON");
getId("exportCsvBtn").textContent = i18n.__("Export as CSV");
getId("clearAllBtn").textContent = i18n.__("Clear All History");
