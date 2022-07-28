const videoToggle = document.getElementById("videoToggle");
const audioToggle = document.getElementById("audioToggle");
const incorrectMsg = document.getElementById("incorrectMsg");
const loadingMsg = document.getElementById("loadingWrapper");

function getInfo() {
	incorrectMsg.textContent = "";
	loadingMsg.style.display = "flex";
	document.getElementById("videoFormatSelect").innerHTML = "";
	document.getElementById("audioFormatSelect").innerHTML = "";
	const url = document.getElementById("url").value;
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
				document.getElementById("hidden").style.display =
					"inline-block";
				document.getElementById("title").innerHTML =
					"<b>Title</b>: " + data.title;
				document.getElementById("videoList").style.display = "block";
				videoToggle.style.backgroundColor = "rgb(67, 212, 164)";

				let highestQualityLength = 0;

				for (let format of data.formats) {
					let size = (Number(format.contentLength) / 1000000).toFixed(
						2
					);
					size = size + " MB";

					// For videos
					if (
						format.hasVideo &&
						format.contentLength &&
						!format.hasAudio
					) {
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
						document.getElementById(
							"videoFormatSelect"
						).innerHTML += element;
					}

					// For audios
					else if (
						format.hasAudio &&
						!format.hasVideo &&
						format.audioBitrate
					) {
						const pattern = /^mp*4a[0-9.]+$/g;
						let audioCodec;
						const itag = format.itag;

						if (pattern.test(format.audioCodec)) {
							audioCodec = "mp4a";
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
						document.getElementById(
							"audioFormatSelect"
						).innerHTML += element;
					}
				}
			} else {
				loadingMsg.style.display = "none";
				incorrectMsg.textContent =
					"Some error has occured. Check your connection or the URL";
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
	document.getElementById("progressBox").style.display = "none"
	document.getElementById("savedMsg").innerHTML = ""
	const url = document.getElementById("url").value;
	let itag;
	let options;
	if (type === "video") {
		itag = document.getElementById("videoFormatSelect").value;
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
		itag = document.getElementById("audioFormatSelect").value;
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

document.getElementById("videoDownload").addEventListener("click", (event) => {
	document.getElementById("preparingBox").style.display = "flex";
	clickAnimation("videoDownload");
	download("video");
});

document.getElementById("audioDownload").addEventListener("click", (event) => {
	document.getElementById("preparingBox").style.display = "flex";
	clickAnimation("audioDownload");
	download("audio");
});

document.getElementById("getInfo").addEventListener("click", (event) => {
	getInfo();
});

document.getElementById("url").addEventListener("keypress", (event) => {
	if (event.key == "Enter") {
		getInfo();
	}
});

videoToggle.addEventListener("click", (event) => {
	videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	audioToggle.style.backgroundColor = "var(--box-toggle)";
	document.getElementById("audioList").style.display = "none";
	document.getElementById("videoList").style.display = "block";
});

audioToggle.addEventListener("click", (event) => {
	audioToggle.style.backgroundColor = "var(--box-toggleOn)";
	videoToggle.style.backgroundColor = "var(--box-toggle)";
	document.getElementById("videoList").style.display = "none";
	document.getElementById("audioList").style.display = "block";
});

// Toggle theme
let darkTheme = false;
let circle = document.getElementById("themeToggleInside");
const root = document.querySelector(":root");

function toggle() {
	if (darkTheme == false) {
		circle.style.left = "25px";

		root.style.setProperty("--background", "rgb(40,40,40)");
		root.style.setProperty("--text", "white");
		root.style.setProperty("--box-main", "rgb(80,80,80)");
		root.style.setProperty("--box-toggle", "rgb(70,70,70)");
		root.style.setProperty("--theme-toggle", "rgb(80, 193, 238)");

		darkTheme = true;
		localStorage.setItem("theme", "dark");
	} else {
		circle.style.left = "0px";

		root.style.setProperty("--background", "whitesmoke");
		root.style.setProperty("--text", "rgb(20, 20, 20)");
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
	document.getElementById(id).style.animationName = "clickAnimation";

	setTimeout(() => {
		document.getElementById(id).style.animationName = "";
	}, 500);
}
