const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getFfprobeExecutable() {
  const isWin = os.platform() === 'win32';
  const binaryName = isWin ? 'ffprobe.exe' : 'ffprobe';

  if (process.env.YTDOWNLOADER_FFPROBE_PATH && fs.existsSync(process.env.YTDOWNLOADER_FFPROBE_PATH)) {
    return process.env.YTDOWNLOADER_FFPROBE_PATH;
  }

  const bundledPath = path.join(__dirname, '../../ffmpeg/bin', binaryName);
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  const homePath = path.join(os.homedir(), '.ytDownloader', 'ffmpeg', 'bin', binaryName);
  if (fs.existsSync(homePath)) {
    return homePath;
  }

  try {
    const cmd = isWin ? `where ${binaryName}` : `which ${binaryName}`;
    const stdout = execSync(cmd, { encoding: 'utf-8' }).trim();
    const firstLine = stdout.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
  } catch { }

  return binaryName;
}

function isFfprobeAvailable() {
  try {
    const ffprobePath = getFfprobeExecutable();
    execSync(`"${ffprobePath}" -version`, { encoding: 'utf-8', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getMediaInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const ffprobePath = getFfprobeExecutable();
  const command = `"${ffprobePath}" -v error -show_entries stream=width,height,codec_name,codec_type -show_entries format=format_name -of json "${filePath}"`;
  const stdout = execSync(command, { encoding: 'utf-8' });
  return JSON.parse(stdout);
}

function getVideoHeight(filePath) {
  const info = getMediaInfo(filePath);
  const videoStream = info.streams?.find(s => s.codec_type === 'video');
  return videoStream ? videoStream.height : null;
}

function getAudioCodec(filePath) {
  const info = getMediaInfo(filePath);
  const audioStream = info.streams?.find(s => s.codec_type === 'audio');
  return audioStream ? audioStream.codec_name : null;
}

module.exports = {
  getFfprobeExecutable,
  isFfprobeAvailable,
  getMediaInfo,
  getVideoHeight,
  getAudioCodec,
};
