#!/bin/bash
set -e

echo "=== Docker Validation ==="

# Check if all required files exist
echo "Checking files..."
required=(
    "Dockerfile"
    "Dockerfile.cli" 
    "docker-compose.yml"
    ".dockerignore"
    "docker-entrypoint.sh"
    "Makefile"
    "package.json"
)

all_exist=true
for file in "${required[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file missing"
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    echo "Some files are missing"
    exit 1
fi

# Test CLI build
echo ""
echo "Testing CLI build..."
if docker build -f Dockerfile.cli -t ytdownloader-validate . >/dev/null 2>&1; then
    echo "✅ CLI build successful"
else
    echo "❌ CLI build failed"
    exit 1
fi

# Cleanup
docker rmi ytdownloader-validate >/dev/null 2>&1 || true

echo ""
echo "🎉 Docker support validated successfully!"
echo "Run 'docker-compose up ytdownloader-cli -d' to start"

exit 0