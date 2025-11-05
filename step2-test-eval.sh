#!/bin/bash
echo "=== Step 2: Testing eval.sh ==="
echo ""

if [ ! -f eval.sh ]; then
    echo "ERROR: eval.sh does not exist!"
    exit 1
fi

echo "eval.sh contents:"
head -20 eval.sh
echo ""
echo "Running eval.sh:"
bash eval.sh
exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "✓ eval.sh works correctly!"
else
    echo "✗ eval.sh failed with exit code $exit_code"
fi

exit $exit_code