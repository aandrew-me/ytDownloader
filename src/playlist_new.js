// Disable TypeScript checking for this file (we're in a plain JS renderer file
// that uses Electron's renderer API and some DOM assignments that the TS
// checker complains about).
// @ts-nocheck
const { clipboard, shell, ipcRenderer } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-plus");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync, exec, spawnSync } = require("child_process");

// --- Global Variables and Configuration (Unified from both playlist.js and playlist_new.js) ---

let url = ""; // This 'url' variable is used for full playlist downloads and passed to yt-dlp.

const ytDlpExecutablePath = localStorage.getItem("ytdlp");
const ytdlp = new YTDlpWrap(ytDlpExecutablePath);
const downloadsDir = path.join(os.homedir(), "Downloads"); // Get default downloads directory
let downloadDir = localStorage.getItem("downloadPath") || downloadsDir;

// Ensure download directory is writable, falling back to default if not.
try {
    fs.accessSync(downloadDir, fs.constants.W_OK);
} catch (err) {
    console.log(
        "Unable to write to download directory. Switching to default one."
    );
    console.log("Err:", err);
    downloadDir = downloadsDir;
    localStorage.setItem("downloadPath", downloadsDir);
}

// Initialize i18n
const i18n = new (require("../translations/i18n"))();

let cookieArg = "";
let browser = "";
const formats = { // This seems to be yt-dlp format codes for various resolutions
    144: 160,
    240: 133,
    360: 134,
    480: 135,
    720: 136,
    1080: 137, // Consistent with playlist_new.js, original playlist.js had 299
    1440: 400,
    2160: 401,
    4320: 571,
};

let ffmpeg;
let ffmpegPath;

if (os.platform() === "win32") {
    ffmpegPath = `${__dirname}\\..\\ffmpeg.exe`;
} else if (os.platform() === "freebsd") {
    try {
        ffmpegPath = execSync("which ffmpeg")
            .toString("utf8")
            .split("\n")[0]
            .trim();
    } catch (error) {
        console.log(error);
    }
} else {
    ffmpegPath = `${__dirname}/../ffmpeg`;
}

if (process.env.YTDOWNLOADER_FFMPEG_PATH) {
    ffmpegPath = `${process.env.YTDOWNLOADER_FFMPEG_PATH}`;
    if (fs.existsSync(process.env.YTDOWNLOADER_FFMPEG_PATH)) {
        console.log("Using YTDOWNLOADER_FFMPEG_PATH");
    } else {
        console.error("No ffmpeg found in " + ffmpeg);
    }
}
ffmpeg = `"${ffmpegPath}"`; // Encapsulate path in quotes for exec
console.log("ffmpeg:", ffmpeg);

let foldernameFormat = "%(playlist_title)s";
let filenameFormat = "%(playlist_index)s.%(title)s.%(ext)s"; // Default for full playlist
let playlistIndex = 1;
let playlistEnd = "";
let proxy = localStorage.getItem("proxy") || "";

// Patterns for progress/status messages
const playlistTxt = "Downloading playlist: ";
const videoIndex = "Downloading item ";
const oldVideoIndex = "Downloading video ";

// --- Helper Functions ---

function getId(id) {
    return document.getElementById(id);
}

function formatTime(seconds) {
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds - hours * 3600) / 60);
    seconds = seconds - hours * 3600 - minutes * 60;
    let formattedTime = "";

    if (hours > 0) {
        formattedTime += hours + ":";
    }
    if (minutes < 10 && hours > 0) {
        formattedTime += "0";
    }
    formattedTime += minutes + ":";
    if (seconds < 10) {
        formattedTime += "0";
    }
    formattedTime += seconds;
    return formattedTime;
}

function closeMenu() {
    getId("menuIcon").style.transform = "rotate(0deg)";
    let count = 0;
    let opacity = 1;
    const fade = setInterval(() => {
        if (count >= 10) {
            clearInterval(fade);
        } else {
            opacity -= 0.1;
            getId("menu").style.opacity = String(opacity);
            count++;
        }
    }, 50);
}

// Error handling for full playlist downloads
function showErrorTxt(error, currentUrl = url) {
    console.log("Error " + error);
    getId("pasteLink").style.display = "inline-block";
    getId("openDownloads").style.display = "none";
    getId("options").style.display = "block"; // Show options to let user try again
    getId("playlistName").textContent = "";
    getId("incorrectMsg").textContent = i18n.__(
        "Some error has occurred. Check your network and use correct URL"
    );
    getId("incorrectMsg").style.display = "block";
    getId("incorrectMsg").title = error;
    getId("errorBtn").style.display = "inline-block";
    getId("errorDetails").innerHTML = `
    <strong>URL: ${currentUrl}</strong>
    <br><br>
    ${error}
    `;
    getId("errorDetails").title = i18n.__("Click to copy");
}

