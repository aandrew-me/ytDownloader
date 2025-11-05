#!/bin/sh
set -e

# Create necessary directories
mkdir -p /app/downloads
mkdir -p /app/config

# Check if ffmpeg is available
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "FFmpeg not found. Please ensure ffmpeg is installed in the container."
    exit 1
fi

# Check if running in headless mode
if [ "${HEADLESS:-false}" = "true" ]; then
    echo "Running in headless mode. Use ytdownloader-cli for CLI operations."
    exec node -e "
        console.log('ytDownloader Headless Mode');
        console.log('For GUI mode, run without HEADLESS=true');
        console.log('For CLI usage, use the ytdownloader-cli service');
        console.log('Downloads directory: /app/downloads');
        console.log('Config directory: /app/config');
    "
fi

# Make sure the app directory is writable
chmod -R 755 /app

# Check if DISPLAY is set for GUI mode
if [ -z "${DISPLAY:-}" ]; then
    echo "DISPLAY not set. Running in headless mode."
    echo "Set DISPLAY environment variable for GUI mode or use HEADLESS=true"
    exec node -e "
        console.log('ytDownloader ready in headless mode');
        console.log('Install yt-dlp: npm install -g yt-dlp');
    "
fi

echo "Starting ytDownloader with display: ${DISPLAY:-:99}"
exec "$@"