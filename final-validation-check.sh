#!/bin/bash
bash validate-task.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🏆 TASK COMPLETION CONFIRMED!"
else
    echo "⚠️ Task needs more work"
fi
exit $result