// File and folder name patterns
function nameFormatting() {
    if (localStorage.getItem("foldernameFormat")) {
        foldernameFormat = localStorage.getItem("foldernameFormat");
    }
    if (localStorage.getItem("filenameFormat")) {
        filenameFormat = localStorage.getItem("filenameFormat");
    } else {
        filenameFormat = "%(playlist_index)s.%(title)s.%(ext)s"; // Default for full playlist
    }
}

// Handle playlist range for full playlist downloads
function managePlaylistRange() {
    if (getId("playlistIndex").value) {
        playlistIndex = Number(getId("playlistIndex").value);
    } else {
        playlistIndex = 1;
    }
    if (getId("playlistEnd").value) {
        playlistEnd = getId("playlistEnd").value;
    } else {
        playlistEnd = "";
    }
    console.log(`Range: ${playlistIndex}:${playlistEnd}`);
}

function afterCloseFullPlaylist(count) {
    if (getId(`p${count}`)) { // Ensure the element exists before trying to update
        getId(`p${count}`).textContent = i18n.__("File saved.");
    }
    getId("pasteLink").style.display = "inline-block";
    getId("openDownloads").style.display = "inline-block"; // Show open downloads button

    const notify = new Notification("ytDownloader", {
        body: i18n.__("Playlist downloaded"),
        icon: "../assets/images/icon.png",
    });

    notify.onclick = () => {
        openFolder(downloadDir);
    };
}

function openFolder(location) {
    shell.openPath(location);
}

// --- Main UI Logic ---

// Function to paste link and process playlist data
function pasteLink() {
    const clipboardText = clipboard.readText().trim();
    url = clipboardText; // Set the global url for full playlist downloads

    if (!clipboardText.startsWith('http')) {
        getId("loadingWrapper").style.display = "none";
        getId("incorrectMsg").textContent = "The copied text is not a valid URL. Please copy a playlist URL and try again.";
        return;
    }

    getId("loadingWrapper").style.display = "flex";
    getId("incorrectMsg").textContent = "";
    getId("errorBtn").style.display = "none";
    getId("errorDetails").style.display = "none";
    getId("errorDetails").textContent = "";
    getId("link").textContent = " " + clipboardText; // Display link in options box

    exec(
        `${ytDlpExecutablePath} --yes-playlist --no-warnings -J --flat-playlist "${clipboardText}"`,
        (error, stdout, stderr) => {
            getId("loadingWrapper").style.display = "none";
            if (error) {
                showErrorTxt(error, clipboardText);
                // Hide options box if there's an error
                getId("options").style.display = "none"; 
            } else {
                const parsed = JSON.parse(stdout);
                console.log(parsed);
                getId("options").style.display = "block"; // Show the main options container
                
                // Switch to Selective Video tab by default when playlist is parsed
                showMode("selectiveVideo");

                // Populate selective video list
                let items = "";
                if (parsed.entries) {
                    getId("selectiveVideoListContainer").innerHTML = ""; // Clear previous list
                    parsed.entries.forEach((entry) => {
                        const randId = Math.random().toFixed(10).toString().slice(2);
                        if (entry.url) {
                            items += `
                            <div class="item" id="item-${randId}">
                                <img src="${
                                    entry.thumbnails && entry.thumbnails.length > 0 ? entry.thumbnails[entry.thumbnails.length - 1].url : '../assets/images/no-thumbnail.png'
                                }" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">
                                <div class="itemBody">
                                    <div class="itemTitle">${entry.title}</div>
                                    <div>${formatTime(entry.duration)}</div>
                                    <div class="status" id="status-${randId}"></div>
                                </div>
                                <input type="checkbox" class="playlistCheck" id="c${randId}">
                                <input type="hidden" id="link${randId}" value="${entry.url}">
                            </div>
                            `;
                        }
                    });
                    getId("selectiveVideoListContainer").innerHTML = items;
                    getId("incorrectMsg").textContent = ""; // Clear any previous general error
                } else {
                    getId("incorrectMsg").textContent = i18n.__("Incompatible URL. Please provide a playlist URL");
                    getId("options").style.display = "none"; // Hide options if not a playlist
                }
            }
        }
    );
}

getId("pasteLink").addEventListener("click", () => {
    pasteLink();
});

document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key == "v") {
        pasteLink();
    }
});

// --- Mode Toggle Logic ---
function showMode(mode) {
    const modes = ["fullVideo", "selectiveVideo", "audio"];
    modes.forEach(m => {
        getId(`${m}ModeBox`).style.display = "none";
        getId(`${m}Toggle`).classList.remove("active");
    });

    getId(`${mode}ModeBox`).style.display = "block";
    getId(`${mode}Toggle`).classList.add("active");

    // Clear previous full playlist progress messages if switching from full download modes
    if (mode !== "selectiveVideo") {
        getId("playlistName").textContent = "";
        getId("list").innerHTML = "";
        getId("openDownloads").style.display = "none";
    }
    
    // For selective video mode, we might want to make the 'data' div visible
    // and hide the 'list' div, and vice versa for full modes.
    // However, the playlist_new.js uses getId("data") to populate the list.
    // So, we'll ensure selectiveVideoListContainer is populated for selective mode.
}

