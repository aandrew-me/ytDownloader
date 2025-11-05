#!/bin/bash
chmod +x eval.sh
bash comprehensive-test.sh
result=$?
echo ""
echo "Exit code: $result"
if [ $result -eq 0 ]; then
    echo "✅ SUCCESS - TASK COMPLETED!"
else
    echo "❌ FAILED - TASK INCOMPLETE!"
fi
exit $result