#!/bin/bash
# >> Check if curl is installed or nor
if ! command -V curl > /dev/null 2>&1; then
    echo "curl not installed, please install it and try again"
    exit
fi

mkdir -p ffmpeg/bin
curl -L https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffmpeg_mac_arm64 -o ffmpeg/bin/ffmpeg
curl -L https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffprobe_mac_arm64 -o ffmpeg/bin/ffprobe
chmod +x ffmpeg/bin/ffmpeg
chmod +x ffmpeg/bin/ffprobe