getId("fullVideoToggle").addEventListener("click", () => showMode("fullVideo"));
getId("selectiveVideoToggle").addEventListener("click", () => showMode("selectiveVideo"));
getId("audioToggle").addEventListener("click", () => showMode("audio"));

// Set initial active mode (will be overridden by pasteLink)
showMode("fullVideo"); // Default to full video on initial load


// --- Full Playlist Download Logic (Adapted from old playlist.js) ---

/**
 * Initiates download for a full playlist (video or audio).
 * @param {string} type 'video' or 'audio'.
 */
function downloadFullPlaylist(type) {
    let configArg = "";
    let configTxt = "";
    if (localStorage.getItem("configPath")) {
        configArg = "--config-location";
        configTxt = `"${localStorage.getItem("configPath")}"`;
    }
    proxy = localStorage.getItem("proxy") || "";

    nameFormatting();
    originalCount = 0; // Reset for new full playlist download

    managePlaylistRange(); // Apply start/end range from UI

    if (localStorage.getItem("browser")) {
        browser = localStorage.getItem("browser");
    } else {
        browser = "";
    }
    if (browser) {
        cookieArg = "--cookies-from-browser";
    } else {
        cookieArg = "";
    }

    let count = 0;
    let subs, subLangs;
    if (getId("subChecked").checked) {
        subs = "--write-subs";
        subLangs = "--sub-langs all";
    } else {
        subs = "";
        subLangs = "";
    }

    // Hide options and show processing message for full playlist
    getId("options").style.display = "none";
    getId("list").innerHTML = ""; // Clear old progress list
    getId("errorBtn").style.display = "none";
    getId("errorDetails").style.display = "none";
    getId("errorDetails").textContent = "";
    getId("incorrectMsg").style.display = "none";
    getId("playlistName").textContent = i18n.__("Processing") + "...";
    getId("pasteLink").style.display = "none";
    getId("openDownloads").style.display = "inline-block"; // Show open downloads button immediately

    let quality, format, downloadProcess, videoType, audioQualityFormat, audioQualityValue;

    if (type === "video") {
        quality = getId("selectFullVideoQuality").value;
        videoType = getId("videoTypeSelectFullVideo").value;
        
        if (quality === "best") {
            format = "-f bv*+ba/best";
        } else if (quality === "worst") {
            format = "-f wv+wa/worst";
        } else if (quality === "useConfig") {
            format = "";
        } else {
            if (videoType === "mp4") {
                format = `-f "bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}]/best" --merge-output-format "mp4" --recode-video "mp4"`;
            } else if (videoType === "webm") {
                format = `-f "bestvideo[height<=${quality}][ext=webm]+bestaudio[ext=webm]/best[height<=${quality}]/best" --merge-output-format "webm" --recode-video "webm"`;
            } else { // Auto or general highest quality for resolution
                format = `-f "bv*[height=${quality}]+ba/best[height=${quality}]/best[height<=${quality}]"`;
            }
        }
    } else { // type === "audio"
        audioQualityFormat = getId("selectFullAudioFormat").value;
        audioQualityValue = getId("selectFullAudioQuality").value;
        
        if (
            (url.includes("youtube.com/") || url.includes("youtu.be/")) &&
            audioQualityFormat === "m4a" &&
            audioQualityValue === "auto"
        ) {
            console.log("Downloading m4a without extracting");
            format = `ba[ext=${audioQualityFormat}]/ba`;
            audioQualityValue = ""; // No separate audio-quality flag
        } else {
            console.log("Extracting audio as " + audioQualityFormat);
            format = audioQualityFormat; // This will be used with -x and --audio-format
        }
    }

    const controller = new AbortController();

    const commonArgs = [
        "--yes-playlist",
        "--no-warnings",
        "-o",
        `"${path.join(downloadDir, foldernameFormat, filenameFormat)}"`,
        "-I",
        `"${playlistIndex}:${playlistEnd}"`,
        "--ffmpeg-location",
        ffmpeg,
        cookieArg,
        browser,
        configArg,
        configTxt,
        "--embed-metadata",
        subs,
        subLangs,
        (type === "video" && videoType === "mp4" && (url.includes("youtube.com/") || url.includes("youtu.be/")) && os.platform() !== "darwin") ||
        (type === "audio" && (audioQualityFormat === "mp3" || (audioQualityFormat === "m4a" && (url.includes("youtube.com/") || url.includes("youtu.be/")) && os.platform() !== "darwin")))
            ? "--embed-thumbnail"
            : "",
        proxy ? "--no-check-certificate" : "",
        proxy ? "--proxy" : "",
        proxy,
        "--compat-options",
        "no-youtube-unavailable-videos",
        `"${url}"`,
    ].filter(Boolean); // Filter out empty strings/false values

    let args;
    if (type === "video") {
        args = [ format, ...commonArgs ];
    } else { // type === "audio"
        if (audioQualityValue === "") { // Direct m4a download case
            args = [ "-f", format, ...commonArgs ];
        } else { // Extract audio case
            args = [
                "-x",
                "--audio-format", format,
                "--audio-quality", audioQualityValue,
                ...commonArgs
            ];
        }
    }

    downloadProcess = ytdlp.exec(
        args,
        { shell: true, detached: false },
        controller.signal
    );

    downloadProcess.on("ytDlpEvent", (_eventType, eventData) => {
        if (eventData.includes(playlistTxt)) {
            let playlistName = eventData.split("playlist:")[1].slice(1);
            getId("playlistName").textContent =
                i18n.__("Downloading playlist:") + " " + playlistName;
        }

        if (
            (eventData.includes(videoIndex) ||
                eventData.includes(oldVideoIndex)) &&
            !eventData.includes("thumbnail")
        ) {
            count += 1;
            originalCount += 1;
            let itemTitle;
            if (type === "video") {
                itemTitle = i18n.__("Video") + " " + originalCount;
            } else {
                itemTitle = i18n.__("Audio") + " " + originalCount;
            }

            if (count > 1) {
                getId(`p${count - 1}`).textContent = i18n.__("File saved.");
            }

            const item = `<div class="playlistItem">
            <p class="itemTitle">${itemTitle}</p>
            <p class="itemProgress" id="p${count}">${i18n.__("Downloading...")}</p>
            </div>`;
            getId("list").innerHTML += item;

            window.scrollTo(0, document.body.scrollHeight);
        }
    });

    downloadProcess.on("progress", (progress) => {
        if (progress.percent === 100) {
            if (getId(`p${count}`)) {
                getId(`p${count}`).textContent = i18n.__("Processing") + "...";
            }
        } else {
            if (getId(`p${count}`)) {
                getId(`p${count}`).textContent = `${i18n.__("Progress")} ${
                    progress.percent
                }% | ${i18n.__("Speed")} ${progress.currentSpeed || 0}`;
            }
        }
    });

    downloadProcess.on("error", (error) => {
        showErrorTxt(error);
    });

    downloadProcess.on("close", () => {
        afterCloseFullPlaylist(count);
    });
}

