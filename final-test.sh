#!/bin/bash

echo "Setting up and testing Docker support..."
echo ""

# Make scripts executable
chmod +x *.sh 2>/dev/null || true

echo "Running final validation..."
./docker-test-final.sh