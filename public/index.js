const videoToggle = document.getElementById("videoToggle");
const audioToggle = document.getElementById("audioToggle");
const incorrectMsg = document.getElementById("incorrectMsg");
const loadingMsg = document.getElementById("loadingWrapper")

function getInfo() {
	incorrectMsg.textContent = "";
	loadingMsg.style.display = "flex";
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

				for (let format of data.formats) {
					let size = (Number(format.contentLength) / 1000000).toFixed(2)
					size = size + " MB";

					// For videos
					if (format.hasVideo && format.contentLength && format.container == "mp4") {

							const itag = format.itag;
							const element =
								"<option value='" +
								itag +
								"'>" +
								format.qualityLabel +
								" | " +
								format.container +
								" | " +
								size +
								"</option>";
							document.getElementById(
								"videoFormatSelect"
							).innerHTML += element;
						
					}

					// For audios
					else if(format.hasAudio && !format.hasVideo && format.audioBitrate)
					 {
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
				incorrectMsg.textContent = "Some error has occured";
			}
		})
		.catch((error) => {
			if (error) {
				loadingMsg.style.display = "none";
				incorrectMsg.textContent = error;
			}
		});
}

document.getElementById("getInfo").addEventListener("click", (event) => {
	getInfo();
});

document.getElementById("url").addEventListener("keypress", (event) => {
	if (event.key == "Enter") {
		getInfo();
	}
});

videoToggle.addEventListener("click", (event) => {
	videoToggle.style.backgroundColor = "rgb(67, 212, 164)";
	audioToggle.style.backgroundColor = "rgb(108, 231, 190)";
	document.getElementById("audioList").style.display = "none";
	document.getElementById("videoList").style.display = "block";
});

audioToggle.addEventListener("click", (event) => {
	audioToggle.style.backgroundColor = "rgb(67, 212, 164)";
	videoToggle.style.backgroundColor = "rgb(108, 231, 190)";
	document.getElementById("videoList").style.display = "none";
	document.getElementById("audioList").style.display = "block";
});

// Toggle theme
let darkTheme = false;
let button = document.getElementById("themeToggle");
let circle = document.getElementById("themeToggleInside");
function toggle() {
	if (darkTheme == false) {
		circle.style.left = "25px";
		button.style.backgroundColor = "rgb(80, 193, 238)";
		darkTheme = true;
		document.body.style.backgroundColor = "rgb(50,50,50)";
		document.getElementById("hidden").style.backgroundColor = "rgb(143, 239, 207)"
		document.body.style.color = "whitesmoke";
		localStorage.setItem("theme", "dark");
	} else {
		circle.style.left = "0px";
		darkTheme = false;
		button.style.backgroundColor = "rgb(147, 174, 185)";
		document.body.style.backgroundColor = "whitesmoke";
		document.getElementById("hidden").style.backgroundColor = "rgb(203, 253, 236)"
		document.body.style.color = "black";
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
		document.getElementById("getInfo").style.animationName = "";
	}, 500);
}
