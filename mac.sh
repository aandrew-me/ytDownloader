#!/bin/bash
# Script to download the latest x64 mac version of ffmpeg
# The binary will be placed in the root dir of the app
rm ffmpeg*
curl https://evermeet.cx/ffmpeg/ffmpeg-6.0.zip -o ffmpeg.zip
unzip ffmpeg.zip
chmod +x ffmpeg
rm ffmpeg.zip