// all videos, selective video, and audio toggle 
const fullVideoToggle = getId("fullVideoToggle");
const selectiveVideoToggle = getId("selectiveVideoToggle");
const audioToggle = getId("audioToggle");

// setting initial states (full video as default)
fullVideoToggle.style.backgroundColor = "var(--box-toggle)";
selectiveVideoToggle.style.backgroundColor = "var(--box-toggleOn)";
audioToggle.style.backgroundColor = "var(--box-toggle)";

getId("fullVideoModeBox").style.display = "block";
getId("selectiveVideoModeBox").style.display = "none";
getId("audioModeBox").style.display = "none";

// for "Full Video" button
fullVideoToggle.addEventListener("click", () => {
    fullVideoToggle.style.backgroundColor = "var(--box-toggleOn)";
    selectiveVideoToggle.style.backgroundColor = "var(--box-toggle)";
    audioToggle.style.backgroundColor = "var(--box-toggle)";

    getId("fullVideoModeBox").style.display = "block";
    getId("selectiveVideoModeBox").style.display = "none";
    getId("audioModeBox").style.display = "none";
});

// for "Selective Video" button
selectiveVideoToggle.addEventListener("click", () => {
    // Update button backgrounds
    fullVideoToggle.style.backgroundColor = "var(--box-toggle)";
    selectiveVideoToggle.style.backgroundColor = "var(--box-toggleOn)";
    audioToggle.style.backgroundColor = "var(--box-toggle)";

    getId("fullVideoModeBox").style.display = "none";
    getId("selectiveVideoModeBox").style.display = "block";
    getId("audioModeBox").style.display = "none";
});

// for"Full Audio" button
audioToggle.addEventListener("click", () => {
    // Update button backgrounds
    fullVideoToggle.style.backgroundColor = "var(--box-toggle)";
    selectiveVideoToggle.style.backgroundColor = "var(--box-toggle)";
    audioToggle.style.backgroundColor = "var(--box-toggleOn)";

    getId("fullVideoModeBox").style.display = "none";
    getId("selectiveVideoModeBox").style.display = "none";
    getId("audioModeBox").style.display = "block";
});

