const videoToggle = getId("videoToggle");
const audioToggle = getId("audioToggle");
const incorrectMsg = getId("incorrectMsg");
const loadingMsg = getId("loadingWrapper");

function getId(id) {
	return document.getElementById(id);
}

// Video and audio toggle

videoToggle.addEventListener("click", (event) => {
	videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	audioToggle.style.backgroundColor = "var(--box-toggle)";
	getId("audioList").style.display = "none";
	getId("videoList").style.display = "block";
});

audioToggle.addEventListener("click", (event) => {
	audioToggle.style.backgroundColor = "var(--box-toggleOn)";
	videoToggle.style.backgroundColor = "var(--box-toggle)";
	getId("videoList").style.display = "none";
	getId("audioList").style.display = "block";
});

/////////////
