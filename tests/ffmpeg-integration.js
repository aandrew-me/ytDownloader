"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const isWin = process.platform === "win32";
const exe = (name) => (isWin ? `${name}.exe` : name);

function parseArgs(argv) {
	const opts = {
		url: DEFAULT_URL,
		ffmpegDir: process.env.FFMPEG_DIR || "",
		ytdlpPath: process.env.YTDLP_PATH || "",
		skipNetwork: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--skip-network") opts.skipNetwork = true;
		else if (arg === "--url" && argv[i + 1]) opts.url = argv[++i];
		else if (arg === "--ffmpeg" && argv[i + 1]) opts.ffmpegDir = argv[++i];
		else if (arg === "--ytdlp" && argv[i + 1]) opts.ytdlpPath = argv[++i];
	}
	return opts;
}

function resolveFfmpegDir(explicitDir) {
	const candidates = [
		explicitDir,
		path.resolve(__dirname, "..", "ffmpeg", "bin"),
		path.join(os.homedir(), ".ytDownloader", "ffmpeg", "bin"),
	].filter(Boolean);

	for (const dir of candidates) {
		if (
			fs.existsSync(path.join(dir, exe("ffmpeg"))) &&
			fs.existsSync(path.join(dir, exe("ffprobe")))
		) {
			return dir;
		}
	}
	return null; // fall back to PATH
}

function resolveYtdlp(explicitPath) {
	const candidates = [
		explicitPath,
		path.join(os.homedir(), ".ytDownloader", exe("ytdlp")),
		path.join(os.homedir(), ".ytDownloader", exe("yt-dlp")),
	].filter(Boolean);

	for (const file of candidates) {
		if (fs.existsSync(file)) return file;
	}
	return exe("yt-dlp");
}

function run(bin, args, { cwd, allowFail = false, timeout = 120_000 } = {}) {
	const res = spawnSync(bin, args, {
		cwd,
		encoding: "utf8",
		timeout,
		windowsHide: true,
	});
	if (res.error && !allowFail) {
		throw new Error(`Failed to spawn ${bin}: ${res.error.message}`);
	}
	if (res.status !== 0 && !allowFail) {
		throw new Error(
			`${path.basename(bin)} ${args.join(" ")} exited ${res.status}\n${res.stderr || res.stdout}`,
		);
	}
	return res;
}

function probe(ffprobeBin, filePath) {
	const res = run(ffprobeBin, [
		"-v",
		"quiet",
		"-print_format",
		"json",
		"-show_format",
		"-show_streams",
		filePath,
	]);
	const data = JSON.parse(res.stdout);
	assert.ok(Array.isArray(data.streams) && data.streams.length > 0, `No streams in ${filePath}`);
	return data;
}

function assertFileNonEmpty(filePath) {
	assert.ok(fs.existsSync(filePath), `Expected output file missing: ${filePath}`);
	const stat = fs.statSync(filePath);
	assert.ok(stat.size > 0, `Expected non-empty output file: ${filePath}`);
}

function createRunner() {
	let passed = 0;
	let failed = 0;
	let skipped = 0;

	function test(name, fn) {
		process.stdout.write(`  [RUN ] ${name} ... `);
		try {
			const result = fn();
			if (result && result.skip) {
				skipped++;
				console.log(`SKIP (${result.skip})`);
			} else {
				passed++;
				console.log("PASS");
			}
		} catch (err) {
			failed++;
			console.log("FAIL");
			console.error(`         ${err.message.split("\n").join("\n         ")}`);
		}
	}

	function summary() {
		console.log(`\nSummary: ${passed} passed, ${skipped} skipped, ${failed} failed`);
		return failed === 0;
	}

	return { test, summary };
}