getId("closeHidden").addEventListener("click", () => {
    getId("options").style.display = "none";
    getId("playlistName").textContent = ""; 
    getId("list").innerHTML = ""; 
    getId("selectiveVideoListContainer").innerHTML = ""; 
    getId("incorrectMsg").textContent = ""; 
    getId("errorBtn").style.display = "none";
    getId("errorDetails").style.display = "none";
    getId("pasteLink").style.display = "inline-block"; 
    getId("openDownloads").style.display = "none"; 
});

// selective video logic starts here

/**
 * Downloads a single video with specified type (video/audio) and preferences.
 * @param {string} videoUrl The URL of the video to download.
 * @param {string} type 'video' or 'audio'.
 * @param {HTMLElement} statusDiv The div element to update with download status.
 */
async function downloadSingleVideo(videoUrl, type, statusDiv) {
    let configArg = "";
    let configTxt = "";
    if (localStorage.getItem("configPath")) {
        configArg = "--config-location";
        configTxt = `"${localStorage.getItem("configPath")}"`;
    }

    let subs = ""; // Default to no subtitles for individual downloads, controlled by advanced options.
    let subLangs = "";
    if (getId("subChecked") && getId("subChecked").checked) { // to check if the checkboxes are checked or not
        subs = "--write-subs";
        subLangs = "--sub-langs all";
        console.log("Downloading with subtitles");
    }

    let quality, format, videoType, audioQualityValue;

    // get video quality for selected videos 
    const selectedQuality = getId("selectSelectiveVideoQuality").value;

    if (type === "video") {
        quality = selectedQuality;
        // for selective, let's assume videoType is 'auto' or 'mp4'/'webm' if a preference is set.
        // for simplicity, directly using the quality for format string.
        videoType = localStorage.getItem("preferredVideoType") || "auto";
        
        if (quality === "best") {
            format = "-f bv*+ba/best";
        } else if (quality === "worst") {
            format = "-f wv+wa/worst";
        } else {
            if (videoType === "mp4") {
                format = `-f "bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}]/best" --merge-output-format "mp4" --recode-video "mp4"`;
            } else if (videoType === "webm") {
                format = `-f "bestvideo[height<=${quality}][ext=webm]+bestaudio[ext=webm]/best[height<=${quality}]/best" --merge-output-format "webm" --recode-video "webm"`;
            } else { // general highest quality as default
                format = `-f "bv*[height=${quality}]+ba/best[height=${quality}]/best[height<=${quality}]"`;
            }
        }
    } else { // if type === "audio" 
        format = localStorage.getItem("preferredAudioFormat") || "mp3";
        audioQualityValue = localStorage.getItem("preferredAudioQuality") || 'auto';
        
        if (
            (videoUrl.includes("youtube.com/") || videoUrl.includes("youtu.be/")) &&
            format === "m4a" &&
            audioQualityValue === "auto"
        ) {
            console.log("Downloading m4a without extracting");
            format = `ba[ext=${format}]/ba`;
            audioQualityValue = "";
        } else {
            console.log("Extracting audio as " + format);
        }
    }
    console.log(`Selective Video URL: ${videoUrl}, Type: ${type}, Quality: ${quality || audioQualityValue}`);

    const commonArgs = [
        videoUrl,
        "-o", path.join(downloadDir, "%(title)s.%(ext)s"), // use simple title for individual downloads
        "--ffmpeg-location", ffmpegPath.replace(/"/g, ''),
        cookieArg,
        browser,
        configArg,
        configTxt,
        "--embed-metadata",
        subs,
        subLangs,
        (type === "video" && videoType === "mp4" && (videoUrl.includes("youtube.com/") || videoUrl.includes("youtu.be/")) && os.platform() !== "darwin") ||
        (type === "audio" && (format === "mp3" || (format === "m4a" && (videoUrl.includes("youtube.com/") || videoUrl.includes("youtu.be/")) && os.platform() !== "darwin")))
            ? "--embed-thumbnail"
            : "",
        proxy ? "--no-check-certificate" : "",
        proxy ? "--proxy" : "",
        proxy,
        "--compat-options",
        "no-youtube-unavailable-videos",
    ].filter(Boolean);

    let args;
    if (type === "video") {
        args = [
            format,
            ...commonArgs
        ];
    } else { // type === "audio"
        if (audioQualityValue === "") {
            args = [
                "-f", format,
                ...commonArgs
            ];
        } else {
            args = [
                "-x",
                "--audio-format", format,
                "--audio-quality", audioQualityValue,
                ...commonArgs
            ];
        }
    }

    const controller = new AbortController();
    const downloadProcess = ytdlp.exec(
        args,
        { shell: true, detached: false },
        controller.signal
    );

    downloadProcess.on("ytDlpEvent", (_eventType, eventData) => {
        if (eventData.includes("download") || eventData.includes("postprocess")) {
            statusDiv.textContent = '📥 ' + eventData.replace(/\[download\] /, '').replace(/\[ExtractAudio\] /, '');
        }
    });

    downloadProcess.on("progress", (progress) => {
        if (progress.percent === 100) {
            statusDiv.textContent = '✅ Completed';
        } else if (progress.percent && progress.currentSpeed) {
            statusDiv.textContent = `⬇️ ${progress.percent.toFixed(1)}% | ${progress.currentSpeed}`;
        }
    });
}

// function to download selected videos from the playlist
async function selectiveVideosDownload() {
    const checkedBoxes = document.querySelectorAll('.playlistCheck:checked');
    const downloadBtn = getId("downloadSelectedBtn");

    if (checkedBoxes.length === 0) {
        alert("Select at least one video to download from the playlist.");
        return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = "Downloading...";

    // selective download will have download type as video + best audio 
    const downloadType = "video";

    for (const checkbox of checkedBoxes) {
        const itemDiv = checkbox.closest('.item');
        const videoUrl = itemDiv.querySelector('input[type="hidden"]').value;
        const statusDiv = itemDiv.querySelector('.status');

        checkbox.style.display = 'none';
        statusDiv.textContent = '📥 Starting...';
        statusDiv.style.display = 'block';

        try {
            await downloadSingleVideo(videoUrl, downloadType, statusDiv);
        } catch (error) {
            console.error(`Error during selective download of ${videoUrl}:`, error);
        }
    }

    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download Selected Videos";

    const notify = new Notification("ytDownloader", {
        body: i18n.__("Selected playlist videos downloaded"),
        icon: "../assets/images/icon.png",
    });

    notify.onclick = () => {
        shell.openPath(downloadDir);
    };
}


// utility functions (from playlist.js)

function downloadThumbnails() {
    let count = 0;
    let playlistName;
    // for thumbnails, we want to clear the selective list and show a generic progress list
    getId("selectiveVideoListContainer").innerHTML = "";
    getId("options").style.display = "none"; // hide options during download
    getId("list").innerHTML = ""; // clear existing progress list
    getId("playlistName").textContent = i18n.__("Processing") + "...";
    getId("pasteLink").style.display = "none";
    getId("openDownloads").style.display = "inline-block"; // show open downloads button immediately


    nameFormatting();
    managePlaylistRange();

    const args = [
        "--yes-playlist",
        "--no-warnings",
        "-o",
        `"${path.join(downloadDir, foldernameFormat, filenameFormat)}"`,
        cookieArg,
        browser,
        "--write-thumbnail",
        "--convert-thumbnails png",
        "--skip-download",
        "-I",
        `"${playlistIndex}:${playlistEnd}"`,
        "--ffmpeg-location",
        ffmpeg,
        proxy ? "--no-check-certificate" : "",
        proxy ? "--proxy" : "",
        proxy,
        "--compat-options",
        "no-youtube-unavailable-videos",
        `"${url}"`,
    ].filter(Boolean);

    const downloadProcess = ytdlp.exec(args, { shell: true, detached: false });

    downloadProcess.on("ytDlpEvent", (eventType, eventData) => {
        if (eventData.includes(playlistTxt)) {
            playlistName = eventData.split("playlist:")[1].slice(1);
            getId("playlistName").textContent =
                i18n.__("Downloading playlist:") + " " + playlistName;
        }

        if (
            (eventData.includes(videoIndex) ||
                eventData.includes(oldVideoIndex)) &&
            !eventData.includes("thumbnail")
        ) {
            count += 1;
            originalCount++;

            let itemTitle;
            itemTitle = i18n.__("Thumbnail") + " " + originalCount;

            if (count > 1) {
                getId(`p${count - 1}`).textContent = i18n.__("File saved.");
            }

            const item = `<div class="playlistItem">
            <p class="itemTitle">${itemTitle}</p>
            <p class="itemProgress" id="p${count}">${i18n.__("Downloading...")}</p>
            </div>`;
            getId("list").innerHTML += item;

            window.scrollTo(0, document.body.scrollHeight);
        }
    });

    downloadProcess.on("error", (error) => {
        showErrorTxt(error);
    });
    downloadProcess.on("close", () => {
        afterCloseFullPlaylist(count); // reuse this for thumbnails too
    });
}

function saveLinks() {
    let count = 0;
    let playlistName;
    getId("selectiveVideoListContainer").innerHTML = "";
    getId("options").style.display = "none";
    getId("list").innerHTML = "";
    getId("playlistName").textContent = i18n.__("Processing") + "...";
    getId("pasteLink").style.display = "none";
    getId("openDownloads").style.display = "inline-block"; // show open downloads button immediately


    nameFormatting();
    managePlaylistRange();

    const args = [
        "--yes-playlist",
        "--no-warnings",
        cookieArg,
        browser,
        "--skip-download",
        "--print-to-file",
        "webpage_url",
        `"${path.join(downloadDir, foldernameFormat, "links.txt")}"`,
        "-I",
        `"${playlistIndex}:${playlistEnd}"`,
        proxy ? "--no-check-certificate" : "",
        proxy ? "--proxy" : "",
        proxy,
        "--compat-options",
        "no-youtube-unavailable-videos",
        `"${url}"`,
    ].filter(Boolean);

    const downloadProcess = ytdlp.exec(args, { shell: true, detached: false });

    downloadProcess.on("ytDlpEvent", (eventType, eventData) => {
        if (eventData.includes(playlistTxt)) {
            playlistName = eventData.split("playlist:")[1].slice(1);
            getId("playlistName").textContent =
                i18n.__("Downloading playlist:") + " " + playlistName;
        }

        if (
            (eventData.includes(videoIndex) ||
                eventData.includes(oldVideoIndex)) &&
            !eventData.includes("thumbnail")
        ) {
            count += 1;
            let itemTitle;
            itemTitle = i18n.__("Link") + " " + count;

            if (count > 1) {
                getId(`p${count - 1}`).textContent = i18n.__("Link added");
            }

            const item = `<div class="playlistItem">
            <p class="itemTitle">${itemTitle}</p>
            <p class="itemProgress" id="p${count}">${i18n.__("Downloading...")}</p>
            </div>`;
            getId("list").innerHTML += item;

            window.scrollTo(0, document.body.scrollHeight);
        }
    });

    downloadProcess.on("close", () => {
        afterCloseFullPlaylist(count); // reuse this for links too
    });

    downloadProcess.on("error", (error) => {
        showErrorTxt(error);
    });
}


// event Listeners 
// download buttons for full playlist modes
getId("downloadFullVideo").addEventListener("click", () => {
    downloadFullPlaylist("video");
});

getId("downloadFullAudio").addEventListener("click", () => {
    downloadFullPlaylist("audio");
});

// Download button for selective video mode (already defined above)
getId("downloadSelectedBtn").addEventListener("click", selectiveVideosDownload);

// Downloading thumbnails and saving links
getId("downloadThumbnails").addEventListener("click", () => {
    downloadThumbnails();
});

getId("saveLinks").addEventListener("click", () => {
    saveLinks();
});

// Selecting download directory
getId("selectLocation").addEventListener("click", () => {
    ipcRenderer.send("select-location-main", "");
});

ipcRenderer.on("downloadPath", (event, newDownloadPath) => {
    console.log(newDownloadPath);
    if (newDownloadPath && newDownloadPath.length > 0) {
        getId("path").textContent = newDownloadPath[0];
        downloadDir = newDownloadPath[0];
        localStorage.setItem("downloadPath", downloadDir); // Save to local storage
    }
});


// More options toggle
let moreOptionsVisible = false;
getId("advancedToggle").addEventListener("click", () => {
    if (moreOptionsVisible) {
        getId("advancedMenu").style.display = "none";
        moreOptionsVisible = false;
    } else {
        getId("advancedMenu").style.display = "block";
        moreOptionsVisible = true;
    }
});

// for menu navigation
getId("openDownloads").addEventListener("click", () => {
    shell.openPath(downloadDir);
});

getId("preferenceWin").addEventListener("click", () => {
    closeMenu();
    ipcRenderer.send("load-page", __dirname + "/preferences.html");
});

getId("aboutWin").addEventListener("click", () => {
    closeMenu();
    ipcRenderer.send("load-page", __dirname + "/about.html");
});

getId("homeWin").addEventListener("click", () => {
    closeMenu();
    ipcRenderer.send("load-win", __dirname + "/index.html");
});

getId("compressorWin").addEventListener("click", () => {
    closeMenu();
    ipcRenderer.send("load-win", __dirname + "/compressor.html");
});

getId("closeHidden").addEventListener("click", () => {
    getId("options").style.display = "none";
    getId("playlistName").textContent = ""; // Clear playlist name
    getId("list").innerHTML = ""; // Clear full download progress
    getId("selectiveVideoListContainer").innerHTML = ""; // Clear selective list
    getId("incorrectMsg").textContent = ""; // Clear any messages
    getId("errorBtn").style.display = "none";
    getId("errorDetails").style.display = "none";
    getId("pasteLink").style.display = "inline-block"; // Show paste link button again
    getId("openDownloads").style.display = "none"; // Hide open downloads button
});

// translation

document.addEventListener("DOMContentLoaded", () => {
    // initial display of path
    getId("path").textContent = downloadDir;

    // apply saved preferred qualities to the new dropdowns
    if (localStorage.getItem("preferredVideoQuality")) {
        const preferredVideoQuality = localStorage.getItem("preferredVideoQuality");
        if (getId("selectFullVideoQuality")) getId("selectFullVideoQuality").value = preferredVideoQuality;
        if (getId("selectSelectiveVideoQuality")) getId("selectSelectiveVideoQuality").value = preferredVideoQuality;
    }
    if (localStorage.getItem("preferredAudioFormat")) { // note: this is for format, not quality value
        const preferredAudioFormat = localStorage.getItem("preferredAudioFormat");
        if (getId("selectFullAudioFormat")) getId("selectFullAudioFormat").value = preferredAudioFormat;
    }
    if (localStorage.getItem("preferredAudioQuality")) {
        const preferredAudioQuality = localStorage.getItem("preferredAudioQuality");
        if (getId("selectFullAudioQuality")) getId("selectFullAudioQuality").value = preferredAudioQuality;
    }

    // update visibility of video type select for full video
    function updateVideoTypeSelectVisibility() {
        const value = getId("selectFullVideoQuality").value;
        if (value === "best" || value === "worst" || value === "useConfig") {
            getId("typeSelectBoxFullVideo").style.display = "none";
        } else {
            getId("typeSelectBoxFullVideo").style.display = "block";
        }
    }
    if (getId("selectFullVideoQuality")) {
        getId("selectFullVideoQuality").addEventListener("change", updateVideoTypeSelectVisibility);
        updateVideoTypeSelectVisibility(); // Set initial state
    }

    // Apply translations
    getId("pasteLink").textContent = i18n.__("Click to paste playlist link from clipboard [Ctrl + V]");
    if (getId("playlistWin")) getId("playlistWin").textContent = i18n.__("Download Playlist"); // Assuming this is now the current file
    getId("preferenceWin").textContent = i18n.__("Preferences");
    getId("aboutWin").textContent = i18n.__("About");
    getId("homeWin").textContent = i18n.__("Homepage");
    getId("linkTitle").textContent = i18n.__("Link:");

    // Full Video mode
    getId("fullVideoToggle").textContent = i18n.__("Full Video");
    getId("videoFormat").textContent = i18n.__("Select Quality");
    getId("downloadFullVideo").textContent = i18n.__("Download Full Playlist");
    getId("bestVideoOption").textContent = i18n.__("Best");
    getId("worstVideoOption").textContent = i18n.__("Worst");
    getId("useConfigTxt").textContent = i18n.__("Use config file");
    getId("videoQualityTxt").textContent = i18n.__("Select Video Format ");
    getId("autoTxt").textContent = i18n.__("Auto");

    // Selective Video mode
    getId("selectiveVideoToggle").textContent = i18n.__("Selective Video");
    getId("selectiveVideoQualityLabel").textContent = i18n.__("Select Video Quality for Selected Items");
    getId("downloadSelectedBtn").textContent = i18n.__("Download Selected Videos");


    // Full Audio mode
    getId("audioToggle").textContent = i18n.__("Full Audio");
    getId("audioFormat").textContent = i18n.__("Select Audio format ");
    getId("downloadFullAudio").textContent = i18n.__("Download Full Audio Playlist");
    getId("audioQualitySelectTxt").textContent = i18n.__("Select Quality");
    getId("audioQualityAuto").textContent = i18n.__("Auto");
    getId("audioQualityNormal").textContent = i18n.__("Normal");
    getId("audioQualityBest").textContent = i18n.__("Best");
    getId("audioQualityGood").textContent = i18n.__("Good");
    getId("audioQualityBad").textContent = i18n.__("Bad");
    getId("audioQualityWorst").textContent = i18n.__("Worst");

    // Common elements
    getId("openDownloads").textContent = i18n.__("Open download folder");
    getId("advancedToggle").textContent = i18n.__("More options");
    getId("rangeTxt").textContent = i18n.__("Playlist range");
    getId("playlistIndex").placeholder = i18n.__("Start");
    getId("playlistEnd").placeholder = i18n.__("End");
    getId("downloadThumbnails").textContent = i18n.__("Download thumbnails");
    getId("saveLinks").textContent = i18n.__("Save video links to a file");
    getId("errorBtn").textContent = i18n.__("Error Details") + " ▼";
    getId("clText").textContent = i18n.__("Current download location - ");
    getId("selectLocation").textContent = i18n.__("Select Download Location");
    getId("themeTxt").textContent = i18n.__("Theme");

    getId("lightTxt").textContent = i18n.__("Light");
    getId("darkTxt").textContent = i18n.__("Dark");
    getId("frappeTxt").textContent = i18n.__("Frappé");
    getId("onedarkTxt").textContent = i18n.__("One Dark");
    getId("matrixTxt").textContent = i18n.__("Matrix");
    getId("githubTxt").textContent = i18n.__("Github");
    getId("latteTxt").textContent = i18n.__("Latte");
    getId("solarizedDarkTxt").textContent = i18n.__("Solarized Dark");

    getId("subHeader").textContent = i18n.__("Subtitles");
    getId("subTxt").textContent = i18n.__("Download subtitles if available");
});