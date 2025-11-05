#!/bin/bash
bash execute-final-run-task-complete-final.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🏆 TASK STATUS: COMPLETED SUCCESSFULLY!"
else
    echo "❌ TASK STATUS: FAILED!"
fi
exit $result