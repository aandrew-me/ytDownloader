const { test, expect } = require("@playwright/test");
const os = require("os");
const fs = require("fs");
const path = require("path");
const {
	launchApp,
	getExecutedCommands,
	clearExecutedCommands,
} = require("./helpers/electronApp");

async function attachTestFile(page, fileName = "test_video.mp4") {
	const tempFilePath = path.join(os.tmpdir(), fileName);
	if (!fs.existsSync(tempFilePath)) {
		fs.writeFileSync(tempFilePath, "mock video content");
	}
	await page.setInputFiles("#fileInput", tempFilePath);
}

async function waitForFfmpegCommand(page) {
	await page.waitForFunction(() => {
		const cmds = window.__executedCommands || [];
		return cmds.some((cmd) => cmd.includes("-i") && !cmd.includes("-show_entries"));
	});
}

async function getFfmpegCommands(page) {
	const commands = await getExecutedCommands(page);
	return commands.filter(
		(cmd) => cmd.includes("-hide_banner") || (cmd.includes("-i") && !cmd.includes("-show_entries")),
	);
}

test.describe("Compressor Page Tests", () => {
	let electronApp;
	let page;

	test.beforeEach(async () => {
		const res = await launchApp();
		electronApp = res.app;
		page = res.page;
		await page.waitForFunction(() => typeof window.switchView === "function");
		await page.click("#compressorWin");
	});

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test("small file quality preset generates correct -crf 28 argument", async () => {
		await attachTestFile(page);

		// Select small file preset (CRF 28)
		await page.click('button[data-quality="small"]');

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-c:v");
		expect(ffmpegCmd).toContain("libx264");
		expect(ffmpegCmd).toContain("-crf");
		expect(ffmpegCmd).toContain("28");
		expect(ffmpegCmd).toContain("-preset");
		expect(ffmpegCmd).toContain("medium");
		expect(ffmpegCmd).toContain("-c:a");
		expect(ffmpegCmd).toContain("copy");
	});

	test("balanced quality preset generates default -crf 23 argument", async () => {
		await attachTestFile(page);

		// Select balanced preset (CRF 23)
		await page.click('button[data-quality="balanced"]');

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-crf");
		const crfIndex = ffmpegCmd.indexOf("-crf");
		expect(ffmpegCmd[crfIndex + 1]).toBe("23");
	});

	test("high quality preset generates -crf 18 argument", async () => {
		await attachTestFile(page);

		// Select high quality preset (CRF 18)
		await page.click('button[data-quality="high"]');

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-crf");
		const crfIndex = ffmpegCmd.indexOf("-crf");
		expect(ffmpegCmd[crfIndex + 1]).toBe("18");
	});

	test("custom CRF slider setting is passed to ffmpeg command", async () => {
		await attachTestFile(page);

		await page.click('button[data-quality="custom"]');

		// In compressor.js: crf = 69 - sliderVal. Setting slider to 39 gives crf = 30.
		await page.evaluate(() => {
			const slider = document.getElementById("quality-slider");
			slider.value = "39";
			slider.dispatchEvent(new Event("input", { bubbles: true }));
		});

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-crf");
		const crfIndex = ffmpegCmd.indexOf("-crf");
		expect(ffmpegCmd[crfIndex + 1]).toBe("30");
	});

	test("target size preset calculates and passes bitrate -b:v to ffmpeg command", async () => {
		await attachTestFile(page);

		await page.click('button[data-quality="target-size"]');

		// Set target size input to 10 MB
		await page.fill("#target-size-input", "10");

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-b:v");
		const bvIndex = ffmpegCmd.indexOf("-b:v");
		expect(ffmpegCmd[bvIndex + 1]).toMatch(/^\d+$/);
	});

	test("x265 encoder selection uses libx265 codec in ffmpeg command", async () => {
		await attachTestFile(page);

		await page.click('button[data-quality="balanced"]');
		await page.selectOption("#encoder", "x265");

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-c:v");
		const cvIndex = ffmpegCmd.indexOf("-c:v");
		expect(ffmpegCmd[cvIndex + 1]).toBe("libx265");
	});

	test("compression speed preset passes -preset flag to ffmpeg command", async () => {
		await attachTestFile(page);

		await page.click('button[data-quality="balanced"]');
		await page.selectOption("#compression-speed", "slow");

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-preset");
		const presetIndex = ffmpegCmd.indexOf("-preset");
		expect(ffmpegCmd[presetIndex + 1]).toBe("slow");
	});

	test("audio format selection passes -c:a copy to ffmpeg command", async () => {
		await attachTestFile(page);

		await page.click('button[data-quality="balanced"]');
		await page.selectOption("#audio-format", "copy");

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		expect(ffmpegCmd).toContain("-c:a");
		const caIndex = ffmpegCmd.indexOf("-c:a");
		expect(ffmpegCmd[caIndex + 1]).toBe("copy");
	});

	test("file extension selection sets output format extension", async () => {
		await attachTestFile(page);

		await page.click('button[data-quality="balanced"]');
		await page.selectOption("#file_extension", "mkv");

		await clearExecutedCommands(page);

		await page.click("#compress-btn");
		await waitForFfmpegCommand(page);

		const commands = await getFfmpegCommands(page);
		expect(commands.length).toBeGreaterThan(0);
		const ffmpegCmd = commands[commands.length - 1];

		const outputPath = ffmpegCmd[ffmpegCmd.length - 1];
		expect(outputPath.endsWith(".mkv")).toBe(true);
	});
});
