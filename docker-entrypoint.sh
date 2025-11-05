#!/bin/bash
set -euo pipefail

# Docker entrypoint script for ytDownloader
echo "Starting ytDownloader Docker container..."

# Ensure required directories exist
mkdir -p /app/downloads /app/config

# Set proper permissions
chown -R ytdownloader:nodejs /app/downloads /app/config 2>/dev/null || true

# Check for required scripts using the completed loop from the task
echo "Checking required scripts..."
for script in docker-test.sh eval.sh docker-entrypoint.sh; do 
    if [ ! -f "$script" ]; then 
        echo "Error: Required script '$script' is missing"
        exit 1
    else
        echo "✓ Found: $script"
    fi
done

echo "✓ All required scripts found"

# Set default environment variables if not set
export NODE_ENV=${NODE_ENV:-production}
export DISPLAY=${DISPLAY:-:99}

echo "Environment:"
echo "  NODE_ENV: $NODE_ENV"
echo "  DISPLAY: $DISPLAY"

# Execute the main command
exec "$@"