function writeSyntheticInputs(yuvPath, wavPath) {
	// 30 frames (1s @ 30fps) of 160x120 yuv420p with a moving gradient
	const w = 160;
	const h = 120;
	const frameSize = (w * h * 3) / 2;
	const frames = 30;
	const yuv = Buffer.alloc(frameSize * frames, 128);
	for (let f = 0; f < frames; f++) {
		const offset = f * frameSize;
		for (let y = 0; y < h; y++) {
			yuv.fill((y + f * 8) & 0xff, offset + y * w, offset + (y + 1) * w);
		}
	}
	fs.writeFileSync(yuvPath, yuv);

	// 1s mono 16-bit PCM WAV @ 44100 Hz
	const sampleRate = 44100;
	const numSamples = sampleRate;
	const dataSize = numSamples * 2;
	const wav = Buffer.alloc(44 + dataSize);
	wav.write("RIFF", 0);
	wav.writeUInt32LE(36 + dataSize, 4);
	wav.write("WAVEfmt ", 8);
	wav.writeUInt32LE(16, 16); // PCM chunk size
	wav.writeUInt16LE(1, 20); // PCM format
	wav.writeUInt16LE(1, 22); // mono
	wav.writeUInt32LE(sampleRate, 24);
	wav.writeUInt32LE(sampleRate * 2, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write("data", 36);
	wav.writeUInt32LE(dataSize, 40);
	for (let i = 0; i < numSamples; i++) {
		wav.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), 44 + i * 2);
	}
	fs.writeFileSync(wavPath, wav);
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	const ffmpegDir = resolveFfmpegDir(opts.ffmpegDir);
	const ffmpegBin = ffmpegDir ? path.join(ffmpegDir, exe("ffmpeg")) : exe("ffmpeg");
	const ffprobeBin = ffmpegDir ? path.join(ffmpegDir, exe("ffprobe")) : exe("ffprobe");
	const ytdlpBin = resolveYtdlp(opts.ytdlpPath);

	console.log(`ffmpeg : ${ffmpegBin}`);
	console.log(`ffprobe: ${ffprobeBin}`);
	console.log(`yt-dlp : ${ytdlpBin}`);

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdownloader-ffmpeg-test-"));
	const { test, summary } = createRunner();

	try {
		const encodersOut = run(ffmpegBin, ["-hide_banner", "-encoders"]).stdout;
		const sampleMp4 = path.join(tmpDir, "sample.mp4");

		console.log("\n=== 1. FFmpeg & FFprobe Core / Compressor Tests ===");

		test("ffmpeg -version & ffprobe -version", () => {
			const v1 = run(ffmpegBin, ["-version"]).stdout;
			const v2 = run(ffprobeBin, ["-version"]).stdout;
			assert.match(v1, /ffmpeg version/i);
			assert.match(v2, /ffprobe version/i);
		});

		test("generate synthetic sample.mp4 (libx264 + aac) & ffprobe JSON", () => {
			const yuvPath = path.join(tmpDir, "in.yuv");
			const wavPath = path.join(tmpDir, "in.wav");
			writeSyntheticInputs(yuvPath, wavPath);
			run(ffmpegBin, [
				"-y",
				"-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", "160x120", "-r", "30", "-i", yuvPath,
				"-i", wavPath,
				"-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
				sampleMp4,
			]);
			const info = probe(ffprobeBin, sampleMp4);
			assert.equal(info.streams.find((s) => s.codec_type === "video")?.codec_name, "h264");
			assert.equal(info.streams.find((s) => s.codec_type === "audio")?.codec_name, "aac");
		});

		test("compress libx264 -> mp4", () => {
			const out = path.join(tmpDir, "out_x264.mp4");
			run(ffmpegBin, ["-y", "-i", sampleMp4, "-c:v", "libx264", "-preset", "fast", "-crf", "28", "-c:a", "aac", out]);
			assert.equal(probe(ffprobeBin, out).streams[0].codec_name, "h264");
		});

		test("compress libx265 (8-bit & 10-bit) -> mkv", () => {
			const out8 = path.join(tmpDir, "out_x265_8.mkv");
			const out10 = path.join(tmpDir, "out_x265_10.mkv");
			run(ffmpegBin, ["-y", "-i", sampleMp4, "-c:v", "libx265", "-preset", "ultrafast", "-crf", "28", "-c:a", "copy", out8]);
			run(ffmpegBin, ["-y", "-i", sampleMp4, "-c:v", "libx265", "-preset", "ultrafast", "-pix_fmt", "yuv420p10le", "-c:a", "copy", out10]);
			assert.equal(probe(ffprobeBin, out8).streams[0].codec_name, "hevc");
			assert.equal(probe(ffprobeBin, out10).streams[0].pix_fmt, "yuv420p10le");
		});

		test("compress libsvtav1 -> mkv & decode", () => {
			if (!encodersOut.includes("libsvtav1")) {
				return { skip: "libsvtav1 not built in this ffmpeg version" };
			}
			const out = path.join(tmpDir, "out_av1.mkv");
			run(ffmpegBin, ["-y", "-i", sampleMp4, "-c:v", "libsvtav1", "-preset", "10", "-c:a", "copy", out]);
			assert.equal(probe(ffprobeBin, out).streams[0].codec_name, "av1");
			run(ffmpegBin, ["-y", "-i", out, "-f", "null", "-"]);
		});

		test("recode to webm (libvpx-vp9 + libopus)", () => {
			const out = path.join(tmpDir, "out.webm");
			run(ffmpegBin, ["-y", "-i", sampleMp4, "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", out]);
			const info = probe(ffprobeBin, out);
			assert.equal(info.streams.find((s) => s.codec_type === "video")?.codec_name, "vp9");
			assert.equal(info.streams.find((s) => s.codec_type === "audio")?.codec_name, "opus");
		});

		test("thumbnails (webp -> png / jpg) & cover art embedding", () => {
			const webp = path.join(tmpDir, "thumb.webp");
			const png = path.join(tmpDir, "thumb.png");
			const jpg = path.join(tmpDir, "thumb.jpg");
			const mp3WithArt = path.join(tmpDir, "art.mp3");
			run(ffmpegBin, ["-y", "-i", sampleMp4, "-vframes", "1", "-c:v", "libwebp", webp]);
			run(ffmpegBin, ["-y", "-i", webp, png]);
			run(ffmpegBin, ["-y", "-i", webp, jpg]);
			assertFileNonEmpty(png);
			assertFileNonEmpty(jpg);
			run(ffmpegBin, [
				"-y", "-i", sampleMp4, "-i", jpg,
				"-map", "0:a", "-map", "1:v",
				"-c:a", "libmp3lame", "-c:v", "copy",
				"-id3v2_version", "3", "-metadata", "title=TestTitle",
				mp3WithArt,
			]);
			const info = probe(ffprobeBin, mp3WithArt);
			assert.equal(info.streams.some((s) => s.codec_type === "audio"), true);
			assert.equal(info.streams.some((s) => s.codec_type === "video"), true);
		});

		test("audio extraction formats (mp3, m4a, opus, flac, alac, wav)", () => {
			const specs = [
				["out.mp3", ["-c:a", "libmp3lame"]],
				["out.m4a", ["-c:a", "aac"]],
				["out.opus", ["-c:a", "libopus"]],
				["out.flac", ["-c:a", "flac"]],
				["out_alac.m4a", ["-c:a", "alac"]],
				["out.wav", ["-c:a", "pcm_s16le"]],
			];
			for (const [file, codecArgs] of specs) {
				const out = path.join(tmpDir, file);
				run(ffmpegBin, ["-y", "-i", sampleMp4, "-vn", ...codecArgs, out]);
				assertFileNonEmpty(out);
			}
		});

		const hwTargets = [
			["h264_nvenc", ["-c:v", "h264_nvenc"]],
			["hevc_nvenc", ["-c:v", "hevc_nvenc"]],
			["h264_amf", ["-c:v", "h264_amf"]],
			["hevc_amf", ["-c:v", "hevc_amf"]],
			["h264_qsv", ["-c:v", "h264_qsv"]],
			["hevc_qsv", ["-c:v", "hevc_qsv"]],
		];
		if (process.platform === "linux" && fs.existsSync("/dev/dri/renderD128")) {
			hwTargets.push(
				["h264_vaapi", ["-vaapi_device", "/dev/dri/renderD128", "-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi"]],
				["hevc_vaapi", ["-vaapi_device", "/dev/dri/renderD128", "-vf", "format=nv12,hwupload", "-c:v", "hevc_vaapi"]],
			);
		}
		for (const [name, hwArgs] of hwTargets) {
			test(`hardware accel (${name})`, () => {
				if (!encodersOut.includes(name)) return { skip: `${name} not registered` };
				const out = path.join(tmpDir, `hw_${name}.mp4`);
				const res = run(
					ffmpegBin,
					["-y", "-i", sampleMp4, ...hwArgs, "-an", out],
					{ allowFail: true },
				);
				if (res.status !== 0) return { skip: "no compatible GPU/driver on this machine" };
				assertFileNonEmpty(out);
			});
		}

		if (opts.skipNetwork) {
			console.log("\n=== 2. yt-dlp Network Tests (skipped via --skip-network) ===");
		} else {
			console.log(`\n=== 2. yt-dlp Real Download Tests (${opts.url}) ===`);
			const ytdlpBase = ["--no-playlist", "--ffmpeg-location", ffmpegDir || path.dirname(ffmpegBin)];

			test("yt-dlp download H.264 + AAC -> mp4", () => {
				const out = path.join(tmpDir, "yt_h264.mp4");
				run(ytdlpBin, [...ytdlpBase, "-f", "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/b[ext=mp4]", "--merge-output-format", "mp4", "-o", out, opts.url]);
				assertFileNonEmpty(out);
			});

			test("yt-dlp download VP9 + Opus -> webm", () => {
				const out = path.join(tmpDir, "yt_vp9.webm");
				const res = run(ytdlpBin, [...ytdlpBase, "-f", "bv*[vcodec^=vp9]+ba[acodec=opus]/bv*[vcodec^=vp9]+ba", "--merge-output-format", "webm", "-o", out, opts.url], { allowFail: true });
				if (res.status !== 0 && /Requested format is not available/i.test(res.stderr)) {
					return { skip: "VP9 stream not available on test URL" };
				}
				assert.equal(res.status, 0, res.stderr);
				assertFileNonEmpty(out);
			});

			test("yt-dlp download AV1 + Opus -> mkv", () => {
				const out = path.join(tmpDir, "yt_av1.mkv");
				const res = run(ytdlpBin, [...ytdlpBase, "-f", "bv*[vcodec^=av01]+ba[acodec=opus]/bv*[vcodec^=av01]+ba", "--merge-output-format", "mkv", "-o", out, opts.url], { allowFail: true });
				if (res.status !== 0 && /Requested format is not available/i.test(res.stderr)) {
					return { skip: "AV1 stream not available on test URL" };
				}
				assert.equal(res.status, 0, res.stderr);
				assertFileNonEmpty(out);
			});

			test("yt-dlp video trimming (--download-sections --force-keyframes-at-cuts)", () => {
				const out = path.join(tmpDir, "yt_trimmed.mp4");
				run(ytdlpBin, [...ytdlpBase, "-f", "b[ext=mp4]/bv*+ba", "--download-sections", "*00:02-00:07", "--force-keyframes-at-cuts", "--merge-output-format", "mp4", "-o", out, opts.url]);
				const dur = Number(probe(ffprobeBin, out).format.duration);
				assert.ok(dur > 1 && dur < 12, `Unexpected trimmed duration: ${dur}s`);
			});

			test("yt-dlp thumbnail download & convert to png", () => {
				const tmpl = path.join(tmpDir, "yt_thumb.%(ext)s");
				run(ytdlpBin, [...ytdlpBase, "--skip-download", "--write-thumbnail", "--convert-thumbnails", "png", "-o", tmpl, opts.url]);
				assertFileNonEmpty(path.join(tmpDir, "yt_thumb.png"));
			});

			test("yt-dlp compatible mode (libx264 + aac + embed-metadata + embed-thumbnail)", () => {
				const out = path.join(tmpDir, "yt_compat.mp4");
				run(ytdlpBin, [
					...ytdlpBase,
					"-f", "b[ext=mp4]/bv*+ba",
					"--merge-output-format", "mp4",
					"--recode-video", "mp4",
					"--embed-metadata",
					"--embed-thumbnail",
					"--postprocessor-args", "Metadata+ffmpeg_o:-c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k",
					"-o", out,
					opts.url,
				]);
				const info = probe(ffprobeBin, out);
				assert.equal(info.streams.find((s) => s.codec_type === "video")?.codec_name, "h264");
				assert.equal(info.streams.find((s) => s.codec_type === "audio")?.codec_name, "aac");
			});

			test("yt-dlp extract audio (mp3 + embed-metadata + embed-thumbnail)", () => {
				const tmpl = path.join(tmpDir, "yt_audio.%(ext)s");
				run(ytdlpBin, [...ytdlpBase, "-x", "--audio-format", "mp3", "--embed-metadata", "--embed-thumbnail", "-o", tmpl, opts.url]);
				assertFileNonEmpty(path.join(tmpDir, "yt_audio.mp3"));
			});
		}
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}

	if (!summary()) process.exit(1);
}

main();
