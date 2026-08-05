/**
 * Utility functions for YTDownloader renderer process
 */

/**
 * Shorthand helper for document.getElementById
 * @param {string} id
 * @returns {HTMLElement | null}
 */
export function getId(id) {
	return document.getElementById(id);
}

/**
 * Displays a temporary popup toast notification
 * @param {string} text
 * @param {boolean} [isError=false]
 */
export function showPopup(text, isError = false) {
	let popupContainer = document.getElementById("popupContainer");
	if (!popupContainer) {
		popupContainer = document.createElement("div");
		popupContainer.id = "popupContainer";
		popupContainer.className = "popup-container";
		document.body.appendChild(popupContainer);
	}

	const popup = document.createElement("span");
	popup.textContent = text;
	popup.classList.add("popup-item");
	popup.style.background = isError ? "#ff6b6b" : "#54abde";

	if (isError) {
		popup.classList.add("popup-error");
	}

	popupContainer.appendChild(popup);

	setTimeout(() => {
		popup.style.opacity = "0";
		setTimeout(() => {
			popup.remove();
			if (popupContainer.childElementCount === 0) {
				popupContainer.remove();
			}
		}, 400);
	}, 2200);
}

/**
 * Formats a byte number into human-readable string (e.g. 1.5 MB)
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
	if (!bytes || bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Formats seconds into HH:MM:SS or MM:SS format
 * @param {number | null | undefined} duration
 * @returns {string}
 */
export function formatTime(duration) {
	if (duration === null || duration === undefined) return "";
	const seconds = Number(duration);
	if (isNaN(seconds)) return "00:00";

	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const pad = (num) => String(num).padStart(2, "0");

	if (hrs > 0) {
		return `${hrs}:${pad(mins)}:${pad(secs)}`;
	}
	return `${pad(mins)}:${pad(secs)}`;
}

