#!/bin/bash
bash execute-check-final-task.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "✅ TASK STATUS: COMPLETED!"
else
    echo "❌ TASK STATUS: INCOMPLETE!"
fi
exit $result