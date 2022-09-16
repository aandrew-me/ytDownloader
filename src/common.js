function getId(id) {
	return document.getElementById(id);
}

let menuIsOpen = false;

getId("menuIcon").addEventListener("click", (event) => {
	if (menuIsOpen) {
		getId("menuIcon").style.transform = "rotate(0deg)";
		menuIsOpen = false;
		let count = 0;
		let opacity = 1;
		const fade = setInterval(() => {
			if (count >= 10) {
				getId("menu").style.display = "none"
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

// Toggle theme
let circle = getId("themeToggleInside");
let darkTheme = true;
circle.style.left = "25px";

const root = document.querySelector(":root");

let enabledTransparent = localStorage.getItem("enabledTransparent");
let bgColor = "";
if (enabledTransparent == "true") {
	bgColor = "rgba(40,40,40, .9)";
} else {
	bgColor = "rgb(40,40,40)";
}

function toggle() {
	if (darkTheme == false) {
		circle.style.left = "25px";

		root.style.setProperty("--background", bgColor);
		root.style.setProperty("--text", "white");
		root.style.setProperty("--box-main", "rgb(80,80,80)");
		root.style.setProperty("--box-toggle", "rgb(70,70,70)");
		root.style.setProperty("--theme-toggle", "rgb(80, 193, 238)");
		root.style.setProperty("--item-bg", "rgb(75, 75, 75)");
		root.style.setProperty("--box-shadow", "none");

		darkTheme = true;
		localStorage.setItem("theme", "dark");
	} else {
		circle.style.left = "0px";

		root.style.setProperty("--background", "whitesmoke");
		root.style.setProperty("--text", "rgb(45, 45, 45)");
		root.style.setProperty("--box-main", "rgb(174 249 224)");
		root.style.setProperty("--box-toggle", "rgb(108, 231, 190)");
		root.style.setProperty("--theme-toggle", "rgb(147, 174, 185)");
		root.style.setProperty("--item-bg", "#ececec");
		root.style.setProperty("--box-shadow", "3px 3px 10px gray");
		root.style.setProperty(
			"--box-shadow",
			"2px 2px 5px rgb(92, 92, 92), -2px -2px 5px rgb(219, 219, 219)"
		);

		darkTheme = false;
		localStorage.setItem("theme", "light");
	}
}

const storageTheme = localStorage.getItem("theme");

if (storageTheme == "dark") {
	darkTheme = false;
	toggle();
} else if (storageTheme == "light") {
	darkTheme = true;
	toggle();
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