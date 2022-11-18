#!/bin/bash
# Script to download the latest x64 windows version of custom ffmpeg build for yt-dlp
# The binary will be placed in the root dir of the app

rm ffmpeg*
wget "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-n5.1-latest-win64-gpl-5.1.zip"
unzip ffmpeg-n5.1-latest-win64-gpl-5.1.zip
cp ffmpeg-n5.1-latest-win64-gpl-5.1/bin/ffmpeg.exe ffmpeg.exe
chmod +x ffmpeg.exe
rm -rf ffmpeg-n5.1-latest-win64-gpl-5.1
rm ffmpeg-n5.1-latest-win64-gpl-5.1.zip