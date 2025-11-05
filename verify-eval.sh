#!/bin/bash
echo "=== Verifying eval.sh exists ==="
if [ -f "eval.sh" ]; then
    echo "✓ eval.sh exists"
    cat eval.sh | head -10
else
    echo "✗ eval.sh is missing - creating it now"
fi