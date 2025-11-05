#!/bin/bash
echo "=== Creating docker-test.sh ==="

cat > docker-test.sh << 'EOF'
#!/bin/bash
set -euo pipefail

echo "=== ytDownloader Docker Test ==="
echo ""

echo "Test 1: Checking required files..."
for script in docker-test.sh eval.sh docker-entrypoint.sh; do 
    if [ ! -f "$script" ]; then 
        echo "Error: Required script '$script' is missing"
        exit 1
    else
        echo "✓ Found: $script"
    fi
done

echo ""
echo "Test 2: Running validation..."
if bash eval.sh; then
    echo "✓ Validation passed"
else
    echo "✗ Validation failed"
    exit 1
fi

echo ""
echo "=== All Tests Passed ==="
exit 0
EOF

chmod +x docker-test.sh
echo "✓ docker-test.sh created"
ls -la docker-test.sh
EOF
chmod +x create-docker-test.sh
bash create-docker-test.sh