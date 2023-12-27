const electron = require("electron");
/**
 *
 * @param {string} id
 * @returns {any}
 */
function getId(id) {
	return document.getElementById(id);
}

let menuIsOpen = false;

getId("menuIcon").addEventListener("click", () => {
	if (menuIsOpen) {
		getId("menuIcon").style.transform = "rotate(0deg)";
		menuIsOpen = false;
		let count = 0;
		let opacity = 1;
		const fade = setInterval(() => {
			if (count >= 10) {
				getId("menu").style.display = "none";
				clearInterval(fade);
			} else {
				opacity -= 0.1;
				getId("menu").style.opacity = opacity;
				count++;
			}
		}, 50);
	} else {
		getId("menuIcon").style.transform = "rotate(90deg)";
		menuIsOpen = true;

		setTimeout(() => {
			getId("menu").style.display = "flex";
			getId("menu").style.opacity = 1;
		}, 150);
	}
});

getId("themeToggle").addEventListener("change", () => {
	document.documentElement.setAttribute("theme", getId("themeToggle").value);
	localStorage.setItem("theme", getId("themeToggle").value);
});

const storageTheme = localStorage.getItem("theme");
if (storageTheme) {
	document.documentElement.setAttribute("theme", storageTheme);
	getId("themeToggle").value = storageTheme;
}

////
let advancedHidden = true;

function advancedToggle() {
	if (advancedHidden) {
		getId("advanced").style.display = "block";
		advancedHidden = false;
	} else {
		getId("advanced").style.display = "none";
		advancedHidden = true;
	}
}

// Check scroll go to top

window.onscroll = function () {
	scrollFunction();
};

function scrollFunction() {
	if (
		document.body.scrollTop > 50 ||
		document.documentElement.scrollTop > 50
	) {
		getId("goToTop").style.display = "block";
	} else {
		getId("goToTop").style.display = "none";
	}
}

// Function to scroll go to top

getId("goToTop").addEventListener("click", () => {
	window.scrollTo({top: 0, behavior: "smooth"});
});

// Showing and hiding error details
function toggleErrorDetails() {
	const status = getId("errorDetails").style.display;
	if (status === "none") {
		getId("errorDetails").style.display = "block";
		// @ts-ignore
		getId("errorBtn").textContent = i18n.__("Error Details") + " ▲";
	} else {
		getId("errorDetails").style.display = "none";
		// @ts-ignore
		getId("errorBtn").textContent = i18n.__("Error Details") + " ▼";
	}
}

// Copying error txt

function copyErrorToClipboard() {
	const error = getId("errorDetails").textContent;
	electron.clipboard.writeText(error);
	// @ts-ignore
	showPopup(i18n.__("Copied text"));
}

// Popup message
function showPopup(text) {
	console.log("Triggered showpopup");
	getId("popupText").textContent = text;
	getId("popupText").style.display = "inline-block";
	setTimeout(() => {
		getId("popupText").style.display = "none";
	}, 2200);
}
