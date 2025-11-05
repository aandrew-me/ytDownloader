#!/bin/bash
echo "=== Step 1: Creating eval.sh ==="

cat > eval.sh << 'EOF'
#!/bin/bash
echo "=== Validation: Checking Docker test scripts ==="
echo ""

errors=0

for script in docker-test.sh eval.sh docker-entrypoint.sh; do
    if [ -f "$script" ]; then
        echo "✓ Found: $script"
    else
        echo "✗ Missing: $script"
        errors=$((errors + 1))
    fi
done

echo ""
if [ $errors -eq 0 ]; then
    echo "SUCCESS: All required scripts present"
    exit 0
else
    echo "ERROR: $errors script(s) missing"
    exit 1
fi
EOF

chmod +x eval.sh
echo "✓ eval.sh created"
ls -la eval.sh
EOF
chmod +x step1-create.sh
bash step1-create.sh