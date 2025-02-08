const os = require("os")
const cp = require("child_process")
const popups = require("./popups")

function getFfmpegPath() {
    let ffmpeg = ""
    if (os.platform() === "win32") {
        ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
    } else if (os.platform() === "freebsd") {
        try {
            ffmpeg = cp.execSync("which ffmpeg").toString("utf8").split("\n")[0].trim();
        } catch (error) {
            console.log(error)
            popups.showPopup("No ffmpeg found in PATH.");
        }
    }
     else {
        ffmpeg = `"${__dirname}/../ffmpeg"`;
    }

    return ffmpeg;
}

module.exports = getFfmpegPath