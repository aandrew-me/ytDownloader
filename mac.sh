#!/bin/bash
# Script to download the latest x64 mac version of ffmpeg
# The binary will be placed in the root dir of the app
rm ffmpeg
rm ffmpeg.exe
wget https://evermeet.cx/ffmpeg/ffmpeg-5.1.1.7z
7z e ffmpeg-5.1.1.7z
chmod 777 ffmpeg
rm ffmpeg-5.1.1.7z

