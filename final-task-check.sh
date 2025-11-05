#!/bin/bash
bash run-task-complete-check.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🏆 FINAL TASK STATUS: COMPLETED SUCCESSFULLY!"
else
    echo "❌ FINAL TASK STATUS: FAILED!"
fi
exit $result