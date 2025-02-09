const videoToggle = getId("videoToggle");
const audioToggle = getId("audioToggle");
const incorrectMsg = getId("incorrectMsg");
const loadingMsg = getId("loadingWrapper");

function getId(id) {
	return document.getElementById(id);
}

// Video and audio toggle

videoToggle.addEventListener("click", (event) => {
	selectVideo()
});

audioToggle.addEventListener("click", (event) => {
	selectAudio()
});

/////////////
function selectVideo(){
	localStorage.setItem("defaultWindow", "video")
	videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	audioToggle.style.backgroundColor = "var(--box-toggle)";
	getId("audioList").style.display = "none";
	getId("audioExtract").style.display = "none";
	getId("videoList").style.display = "block";
}

function selectAudio(){
	localStorage.setItem("defaultWindow", "audio")
	audioToggle.style.backgroundColor = "var(--box-toggleOn)";
	videoToggle.style.backgroundColor = "var(--box-toggle)";
	getId("videoList").style.display = "none";
	getId("audioList").style.display = "block";
	getId("audioExtract").style.display = "block";
}