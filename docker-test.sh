#!/bin/bash
set -euo pipefail

# Docker test script for ytDownloader
echo "=== ytDownloader Docker Test ==="

# Test 1: Check if required files exist using the completed loop from the task
echo "Test 1: Checking required files..."
for script in docker-test.sh eval.sh docker-entrypoint.sh; do 
    if [ ! -f "$script" ]; then 
        echo "Error: Required script '$script' is missing"
        exit 1
    else
        echo "✓ Found: $script"
    fi
done

echo "✓ All required scripts found"

# Test 2: Check if eval.sh is executable
echo "Test 2: Checking eval.sh permissions..."
if [ -x "eval.sh" ]; then
    echo "✓ eval.sh is executable"
else
    echo "Warning: eval.sh is not executable, making it executable..."
    chmod +x eval.sh
fi

# Test 3: Run eval.sh to verify functionality
echo "Test 3: Running eval.sh..."
if ./eval.sh; then
    echo "✓ eval.sh executed successfully"
else
    echo "Error: eval.sh failed to execute"
    exit 1
fi

# Test 4: Check Docker configuration files
echo "Test 4: Checking Docker configuration..."
required_docker_files=("Dockerfile" "docker-compose.yml")
for file in "${required_docker_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "Warning: Docker file '$file' is missing"
    else
        echo "✓ Found: $file"
    fi
done

echo ""
echo "=== All Tests Passed ==="
exit 0