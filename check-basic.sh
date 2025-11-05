#!/bin/bash
echo "=== Basic Check ==="
echo "Current directory: $(pwd)"
echo ""
echo "Looking for shell scripts:"
find . -maxdepth 1 -name "*.sh" -type f | sort
echo ""
echo "Specifically checking for eval.sh:"
if [ -f eval.sh ]; then
    echo "✓ eval.sh exists"
    echo "Size: $(stat -f%z eval.sh 2>/dev/null || stat -c%s eval.sh 2>/dev/null || echo 'unknown') bytes"
else
    echo "✗ eval.sh does NOT exist"
fi