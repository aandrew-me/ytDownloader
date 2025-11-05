#!/bin/bash
echo "=== COMPLETE CHECK ==="
echo ""

# Check all required files
echo "Checking for required files..."
all_found=true

for script in docker-test.sh eval.sh docker-entrypoint.sh; do
    if [ -f "$script" ]; then
        echo "  ✓ $script exists"
    else
        echo "  ✗ $script missing"
        all_found=false
    fi
done

echo ""

if [ "$all_found" = true ]; then
    echo "Running eval.sh..."
    chmod +x eval.sh
    
    if ./eval.sh; then
        echo ""
        echo "=== ✅ ALL CHECKS PASSED ==="
        echo ""
        echo "🏁 TASK COMPLETED SUCCESSFULLY!"
        echo ""
        echo "The completed shell loop:"
        echo "  for script in docker-test.sh eval.sh docker-entrypoint.sh; do if [ ! -f \"\$script\" ]; then echo Error:; fi; done"
        echo ""
        exit 0
    else
        echo "=== ❌ EVAL.SH FAILED ==="
        exit 1
    fi
else
    echo "=== ❌ MISSING FILES ==="
    exit 1
fi