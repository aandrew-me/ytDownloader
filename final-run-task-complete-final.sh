#!/bin/bash
bash run-task-complete-final.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "✅ FINAL STATUS: TASK COMPLETED!"
else
    echo "❌ FINAL STATUS: TASK FAILED!"
fi
exit $result