# Agent Guide: ytDownloader


Desktop audio and video downloader GUI powered by Electron, yt-dlp, and FFmpeg.

## Tech Stack & Architecture

- **Electron**: Multi-process architecture separating Main, Preload, and Renderer.
- **Main Process (`main.js`, `src/history.js`)**:
  - Environment: Node.js (CommonJS: `require` / `module.exports`).
  - Responsibilities: App lifecycle, window management, auto-updates (`electron-updater`), tray, system shortcuts, history file storage (`userData/download_history.json`), and IPC listeners.
- **Preload Bridge (`preload.js`)**:
  - Environment: CommonJS running with Node integration before renderer scripts.
  - Exposes `window.electronAPI` to the DOM via `contextBridge.exposeInMainWorld`.
  - Bridges file system (`promises`, sync helpers), child processes (`spawn`, `exec`), system info (`si`), and `yt-dlp-wrap-plus`.
- **Renderer Process (`src/*.js`, `html/index.html`)**:
  - Environment: Browser/Chromium DOM (ES Modules: `import` / `export`).
  - No bundler (Vite/Webpack) — scripts are loaded directly as native ES modules via `<script type="module" src="...">`.
  - All Node.js and system APIs **must** be accessed through `window.electronAPI`.
  - Types defined in `src/types.d.ts`.
- **Binaries**:
  - `yt-dlp`: Managed via `yt-dlp-wrap-plus` or resolved from PATH.
  - `ffmpeg` / `ffprobe`: Bundled under `./ffmpeg/bin/` or resolved from system PATH.

## Directory Structure

```text
├── main.js                  # Electron main entry point (CJS)
├── preload.js               # Context bridge script (CJS)
├── package.json             # App configuration, scripts, dependencies
├── html/
│   └── index.html           # Single-page UI layout
├── src/
│   ├── renderer.js          # Core download logic, format parser, progress tracking (ESM)
│   ├── playlist.js          # Playlist parsing and batch downloader (ESM)
│   ├── compressor.js        # FFmpeg video compression UI & execution (ESM)
│   ├── preferences.js       # App settings UI & persistence (ESM)
│   ├── history_ui.js        # History page renderer (ESM)
│   ├── history.js           # History manager backend (CJS, required in main.js)
│   ├── logs.js              # In-app log viewer (ESM)
│   ├── utils.js / common.js # Formatters, DOM helpers, process utilities (ESM)
│   └── types.d.ts           # JSDoc and TypeScript definitions for electronAPI
├── tests/                   # Playwright specs and validation scripts
│   ├── helpers/electronApp.js # Playwright Electron launch fixture & yt-dlp mocks
│   └── translations-check.js  # Validation script for i18n consistency
└── translations/            # Localization JSON dictionaries (en.json is source)
```

## Key Commands

- **Install dependencies**: `npm install`
- **Run dev app**: `npm start`
- **Inspect / Debug**: `npm run debug`
- **Run all tests**: `npm test`
- **Run single test**: `npx playwright test tests/<spec-name>.spec.js`
- **Validate translations**: `node tests/translations-check.js`
- **Build packages**:
  - Windows: `npm run windows`
  - Linux: `npm run linux`
  - macOS: `npm run mac`

## Development Conventions & Constraints

1. **Module System Rules**:
   - `src/*.js` (except `src/history.js`) are client-side ES Modules. Do not use `require()`, `__dirname`, or Node globals directly.
   - `main.js`, `preload.js`, and `src/history.js` use CommonJS (`require` / `module.exports`).
2. **Formatting & Code Style**:
   - Indent with tabs.
   - Keep changes minimal and follow existing file conventions.
3. **Localization (i18n)**:
   - User-facing text must never be hardcoded. Use `data-translate` attributes in HTML or `i18n.__("key")` in JavaScript.
   - Any new key must exist in `translations/en.json`.
   - Run `node tests/translations-check.js` to ensure key parity across all 23 translation files before finalizing.
4. **Process & Command Execution**:
   - Always invoke external binaries via `window.electronAPI.spawn` or `window.electronAPI.YTDlpWrap`.
   - Preload wrappers automatically resolve safe working directories (`getSafeCwd`) and handle process tree termination (`killProcessSafely`).
   - In renderer code, cancel running processes by calling `proc.kill()` on the returned process wrapper or passing an `AbortSignal`.
5. **Testing**:
   - Add unit/integration specs to `tests/*.spec.js`.
   - When testing Electron flows, use the test helper in `tests/helpers/electronApp.js` with mocked `yt-dlp` output (`__mockYtDlp`).
