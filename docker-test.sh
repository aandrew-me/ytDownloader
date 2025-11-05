#!/bin/sh
set -e

echo "Building Docker image..."
docker build -t ytdownloader:latest .

echo "Testing Docker image..."
# Test that the image was built successfully
if docker images ytdownloader:latest | grep -q ytdownloader; then
    echo "✓ Docker image built successfully"
else
    echo "✗ Docker image build failed"
    exit 1
fi

# Test basic functionality
echo "Testing basic container functionality..."
docker run --rm ytdownloader:latest node -e "console.log('Node.js working')" || {
    echo "✗ Node.js test failed"
    exit 1
}

echo "✓ Basic functionality test passed"

# Test ffmpeg
echo "Testing FFmpeg availability..."
docker run --rm ytdownloader:latest ffmpeg -version | grep -q "ffmpeg version" || {
    echo "✗ FFmpeg test failed"
    exit 1
}

echo "✓ FFmpeg test passed"

echo "All Docker tests passed successfully!"
echo "You can now run: docker-compose up -d"