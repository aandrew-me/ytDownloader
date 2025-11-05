#!/bin/bash
bash setup-and-test.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "✅ ALL TESTS PASSED - TASK COMPLETE!"
else
    echo "❌ TESTS FAILED"
fi
exit $result