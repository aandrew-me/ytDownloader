const videoToggle = getId("videoToggle");
const audioToggle = getId("audioToggle");
const incorrectMsg = getId("incorrectMsg");
const loadingMsg = getId("loadingWrapper");

function getId(id) {
	return document.getElementById(id);
}

function getInfo() {
	incorrectMsg.textContent = "";
	loadingMsg.style.display = "flex";
	getId("videoFormatSelect").innerHTML = "";
	getId("audioFormatSelect").innerHTML = "";
	const url = getId("url").value;
	const options = {
		method: "POST",
		body: "url=" + url,
		headers: {
			"Content-Type": "Application/x-www-form-urlencoded",
		},
	};

	fetch("/", options)
		.then((response) => response.json())
		.then((data) => {
			console.log(data.formats);

			const urlElements = document.querySelectorAll(".url");

			urlElements.forEach((element) => {
				element.value = data.url;
			});

			if (data.status == true) {
				loadingMsg.style.display = "none";
				getId("hidden").style.display = "inline-block";
				getId("title").innerHTML = "<b>Title</b>: " + data.title;
				getId("videoList").style.display = "block";
				videoToggle.style.backgroundColor = "rgb(67, 212, 164)";

				let highestQualityLength = 0;
				let audioSize = 0;

				// Getting approx size of audio file
				for (let format of data.formats){
					if (format.hasAudio && !format.hasVideo && format.contentLength && format.container == "mp4"){
						audioSize = (Number(format.contentLength) / 1000000)
					}
				}

				for (let format of data.formats) {
					let size = (Number(format.contentLength) / 1000000).toFixed(2)
					
					// For videos
					if (
						format.hasVideo &&
						format.contentLength &&
						!format.hasAudio
					) {
						size = (Number(size) + Number(audioSize)).toFixed(2)
						size = size + " MB";
						const itag = format.itag;
						const avcPattern = /^avc1[0-9a-zA-Z.]+$/g;
						const av1Pattern = /^av01[0-9a-zA-Z.]+$/g;

						let codec;
						if (av1Pattern.test(format.codecs)) {
							codec = "AV1 Codec";
						} else if (avcPattern.test(format.codecs)) {
							codec = "AVC Codec";
						} else {
							codec = format.codecs.toUpperCase() + " Codec";
						}

						const element =
							"<option value='" +
							itag +
							"'>" +
							format.qualityLabel +
							"  |  " +
							format.container +
							"  |  " +
							size +
							"  |  " +
							codec;
						("</option>");
						getId("videoFormatSelect").innerHTML += element;
					}

					// For audios
					else if (
						format.hasAudio &&
						!format.hasVideo &&
						format.audioBitrate
					) {
						size = size + " MB";
						const pattern = /^mp*4a[0-9.]+$/g;
						let audioCodec;
						const itag = format.itag;

						if (pattern.test(format.audioCodec)) {
							audioCodec = "m4a";
						} else {
							audioCodec = format.audioCodec;
						}
						const element =
							"<option value='" +
							itag +
							"'>" +
							format.audioBitrate +
							" kbps" +
							" | " +
							audioCodec +
							" | " +
							size +
							"</option>";
						getId("audioFormatSelect").innerHTML += element;
					}
				}
			} else {
				loadingMsg.style.display = "none";
				incorrectMsg.textContent =
					"Some error has occured. Check your connection and use correct URL";
			}
		})
		.catch((error) => {
			if (error) {
				loadingMsg.style.display = "none";
				incorrectMsg.textContent = error;
			}
		});
}

function download(type) {
	getId("videoProgressBox").style.display = "none";
	getId("audioProgressBox").style.display = "none";

	getId("savedMsg").innerHTML = "";
	const url = getId("url").value;
	let itag;
	let options;
	if (type === "video") {
		itag = getId("videoFormatSelect").value;
		options = {
			method: "POST",
			body: new URLSearchParams({
				url: url,
				videoTag: itag,
			}),
			headers: {
				"Content-Type": "Application/x-www-form-urlencoded",
			},
		};
	} else {
		itag = getId("audioFormatSelect").value;
		options = {
			method: "POST",
			body: new URLSearchParams({
				url: url,
				audioTag: itag,
			}),
			headers: {
				"Content-Type": "Application/x-www-form-urlencoded",
			},
		};
	}
	fetch("/download", options)
		.then((response) => response.json)
		.then((data) => {
			console.log(data);
		})
		.catch((error) => {
			console.log(error);
		});
}

let menuIsOpen = false;

getId("menuIcon").addEventListener("click", (event) => {
	if (menuIsOpen) {
		getId("menuIcon").style.transform = "rotate(0deg)";
		menuIsOpen = false;
		let count = 0;
		let opacity = 1
		const fade = setInterval(() => {
			if (count >= 10) {
				clearInterval(fade);
			} else {
				opacity -= .1
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

getId("videoDownload").addEventListener("click", (event) => {
	getId("preparingBox").style.display = "flex";
	clickAnimation("videoDownload");
	download("video");
});

getId("audioDownload").addEventListener("click", (event) => {
	getId("preparingBox").style.display = "flex";
	clickAnimation("audioDownload");
	download("audio");
});

// Getting video info

getId("getInfo").addEventListener("click", (event) => {
	getInfo();
});

getId("url").addEventListener("keypress", (event) => {
	if (event.key == "Enter") {
		getInfo();
	}
});

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

// Toggle theme
let darkTheme = false;
let circle = getId("themeToggleInside");
const root = document.querySelector(":root");

let enabledTransparent = localStorage.getItem("enabledTransparent")
let bgColor = ""
if (enabledTransparent == "true"){
 bgColor = "rgba(40,40,40, .7)"
}
else{
bgColor = "rgb(40,40,40)"
}

function toggle() {
	if (darkTheme == false) {
		circle.style.left = "25px";

		root.style.setProperty("--background", bgColor);
		root.style.setProperty("--text", "white");
		root.style.setProperty("--box-main", "rgb(80,80,80)");
		root.style.setProperty("--box-toggle", "rgb(70,70,70)");
		root.style.setProperty("--theme-toggle", "rgb(80, 193, 238)");

		darkTheme = true;
		localStorage.setItem("theme", "dark");
	} else {
		circle.style.left = "0px";

		root.style.setProperty("--background", "whitesmoke");
		root.style.setProperty("--text", "rgba(45, 45, 45)");
		root.style.setProperty("--box-main", "rgb(143, 239, 207)");
		root.style.setProperty("--box-toggle", "rgb(108, 231, 190)");
		root.style.setProperty("--theme-toggle", "rgb(147, 174, 185)");

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

function clickAnimation(id) {
	getId(id).style.animationName = "clickAnimation";

	setTimeout(() => {
		getId(id).style.animationName = "";
	}, 500);
}
