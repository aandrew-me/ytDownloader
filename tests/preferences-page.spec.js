const { test, expect } = require("@playwright/test");
const { launchApp } = require("./helpers/electronApp");

test.describe("Preferences Page Tests", () => {
	let electronApp;
	let page;

	test.beforeEach(async () => {
		const res = await launchApp({}, undefined, "html/preferences.html");
		electronApp = res.app;
		page = res.page;
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
		await page.selectOption("#select", "es-ES");
		const savedLocale = await page.evaluate(() => localStorage.getItem("locale"));
		expect(savedLocale).toBe("es-ES");

		await page.fill("#maxDownloads", "8");
		const savedMax = await page.evaluate(() => localStorage.getItem("maxActiveDownloads"));
		expect(savedMax).toBe("8");

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
	});

	test("media settings preferences save to localStorage", async () => {
		await page.click('button[data-tab="media"]');

		await page.selectOption("#preferredVideoQuality", "1080");
		const videoQuality = await page.evaluate(() => localStorage.getItem("preferredVideoQuality"));
		expect(videoQuality).toBe("1080");

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
});
