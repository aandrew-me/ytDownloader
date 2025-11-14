#!/bin/bash

# >> Check if curl is installed or nor
if ! command -V curl > /dev/null 2>&1; then
    echo "curl not installed, please install it and try again"
    exit
fi

wget "https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffmpeg_linux_amd64.tar.xz"
wget "https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/deno_linux_amd64" -O deno
chmod +x deno
tar -xf ffmpeg_linux_amd64.tar.xz
mv ffmpeg_linux_amd64 ffmpeg
chmod +x ffmpeg/bin/ffmpeg
chmod +x ffmpeg/bin/ffprobe
chmod +x ffmpeg/bin/ffplay

