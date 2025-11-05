#!/bin/bash

echo "=== Docker Build Debug ==="
echo "Building CLI version first..."
docker build -f Dockerfile.cli -t ytdownloader-cli . || {
    echo "CLI build failed. Showing output:"
    docker build -f Dockerfile.cli -t ytdownloader-cli . 2>&1 || true
}

echo ""
echo "Testing CLI version..."
docker run --rm ytdownloader-cli || true

echo ""
echo "Now testing main Dockerfile..."
docker build -t ytdownloader . || {
    echo "Main build failed. Showing output:"
    docker build -t ytdownloader . 2>&1 || true
}