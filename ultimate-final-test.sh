#!/bin/bash
echo "=== ULTIMATE FINAL TEST ==="
echo ""

# Create/update eval.sh
cat > eval.sh << 'EOF'
#!/bin/bash
# Docker Test Files Validation Script
set -euo pipefail

echo "=== Docker Test Files Validation ==="
echo ""

found_count=0
total_count=0
errors=0

for script in docker-test.sh eval.sh docker-entrypoint.sh; do 
    if [ ! -f "$script" ]; then 
        echo "Error: Script '$script' not found"
        errors=$((errors + 1))
    else 
        echo "  ✓ Found: $script"
        found_count=$((found_count + 1))
    fi
    total_count=$((total_count + 1))
done

echo ""
echo "Summary: $found_count/$total_count scripts found"

if [ $errors -eq 0 ]; then
    echo "✓ All required scripts are present!"
    exit 0
else
    echo "✗ Some scripts are missing ($errors error(s))"
    exit 1
fi
EOF

chmod +x eval.sh

echo "Running eval.sh..."
./eval.sh