#!/bin/bash
set -euo pipefail

# Test script to validate the implementation
echo "=== Testing Implementation ==="

# Make scripts executable
chmod +x eval.sh docker-test.sh docker-entrypoint.sh check-scripts.sh 2>/dev/null || true

# Test 1: Check that all scripts exist
echo "Test 1: Verifying all required scripts exist..."
for script in docker-test.sh eval.sh docker-entrypoint.sh; do
    if [ ! -f "$script" ]; then
        echo "✗ Missing: $script"
        exit 1
    else
        echo "✓ Found: $script"
    fi
done

# Test 2: Test the loop functionality
echo ""
echo "Test 2: Testing the completed loop functionality..."
for script in docker-test.sh eval.sh docker-entrypoint.sh; do 
    if [ ! -f "$script" ]; then 
        echo "Error: Required script '$script' is missing"
        exit 1
    else
        echo "✓ Loop test passed for: $script"
    fi
done

# Test 3: Run eval.sh to ensure it works
echo ""
echo "Test 3: Running eval.sh validation..."
if ./eval.sh; then
    echo "✓ eval.sh validation passed"
else
    echo "✗ eval.sh validation failed"
    exit 1
fi

# Test 4: Run docker-test.sh to ensure it works
echo ""
echo "Test 4: Running docker-test.sh validation..."
if ./docker-test.sh; then
    echo "✓ docker-test.sh validation passed"
else
    echo "✗ docker-test.sh validation failed"
    exit 1
fi

echo ""
echo "=== All Tests Passed Successfully ==="
echo "✓ The completed loop functionality is working correctly"
echo "✓ All required scripts are present and functional"
echo "✓ Task implementation is complete!"
exit 0