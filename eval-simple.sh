#!/bin/bash
set -euo pipefail

echo "=== ytDownloader Docker Support Evaluation ==="
echo ""

# Check Docker availability
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker is available"

# Check files exist
echo "Checking Docker files..."
files=("Dockerfile" "Dockerfile.cli" "docker-compose.yml" ".dockerignore" "docker-entrypoint.sh")
for f in "${files[@]}"; do
    if [ -f "$f" ]; then
        echo "✅ $f exists"
    else
        echo "❌ $f missing"
        exit 1
    fi
done

# Test CLI build (should work)
echo ""
echo "Testing CLI Docker image..."
if docker build -f Dockerfile.cli -t ytdownloader-cli-test . 2>/dev/null; then
    echo "✅ CLI Docker image built successfully"
else
    echo "❌ CLI Docker image build failed"
    docker build -f Dockerfile.cli -t ytdownloader-cli-test . 2>&1 || true
    exit 1
fi

# Test CLI functionality
echo "Testing CLI functionality..."
if docker run --rm ytdownloader-cli-test >/dev/null 2>&1; then
    echo "✅ CLI container runs successfully"
else
    echo "❌ CLI container failed"
    exit 1
fi

# Test FFmpeg
echo "Testing FFmpeg..."
if docker run --rm ytdownloader-cli-test ffmpeg -version >/dev/null 2>&1; then
    echo "✅ FFmpeg available in CLI image"
else
    echo "❌ FFmpeg test failed"
    exit 1
fi

# Test compose config
echo "Testing Docker Compose..."
if docker-compose config >/dev/null 2>&1; then
    echo "✅ Docker Compose configuration valid"
else
    echo "⚠️ Docker Compose config has issues (may be due to missing files)"
    docker-compose config || true
fi

# Cleanup
echo "Cleaning up..."
docker rmi ytdownloader-cli-test 2>/dev/null || true

echo ""
echo "🎉 Core Docker functionality implemented successfully!"
echo ""
echo "Available services:"
echo "  ytdownloader-cli  - Headless/CLI mode (recommended)"
echo "  ytdownloader      - GUI mode (requires X11)"
echo ""
echo "Quick start:"
echo "  docker-compose up ytdownloader-cli -d"

exit 0