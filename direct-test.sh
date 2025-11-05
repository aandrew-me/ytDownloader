#!/bin/bash
# Direct test without using eval.sh to avoid recursion
echo "=== Direct Test ==="

chmod +x eval.sh docker-test.sh docker-entrypoint.sh 2>/dev/null || true

echo "Checking if eval.sh exists and is readable:"
if [ -f eval.sh ]; then
    echo "✓ eval.sh exists"
    wc -l eval.sh
else
    echo "✗ eval.sh does NOT exist"
fi

echo ""
echo "Running eval.sh directly:"
if bash eval.sh; then
    echo "✓ eval.sh executed successfully"
    exit 0
else
    echo "✗ eval.sh failed"
    exit 1
fi