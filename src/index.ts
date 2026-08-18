import { getId } from "./utils.js";

const videoToggle = getId("videoToggle");
const audioToggle = getId("audioToggle");

// Video and audio toggle

videoToggle?.addEventListener("click", () => {
	selectVideo();
});

audioToggle?.addEventListener("click", () => {
	selectAudio();
});

/////////////
export function selectVideo(): void {
	localStorage.setItem("defaultWindow", "video");
	if (videoToggle) videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	if (audioToggle) audioToggle.style.backgroundColor = "var(--box-toggle)";
	const audioList = getId("audioList");
	if (audioList) audioList.style.display = "none";
	const audioExtract = getId("audioExtract");
	if (audioExtract) audioExtract.style.display = "none";
	const videoList = getId("videoList");
	if (videoList) videoList.style.display = "block";
	const outputCard = getId("homeOutputFormatCard");
	if (outputCard) outputCard.style.display = "flex";
}
(window as any).selectVideo = selectVideo;

export function selectAudio(): void {
	localStorage.setItem("defaultWindow", "audio");
	if (audioToggle) audioToggle.style.backgroundColor = "var(--box-toggleOn)";
	if (videoToggle) videoToggle.style.backgroundColor = "var(--box-toggle)";
	const videoList = getId("videoList");
	if (videoList) videoList.style.display = "none";
	const audioList = getId("audioList");
	if (audioList) audioList.style.display = "block";
	const audioExtract = getId("audioExtract");
	if (audioExtract) audioExtract.style.display = "block";
	const outputCard = getId("homeOutputFormatCard");
	if (outputCard) outputCard.style.display = "none";
}
(window as any).selectAudio = selectAudio;
