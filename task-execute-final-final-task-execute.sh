#!/bin/bash
bash execute-final-final-task-execute.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🏆 TASK COMPLETION: SUCCESS!"
else
    echo "❌ TASK COMPLETION: FAILED!"
fi
exit $result