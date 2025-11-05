#!/bin/bash
# This script demonstrates the completed loop from the task
set -euo pipefail

echo "=== Checking for required Docker test scripts ==="

# This is the completed loop from the original task
for script in docker-test.sh eval.sh docker-entrypoint.sh; do 
    if [ ! -f "$script" ]; then 
        echo "Error: Required script '$script' is missing"
        exit 1
    else
        echo "✓ Found: $script"
    fi
done

echo "All required scripts are present!"