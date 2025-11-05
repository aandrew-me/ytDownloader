#!/bin/bash
bash run-final-task-execute.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "✅ FINAL TASK STATUS: COMPLETED!"
else
    echo "❌ FINAL TASK STATUS: FAILED!"
fi
exit $result