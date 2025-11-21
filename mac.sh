#!/bin/bash
# >> Check if curl is installed or nor
if ! command -v curl > /dev/null 2>&1; then
    echo "curl not installed, please install it and try again"
    exit 1
fi

ARCH=$(uname -m)
mkdir -p ffmpeg/bin

if [ "$ARCH" = "arm64" ]; then
    FF_URL="https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffmpeg_macos_arm64"
    FP_URL="https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffprobe_macos_arm64"
elif [ "$ARCH" = "x86_64" ]; then
    FF_URL="https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffmpeg_macos_amd64"
    FP_URL="https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffprobe_macos_amd64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

curl -L "$FF_URL" -o ffmpeg/bin/ffmpeg
curl -L "$FP_URL" -o ffmpeg/bin/ffprobe
chmod +x ffmpeg/bin/ffmpeg
chmod +x ffmpeg/bin/ffprobe
