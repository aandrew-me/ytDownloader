#!/bin/bash
# Script to download the latest x64 linux version of custom ffmpeg build for yt-dlp
# The binary will be placed in the root dir of the app

rm ffmpeg.exe
wget "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-n5.1-latest-linux64-gpl-5.1.tar.xz"
tar xvf ffmpeg-n5.1-latest-linux64-gpl-5.1.tar.xz
cp ffmpeg-n5.1-latest-linux64-gpl-5.1/bin/ffmpeg ffmpeg
chmod 777 ffmpeg
rm -rf ffmpeg-n5.1-latest-linux64-gpl-5.1
rm ffmpeg-n5.1-latest-linux64-gpl-5.1.tar.xz