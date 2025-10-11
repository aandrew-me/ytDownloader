// old playlist_new.js with some changes
const { clipboard, shell, ipcRenderer } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-plus");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync, exec, spawnSync } = require("child_process");


let url = "";

const ytDlpExecutablePath = localStorage.getItem("ytdlp");
const ytdlp = new YTDlpWrap(ytDlpExecutablePath);
const downloadsDir = path.join(os.homedir(), "Downloads");
let downloadDir = localStorage.getItem("downloadPath") || downloadsDir;

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

const i18n = new (require("../translations/i18n"))();

let cookieArg = "";
let browser = "";
const formats = {
    144: 160,
    240: 133,
    360: 134,
    480: 135,
    720: 136,
    1080: 137,
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
ffmpeg = `"${ffmpegPath}"`;
console.log("ffmpeg:", ffmpeg);

// let foldernameFormat = "%(playlist_title)s";
// let filenameFormat = "%(playlist_index)s.%(title)s.%(ext)s";
// let playlistIndex = 1;
// let playlistEnd = "";
let proxy = localStorage.getItem("proxy") || "";

// const playlistTxt = "Downloading playlist: ";
// const videoIndex = "Downloading item ";
// const oldVideoIndex = "Downloading video ";


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

function showErrorTxt(error, currentUrl = url) {
    console.log("Error " + error);
    getId("pasteLink").style.display = "inline-block";
    getId("options").style.display = "block";
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
    getId("selectiveVideoListContainer").innerHTML = "";
}

// function nameFormatting() {
//     if (localStorage.getItem("foldernameFormat")) {
//         foldernameFormat = localStorage.getItem("foldernameFormat");
//     }
//     if (localStorage.getItem("filenameFormat")) {
//         filenameFormat = localStorage.getItem("filenameFormat");
//     } else {
//         filenameFormat = "%(playlist_index)s.%(title)s.%(ext)s";
//     }
// }

// function managePlaylistRange() {
//     if (getId("playlistIndex").value) {
//         playlistIndex = Number(getId("playlistIndex").value);
//     } else {
//         playlistIndex = 1;
//     }
//     if (getId("playlistEnd").value) {
//         playlistEnd = getId("playlistEnd").value;
//     } else {
//         playlistEnd = "";
//     }
//     console.log(`Range for utility function: ${playlistIndex}:${playlistEnd}`);
// }


// function openFolder(location) {
//     shell.openPath(location);
// }

function pasteLink() {
    const clipboardText = clipboard.readText().trim();
    url = clipboardText;

    getId("selectiveVideoListContainer").innerHTML = "";
    getId("incorrectMsg").textContent = "";
    getId("errorBtn").style.display = "none";
    getId("errorDetails").style.display = "none";
    getId("errorDetails").textContent = "";
    getId("options").style.display = "none";

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
    getId("link").textContent = " " + clipboardText;

    exec(
        `${ytDlpExecutablePath} --yes-playlist --no-warnings -J --flat-playlist "${clipboardText}"`,
        (error, stdout, stderr) => {
            getId("loadingWrapper").style.display = "none";
            if (error) {
                showErrorTxt(error, clipboardText);
                getId("options").style.display = "none";
            } else {
                const parsed = JSON.parse(stdout);
                console.log(parsed);
                getId("options").style.display = "block";
                
                let items = "";
                if (parsed.entries && parsed.entries.length > 0) {
                    getId("selectiveVideoListContainer").innerHTML = "";
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
                    getId("incorrectMsg").textContent = "";
                } else {
                    getId("incorrectMsg").textContent = i18n.__("No videos found in this playlist or URL is incompatible.");
                    getId("options").style.display = "none";
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

// function for the selective video download //

async function selectiveVideoDownload(videoUrl, type, statusDiv) {
    let configArg = "";
    let configTxt = "";
    if (localStorage.getItem("configPath")) {
        configArg = "--config-location";
        configTxt = `"${localStorage.getItem("configPath")}"`;
    }

    let subs = "";
    let subLangs = "";
    if (getId("subChecked") && getId("subChecked").checked) {
        subs = "--write-subs";
        subLangs = "--sub-langs all";
        console.log("Downloading with subtitles");
    }

    let quality, format, videoType;

    if (type === "video") {
        quality = getId("selectSelectiveVideoQuality").value; // selecting video quality
        videoType = getId("videoTypeSelect").value; // selecting video format
        
        if (quality === "best") {
            format = "-f bv*+ba/best"; 
        } else if (quality === "worst") {
            format = "-f wv*+wa/worst"; 
        } else {
            if (videoType === "mp4") {
                format = `-f "bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}]/best" --merge-output-format "mp4" --recode-video "mp4"`;
            } else if (videoType === "webm") {
                format = `-f "bestvideo[height<=${quality}][ext=webm]+bestaudio[ext=webm]/best[height<=${quality}]/best" --merge-output-format "webm" --recode-video "webm"`;
            } else { 
                format = `-f "bv*[height=${quality}]+ba/best[height=${quality}]/best[height<=${quality}]"`;
            }
        }
    } else { 

        let audioFormat = localStorage.getItem("preferredAudioFormat") || "mp3";
        let audioQualityValue = localStorage.getItem("preferredAudioQuality") || 'auto';
        
        if (
            (videoUrl.includes("youtube.com/") || videoUrl.includes("youtu.be/")) &&
            audioFormat === "m4a" &&
            audioQualityValue === "auto"
        ) {
            console.log("Downloading m4a without extracting");
            format = `ba[ext=${audioFormat}]/ba`;
            audioQualityValue = "";
        } else {
            console.log("Extracting audio as " + audioFormat);
            format = audioFormat;
        }
    }

    const commonArgs = [
        "-o", path.join(downloadDir, "%(title)s.%(ext)s"), 
        "--ffmpeg-location", ffmpegPath.replace(/"/g, ''),
        cookieArg,
        browser,
        configArg,
        configTxt,
        "--embed-metadata",
        subs,
        subLangs,
        (type === "video" && videoType === "mp4" && (videoUrl.includes("youtube.com/") || videoUrl.includes("youtu.be/")) && os.platform() !== "darwin")
        ,
        proxy ? "--no-check-certificate" : "",
        proxy ? "--proxy" : "",
        proxy,
        "--compat-options",
        "no-youtube-unavailable-videos",
        "--force-overwrites" // downloads the video even if it's already present in the directory
    ].filter(Boolean);

    let args = [ videoUrl, format, ...commonArgs ];

    console.log(`Executing yt-dlp command for ${videoUrl} with args:`, args.join(' '));

    const controller = new AbortController();
    const downloadProcess = ytdlp.exec(
        args,
        { shell: true, detached: false },
        controller.signal
    );

    downloadProcess.on("progress", (progress) => {
        if (progress.percent === 100) {
            statusDiv.textContent = 'File saved';
        } else if (progress.percent && progress.currentSpeed) {
            statusDiv.textContent = ` ${progress.percent.toFixed(1)}% | ${progress.currentSpeed || 'N/A'}`;
        }
    });

    downloadProcess.on("error", (error) => {
        console.error(`A process error occurred for ${videoUrl}:`, error);
    });

}

async function videosSelection() {
    const checkedBoxes = document.querySelectorAll('.playlistCheck:checked');

    if (checkedBoxes.length === 0) {
        alert("Select at least one video to download from the playlist.");
        return;
    }

    const downloadType = "video"; 

    for (const checkbox of checkedBoxes) {
        const itemDiv = checkbox.closest('.item');
        const videoUrl = itemDiv.querySelector('input[type="hidden"]').value;
        const statusDiv = itemDiv.querySelector('.status');

        checkbox.style.display = 'none';
        statusDiv.textContent = 'Downloading...';
        statusDiv.style.display = 'block';

        try {
            await selectiveVideoDownload(videoUrl, downloadType, statusDiv);
            checkbox.checked = false; // after the download uncheck the video 
            itemDiv.style.opacity = '0.7'; // dim the div to indicate it's already downloaded
        } catch (error) {
            console.error(`Error during selective download of ${videoUrl}:`, error);
        }
    }
}

getId("downloadSelectedBtn").addEventListener("click", videosSelection);

// selecting download location
getId("selectLocation").addEventListener("click", () => {
    ipcRenderer.send("select-location-main", "");
});

ipcRenderer.on("downloadPath", (event, newDownloadPath) => {
    console.log(newDownloadPath);
    if (newDownloadPath && newDownloadPath.length > 0) {
        getId("path").textContent = newDownloadPath[0];
        downloadDir = newDownloadPath[0];
        localStorage.setItem("downloadPath", downloadDir);
    }
});

// more options
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

// menu
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
getId("playlistWin").addEventListener("click", () => {
    closeMenu();
    ipcRenderer.send("load-win", __dirname + "/playlist.html");
});

// translations

getId("closeHidden").addEventListener("click", () => {
    getId("options").style.display = "none";
    getId("list").style.display = "none";
    getId("selectiveVideoListContainer").innerHTML = "";
    getId("incorrectMsg").textContent = "";
    getId("errorBtn").style.display = "none";
    getId("errorDetails").style.display = "none";
    getId("pasteLink").style.display = "inline-block";
});


document.addEventListener("DOMContentLoaded", () => {
    getId("path").textContent = downloadDir;
    if (localStorage.getItem("preferredVideoQuality")) {
        const preferredVideoQuality = localStorage.getItem("preferredVideoQuality");
        if (getId("selectSelectiveVideoQuality")) getId("selectSelectiveVideoQuality").value = preferredVideoQuality;
    }
    getId("pasteLink").textContent = i18n.__("Click to paste playlist link from clipboard [Ctrl + V]");
    getId("preferenceWin").textContent = i18n.__("Preferences");
    getId("aboutWin").textContent = i18n.__("About");
    getId("homeWin").textContent = i18n.__("Homepage");
    getId("linkTitle").textContent = i18n.__("Link:");
    getId("selectiveVideoQualityLabel").textContent = i18n.__("Select Video Quality");
    getId("videoFormat").textContent = i18n.__("Select Video Format");
    getId("downloadSelectedBtn").textContent = i18n.__("Download Selected Videos");
//     getId("openDownloads").textContent = i18n.__("Open download folder");
    getId("advancedToggle").textContent = i18n.__("More options");
//     getId("rangeTxt").textContent = i18n.__("Playlist range");
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
