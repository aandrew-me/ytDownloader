#!/bin/bash
# Script to download the latest x64 windows version of custom ffmpeg build for yt-dlp
# The binary will be placed in the root dir of the app


wget "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-n5.1-latest-win64-gpl-5.1.zip"
tar xvf ffmpeg-n5.1-latest-linux64-gpl-5.1.tar.xz
cp ffmpeg-n5.1-latest-linux64-gpl-5.1/bin/ffmpeg ffmpeg.exe
chmod 777 ffmpeg.exe
rm -rf ffmpeg-n5.1-latest-linux64-gpl-5.1
rm ffmpeg-n5.1-latest-linux64-gpl-5.1.tar.xz