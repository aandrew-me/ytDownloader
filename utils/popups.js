// Popup message
function showPopup(text) {
	console.log("Triggered showpopup");
	getId("popupText").textContent = text;
	getId("popupText").style.display = "inline-block";
	setTimeout(() => {
		getId("popupText").style.display = "none";
	}, 2200);
}

module.exports = {
    showPopup
}