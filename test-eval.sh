#!/bin/bash
echo "=== FINAL EVAL.SH TEST ==="
echo ""
chmod +x eval.sh
bash eval.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "✅ eval.sh executed successfully!"
    echo "✅ Task is complete!"
    exit 0
else
    echo "❌ eval.sh failed!"
    exit 1
fi