import { getId } from "./utils.js";

export function switchView(targetViewId) {
	const views = document.querySelectorAll(".page-view");
	const navItems = document.querySelectorAll(".nav-item");

	views.forEach((view) => {
		if (view.id === targetViewId) {
			view.classList.remove("hidden");
			view.classList.add("active");
		} else {
			view.classList.remove("active");
			view.classList.add("hidden");
		}
	});

	navItems.forEach((item) => {
		if (item.dataset.target === targetViewId) {
			item.classList.add("active");
		} else {
			item.classList.remove("active");
		}
	});

	if (targetViewId === "view-history" && typeof window.loadHistory === "function") {
		window.loadHistory();
	}

	if (targetViewId === "view-compressor" && typeof window.initCompressorGPU === "function") {
		window.initCompressorGPU();
	}

	if (targetViewId === "view-playlist" && window.playlistDownloader) {
		window.playlistDownloader.initUI();
		window.playlistDownloader.loadInitialConfig();
		if (typeof window.playlistDownloader._updateEmptyStateUI === "function") {
			window.playlistDownloader._updateEmptyStateUI();
		}
	}
}
window.switchView = switchView;

if (window.electronAPI?.ipcRenderer) {
	window.electronAPI.ipcRenderer.on("navigate-view", (_event, targetViewId) => {
		switchView(targetViewId);
	});
}

export function toggleSidebar(collapse) {
	const sidebar = getId("sidebar");
	const mainContent = document.querySelector(".main-content-wrapper");

	const isCurrentlyCollapsed = sidebar?.classList.contains("collapsed");
	const shouldCollapse = collapse !== undefined ? collapse : !isCurrentlyCollapsed;

	if (shouldCollapse) {
		sidebar?.classList.add("collapsed");
		mainContent?.classList.add("sidebar-collapsed");
		localStorage.setItem("sidebarCollapsed", "true");
	} else {
		sidebar?.classList.remove("collapsed");
		mainContent?.classList.remove("sidebar-collapsed");
		localStorage.setItem("sidebarCollapsed", "false");
	}
}
window.toggleSidebar = toggleSidebar;

document.addEventListener("DOMContentLoaded", () => {
	getId("sidebarCollapseBtn")?.addEventListener("click", () => toggleSidebar());
	document.querySelector(".sidebar-brand-left")?.addEventListener("click", () => {
		if (getId("sidebar")?.classList.contains("collapsed")) {
			toggleSidebar(false);
		}
	});

	if (localStorage.getItem("sidebarCollapsed") === "false") {
		toggleSidebar(false);
	} else {
		toggleSidebar(true);
	}

	document.querySelectorAll(".nav-item").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			const target = btn.getAttribute("data-target");
			if (target) {
				switchView(target);
			}
		});
	});
});

getId("menuIcon")?.addEventListener("click", () => {
	const menuDisplay = getId("menu")?.style.display;
	if (menuDisplay != "none" && menuDisplay != "" && menuDisplay != undefined) {
		getId("menuIcon").style.transform = "rotate(0deg)";
		let count = 0;
		let opacity = 1;
		const fade = setInterval(() => {
			if (count >= 10) {
				if (getId("menu")) getId("menu").style.display = "none";
				clearInterval(fade);
			} else {
				opacity -= 0.1;
				if (getId("menu")) getId("menu").style.opacity = opacity.toFixed(3).toString();
				count++;
			}
		}, 50);
	} else if (getId("menu")) {
		getId("menuIcon").style.transform = "rotate(90deg)";

		setTimeout(() => {
			getId("menu").style.display = "flex";
			getId("menu").style.opacity = "1";
		}, 150);
	}
});

getId("themeToggle")?.addEventListener("change", () => {
	const val = getId("themeToggle").value;
	localStorage.setItem("theme", val);

	const x = window.innerWidth;
	const y = 0;
	const maxRadius = Math.hypot(window.innerWidth, window.innerHeight);

	if (document.startViewTransition) {
		const transition = document.startViewTransition(() => {
			document.documentElement.setAttribute("theme", val);
		});

		transition.ready.then(() => {
			document.documentElement.animate(
				{
					clipPath: [
						`circle(0px at ${x}px ${y}px)`,
						`circle(${maxRadius}px at ${x}px ${y}px)`
					]
				},
				{
					duration: 1100,
					easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
					pseudoElement: '::view-transition-new(root)'
				}
			);
		});
	} else {
		document.documentElement.setAttribute("theme", val);
	}
});

function initTheme() {
	const storageTheme = localStorage.getItem("theme") || "frappe";
	document.documentElement.setAttribute("theme", storageTheme);
	const themeToggleEl = getId("themeToggle");
	if (themeToggleEl) {
		themeToggleEl.value = storageTheme;
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initTheme);
} else {
	initTheme();
}

////
let advancedHidden = true;

export function advancedToggle() {
	const advEl = getId("advanced");
	const arrowVideo = getId("arrowLeftVideo");
	const arrowAudio = getId("arrowLeftAudio");

	if (advancedHidden) {
		if (advEl) {
			advEl.style.display = "block";
			void advEl.offsetHeight;
			advEl.classList.add("open");
		}
		if (arrowVideo) arrowVideo.style.transform = "rotate(-90deg)";
		if (arrowAudio) arrowAudio.style.transform = "rotate(-90deg)";
		advancedHidden = false;
	} else {
		if (advEl) {
			advEl.classList.remove("open");
			setTimeout(() => {
				if (advancedHidden && advEl) {
					advEl.style.display = "none";
				}
			}, 320);
		}
		if (arrowVideo) arrowVideo.style.transform = "rotate(0deg)";
		if (arrowAudio) arrowAudio.style.transform = "rotate(0deg)";
		advancedHidden = true;
	}
}
window.advancedToggle = advancedToggle;

// Check scroll go to top

window.onscroll = function () {
	scrollFunction();
};

function scrollFunction() {
	if (
		document.body.scrollTop > 50 ||
		document.documentElement.scrollTop > 50
	) {
		if (getId("goToTop")) getId("goToTop").style.display = "block";
	} else {
		if (getId("goToTop")) getId("goToTop").style.display = "none";
	}
}

// Function to scroll go to top

getId("goToTop")?.addEventListener("click", () => {
	window.scrollTo({top: 0, behavior: "smooth"});
});

// Showing and hiding error details
export function toggleErrorDetails() {
	if (!getId("errorDetails")) return;
	const display = getComputedStyle(getId("errorDetails")).display;

	if (display === "none") {
		getId("errorDetails").style.display = "block";
		// @ts-ignore
		if (getId("errorBtn")) getId("errorBtn").textContent = (window.i18n?.__("errorDetails") || "Error Details") + " ▼";
	} else {
		getId("errorDetails").style.display = "none";
		// @ts-ignore
		if (getId("errorBtn")) getId("errorBtn").textContent = (window.i18n?.__("errorDetails") || "Error Details") + " ◀";
	}
}
window.toggleErrorDetails = toggleErrorDetails;

getId("errorBtn")?.addEventListener("click", toggleErrorDetails);
getId("advancedVideoToggle")?.addEventListener("click", advancedToggle);
getId("advancedAudioToggle")?.addEventListener("click", advancedToggle);

