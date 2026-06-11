#!/bin/bash

# >> Check if curl is installed or nor
if ! command -V curl > /dev/null 2>&1; then
    echo "curl not installed, please install it and try again"
    exit
fi

wget "https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffmpeg_linux_amd64.tar.xz"
tar -xf ffmpeg_linux_amd64.tar.xz
mv ffmpeg_linux_amd64 ffmpeg
chmod +x ffmpeg/bin/ffmpeg
chmod +x ffmpeg/bin/ffprobe
chmod +x ffmpeg/bin/ffplay

# yt-dlp's EJS requires Node.js >= 22 for the JavaScript challenge solver
# (yt_dlp/.../jsc/_builtin/node.py: MIN_SUPPORTED_VERSION = (22, 0, 0)).
# Older bundled node is reported as "(unsupported)" and YouTube nsig
# descrambling silently degrades. Bundle an official Node 22 LTS binary.
NODE_VERSION="v22.22.3"
wget "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz" -O node.tar.xz
tar -xf node.tar.xz
mv "node-${NODE_VERSION}-linux-x64/bin/node" node
chmod +x node
rm -rf "node-${NODE_VERSION}-linux-x64" node.tar.xz

