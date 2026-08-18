import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes("--watch");
const isProd = process.argv.includes("--minify") || process.argv.includes("--production") || process.env.NODE_ENV === "production";

/** @type {esbuild.BuildOptions[]} */
const buildConfigs = [
	// 1. Main process
	{
		entryPoints: [fs.existsSync(path.join(__dirname, "main.ts")) ? "main.ts" : "main.js"],
		outfile: "out/main.js",
		bundle: true,
		platform: "node",
		target: "node20",
		format: "cjs",
		sourcemap: !isProd,
		minify: isProd,
		legalComments: isProd ? "none" : "inline",
		drop: isProd ? ["debugger"] : [],
		external: [
			"electron",
			"electron-updater",
			"systeminformation",
			"yt-dlp-wrap-plus",
			"original-fs",
		],
	},
	// 2. Preload script
	{
		entryPoints: [fs.existsSync(path.join(__dirname, "preload.ts")) ? "preload.ts" : "preload.js"],
		outfile: "out/preload.js",
		bundle: true,
		platform: "node",
		target: "node20",
		format: "cjs",
		sourcemap: !isProd,
		minify: isProd,
		legalComments: isProd ? "none" : "inline",
		drop: isProd ? ["debugger"] : [],
		external: [
			"electron",
			"original-fs",
			"systeminformation",
			"yt-dlp-wrap-plus",
		],
	},
	// 3. Renderer scripts
	{
		entryPoints: [
			"src/renderer.js",
			"src/index.js",
			"src/playlist.js",
			"src/playlist_new.js",
			"src/compressor.js",
			"src/preferences.js",
			"src/history_ui.js",
			"src/common.js",
			"src/utils.js",
		].map((f) => {
			const tsFile = f.replace(/\.js$/, ".ts");
			return fs.existsSync(path.join(__dirname, tsFile)) ? tsFile : f;
		}),
		outdir: "out/src",
		bundle: false,
		platform: "browser",
		target: "chrome120",
		format: "esm",
		sourcemap: !isProd,
		minify: isProd,
		legalComments: isProd ? "none" : "inline",
		drop: isProd ? ["debugger"] : [],
	},
];

async function build() {
	try {
		const startTime = performance.now();
		if (isWatch) {
			const contexts = await Promise.all(buildConfigs.map((cfg) => esbuild.context(cfg)));
			await Promise.all(contexts.map((ctx) => ctx.watch()));
			console.log("⚡ Watching for changes with esbuild...");
		} else {
			await Promise.all(buildConfigs.map((cfg) => esbuild.build(cfg)));
			const duration = (performance.now() - startTime).toFixed(1);
			console.log(`✓ Build (${isProd ? "production / minified" : "development"}) completed in ${duration}ms`);
		}
	} catch (err) {
		console.error("Build failed:", err);
		process.exit(1);
	}
}

build();
