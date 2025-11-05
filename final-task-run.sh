#!/bin/bash
bash run-complete-task.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🏆 FINAL RESULT: TASK SUCCESSFULLY COMPLETED!"
else
    echo "❌ FINAL RESULT: TASK INCOMPLETE"
fi
exit $result