#!/bin/bash
set -e

echo "=== Simple Docker Test ==="

# Test if we can build the simple CLI version
echo "Building CLI version..."
docker build -f Dockerfile.cli -t ytdownloader-simple . 

echo "Testing CLI version..."
docker run --rm ytdownloader-simple

echo "Testing FFmpeg..."
docker run --rm ytdownloader-simple ffmpeg -version | head -1

echo "✅ Basic Docker functionality works!"