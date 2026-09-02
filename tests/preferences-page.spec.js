const { test, expect } = require("@playwright/test");
const os = require("os");
const { launchApp } = require("./helpers/electronApp");

test.describe("Preferences Page Tests", () => {
	let electronApp;
	let page;

	test.beforeEach(async () => {
		const res = await launchApp();
		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await page.evaluate(() => {
			const el = document.getElementById("preferenceWin");
			if (el) el.click();
		});
	});

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test("tab navigation switches active tab content", async () => {
		// General tab active by default
		await expect(page.locator("#generalTab")).toHaveClass(/active/);

		// Click Media Settings tab
		await page.click('button[data-tab="media"]');
		await expect(page.locator("#mediaTab")).toHaveClass(/active/);
		await expect(page.locator("#generalTab")).not.toHaveClass(/active/);

		// Click Advanced Tools tab
		await page.click('button[data-tab="advanced"]');
		await expect(page.locator("#advancedTab")).toHaveClass(/active/);
		await expect(page.locator("#mediaTab")).not.toHaveClass(/active/);

		// Click Dependencies tab
		await page.click('button[data-tab="dependencies"]');
		await expect(page.locator("#dependenciesTab")).toHaveClass(/active/);
		await expect(page.locator("#advancedTab")).not.toHaveClass(/active/);
	});

	test("dependencies settings options update localStorage and toggle channel visibility", async () => {
		await page.click('button[data-tab="dependencies"]');
		await expect(page.locator("#dependenciesTab")).toHaveClass(/active/);

		// Default yt-dlp channel box should be visible for bundled source
		await expect(page.locator("#depYtdlpChannelBox")).toBeVisible();

		// Change yt-dlp source to system
		await page.selectOption("#depYtdlpSource", "system");
		let savedYtdlpSource = await page.evaluate(() => localStorage.getItem("ytdlpSource"));
		expect(savedYtdlpSource).toBe("system");
		await expect(page.locator("#depYtdlpChannelBox")).toBeHidden();

		// Change yt-dlp source back to bundled
		await page.selectOption("#depYtdlpSource", "bundled");
		savedYtdlpSource = await page.evaluate(() => localStorage.getItem("ytdlpSource"));
		expect(savedYtdlpSource).toBe("bundled");
		await expect(page.locator("#depYtdlpChannelBox")).toBeVisible();

		// Change yt-dlp channel to master
		await page.selectOption("#depYtdlpChannel", "master");
		const savedChannel = await page.evaluate(() => localStorage.getItem("ytdlpChannel"));
		expect(savedChannel).toBe("master");

		// Change ffmpeg source to system
		await page.selectOption("#depFfmpegSource", "system");
		const savedFfmpegSource = await page.evaluate(() => localStorage.getItem("ffmpegSource"));
		expect(savedFfmpegSource).toBe("system");

		// JS runtime source should be disabled
		const jsRuntimeDisabled = await page.$eval("#depJsRuntimeSource", (el) => el.disabled);
		expect(jsRuntimeDisabled).toBe(true);

		// Check version indicators exist
		const jsVersionText = await page.textContent("#depJsRuntimeVersion");
		expect(jsVersionText.length).toBeGreaterThan(0);
	});

	test("settings search filters matching preferences items", async () => {
		await page.fill("#settingsSearch", "proxy");

		// Proxy setting item should not have .item-hidden
		const proxyBox = page.locator("#proxyTitle").locator("..");
		await expect(proxyBox).not.toHaveClass(/item-hidden/);

		// Non-matching setting (e.g. max downloads) should gain .item-hidden
		const maxDownloadsBox = page.locator("#maxTxt").locator("..");
		await expect(maxDownloadsBox).toHaveClass(/item-hidden/);

		// Clear search
		await page.fill("#settingsSearch", "");
		await expect(maxDownloadsBox).not.toHaveClass(/item-hidden/);
	});

	test("general settings update localStorage", async () => {
		await page.selectOption("#selectLanguage", "es-ES");
		const savedLocale = await page.evaluate(() => localStorage.getItem("locale"));
		expect(savedLocale).toBe("es-ES");
		await expect(page.locator("#selectLn")).toHaveText("Seleccionar idioma");

		await page.fill("#maxDownloads", "8");
		const savedMax = await page.evaluate(() => localStorage.getItem("maxActiveDownloads"));
		expect(savedMax).toBe("8");

		await page.fill("#concurrentFragments", "4");
		const savedFragments = await page.evaluate(() => localStorage.getItem("concurrentFragments"));
		expect(savedFragments).toBe("4");

		await page.fill("#concurrentFragments", "100");
		const clampedFragments = await page.evaluate(() => localStorage.getItem("concurrentFragments"));
		expect(clampedFragments).toBe("16");

		await page.evaluate(() => {
			const cb = document.getElementById("closeToTray");
			cb.checked = true;
			cb.dispatchEvent(new Event("change", { bubbles: true }));
		});
		const savedTray = await page.evaluate(() => localStorage.getItem("closeToTray"));
		expect(savedTray).toBe("true");

		await page.evaluate(() => {
			const cb = document.getElementById("autoUpdateDisabled");
			cb.checked = true;
			cb.dispatchEvent(new Event("change", { bubbles: true }));
		});
		const savedAutoUpdate = await page.evaluate(() => localStorage.getItem("autoUpdate"));
		expect(savedAutoUpdate).toBe("false");

		await page.selectOption("#updateChannelSelect", "beta");
		const savedChannel = await page.evaluate(() => localStorage.getItem("updateChannel"));
		expect(savedChannel).toBe("beta");

		await page.selectOption("#zoomLevelSelect", "0.8");
		const savedZoom = await page.evaluate(() => localStorage.getItem("zoomLevel"));
		expect(savedZoom).toBe("0.8");
		const zoomFactor = await page.evaluate(() => window.electronAPI?.webFrame?.getZoomFactor?.());
		if (zoomFactor !== undefined) {
			expect(zoomFactor).toBeCloseTo(0.8);
		}
	});

	test("media settings preferences save to localStorage", async () => {
		await page.click('button[data-tab="media"]');

		const defaultVideoQuality = await page.$eval("#preferredVideoQuality", (el) => el.value);
		expect(defaultVideoQuality).toBe("1080");

		await page.selectOption("#preferredVideoQuality", "720");
		const videoQuality = await page.evaluate(() => localStorage.getItem("preferredVideoQuality"));
		expect(videoQuality).toBe("720");

		await page.selectOption("#preferredVideoCodec", "vp9");
		const videoCodec = await page.evaluate(() => localStorage.getItem("preferredVideoCodec"));
		expect(videoCodec).toBe("vp9");

		await page.selectOption("#preferredAudioQuality", "flac");
		const audioQuality = await page.evaluate(() => localStorage.getItem("preferredAudioQuality"));
		expect(audioQuality).toBe("flac");

		await page.evaluate(() => {
			const cb = document.getElementById("showMoreFormats");
			cb.checked = true;
			cb.dispatchEvent(new Event("change", { bubbles: true }));
		});
		const showMore = await page.evaluate(() => localStorage.getItem("showMoreFormats"));
		expect(showMore).toBe("true");
	});

	test("output templates inputs update localStorage and reset buttons restore defaults", async () => {
		await page.click('button[data-tab="advanced"]');

		// Audio filename template
		await page.fill("#filenameTemplateAudio", "%(title)s_custom_audio.%(ext)s");
		let savedAudioTpl = await page.evaluate(() => localStorage.getItem("filenameTemplateAudio"));
		expect(savedAudioTpl).toBe("%(title)s_custom_audio.%(ext)s");

		await page.click("#resetAudioFilenameTemplate");
		savedAudioTpl = await page.evaluate(() => localStorage.getItem("filenameTemplateAudio"));
		expect(savedAudioTpl).toBe("%(title)s.%(ext)s");
		const audioVal = await page.inputValue("#filenameTemplateAudio");
		expect(audioVal).toBe("%(title)s.%(ext)s");

		// Video filename template
		await page.fill("#filenameTemplateVideo", "%(title)s_custom_video.%(ext)s");
		let savedVideoTpl = await page.evaluate(() => localStorage.getItem("filenameTemplateVideo"));
		expect(savedVideoTpl).toBe("%(title)s_custom_video.%(ext)s");

		await page.click("#resetFilenameTemplateVideo");
		savedVideoTpl = await page.evaluate(() => localStorage.getItem("filenameTemplateVideo"));
		expect(savedVideoTpl).toBe("%(title)s.%(ext)s");

		// Playlist filename format
		await page.fill("#filenameFormat", "%(playlist_index)s_%(title)s.%(ext)s");
		let savedFileFmt = await page.evaluate(() => localStorage.getItem("filenameFormat"));
		expect(savedFileFmt).toBe("%(playlist_index)s_%(title)s.%(ext)s");

		await page.click("#resetFilenameFormat");
		savedFileFmt = await page.evaluate(() => localStorage.getItem("filenameFormat"));
		expect(savedFileFmt).toBe("%(playlist_index)s.%(title)s.%(ext)s");

		// Playlist foldername format
		await page.fill("#foldernameFormat", "%(playlist_title)s_folder");
		let savedFolderFmt = await page.evaluate(() => localStorage.getItem("foldernameFormat"));
		expect(savedFolderFmt).toBe("%(playlist_title)s_folder");

		await page.click("#resetFoldernameFormat");
		savedFolderFmt = await page.evaluate(() => localStorage.getItem("foldernameFormat"));
		expect(savedFolderFmt).toBe("%(playlist_title)s");
	});

	test("cookie source selection toggles UI sections and saves preference", async () => {
		await page.click('button[data-tab="advanced"]');

		// Select browser cookies
		await page.selectOption("#cookieSource", "browser");
		await expect(page.locator("#browserSelectBox")).toBeVisible();
		await expect(page.locator("#netscapeCookiesBox")).toBeHidden();
		let savedSource = await page.evaluate(() => localStorage.getItem("cookieSource"));
		expect(savedSource).toBe("browser");

		// Select browser name
		await page.selectOption("#browser", "firefox");
		let savedBrowser = await page.evaluate(() => localStorage.getItem("browser"));
		expect(savedBrowser).toBe("firefox");

		// Select file cookies
		await page.selectOption("#cookieSource", "file");
		await expect(page.locator("#browserSelectBox")).toBeHidden();
		await expect(page.locator("#netscapeCookiesBox")).toBeVisible();
		savedSource = await page.evaluate(() => localStorage.getItem("cookieSource"));
		expect(savedSource).toBe("file");
	});

	test("proxy and custom yt-dlp arguments update localStorage", async () => {
		await page.click('button[data-tab="advanced"]');

		// Test proxy mode selection
		await page.selectOption("#proxyMode", "none");
		await expect(page.locator("#customProxyBox")).toBeHidden();
		await expect(page.locator("#systemProxyBox")).toBeHidden();
		let savedProxyMode = await page.evaluate(() => localStorage.getItem("proxyMode"));
		expect(savedProxyMode).toBe("none");

		await page.selectOption("#proxyMode", "system");
		await expect(page.locator("#customProxyBox")).toBeHidden();
		await expect(page.locator("#systemProxyBox")).toBeVisible();
		savedProxyMode = await page.evaluate(() => localStorage.getItem("proxyMode"));
		expect(savedProxyMode).toBe("system");

		await page.selectOption("#proxyMode", "custom");
		await expect(page.locator("#customProxyBox")).toBeVisible();
		await expect(page.locator("#systemProxyBox")).toBeHidden();
		savedProxyMode = await page.evaluate(() => localStorage.getItem("proxyMode"));
		expect(savedProxyMode).toBe("custom");

		const proxyUrl = "http://127.0.0.1:8080";
		await page.fill("#proxyTxt", proxyUrl);
		// Dispatch change event for input
		await page.dispatchEvent("#proxyTxt", "change");
		const savedProxy = await page.evaluate(() => localStorage.getItem("proxy"));
		expect(savedProxy).toBe(proxyUrl);

		const customArgs = "--sponsorblock-remove all";
		await page.fill("#customArgsInput", customArgs);
		const savedArgs = await page.evaluate(() => localStorage.getItem("customYtDlpArgs"));
		expect(savedArgs).toBe(customArgs);
	});

	test("preferences select download location button opens directory dialog and updates path display", async () => {
		const testPath = os.tmpdir();
		await electronApp.evaluate(async ({ dialog }, p) => {
			dialog.showOpenDialog = async () => ({
				canceled: false,
				filePaths: [p],
			});
		}, testPath);

		await page.click("#selectLocationPref");

		await page.waitForFunction((expected) => {
			const el = document.getElementById("homePathDisplay") || document.getElementById("path");
			return el && el.textContent === expected;
		}, testPath);

		const savedPath = await page.evaluate(() => localStorage.getItem("downloadPath"));
		expect(savedPath).toBe(testPath);
	});

	test("add cookie block button creates cookie cards and updates domain badges and localStorage", async () => {
		await page.click('button[data-tab="advanced"]');
		await page.selectOption("#cookieSource", "file");
		await expect(page.locator("#netscapeCookiesBox")).toBeVisible();

		// Initially 1 block card should be rendered
		let cards = page.locator(".cookie-block-card");
		await expect(cards).toHaveCount(1);

		// Click + Add Cookie Block
		await page.click("#addCookieBlockBtn");
		cards = page.locator(".cookie-block-card");
		await expect(cards).toHaveCount(2);

		// Type cookie content in first block
		const sampleCookie = ".youtube.com\tTRUE\t/\tFALSE\t1767225600\tVISITOR_INFO1_LIVE\tabc123";
		const firstTextarea = cards.nth(0).locator("textarea");
		await firstTextarea.fill(sampleCookie);

		const badgeText = await cards.nth(0).locator(".cookie-domain-badge").textContent();
		expect(badgeText).toContain("youtube.com");

		const savedCookies = await page.evaluate(() => localStorage.getItem("netscapeCookies"));
		expect(savedCookies).toContain("VISITOR_INFO1_LIVE");

		// Remove the second block
		await cards.nth(1).locator("button").click();
		await expect(cards).toHaveCount(1);
	});
});
