#!/bin/bash
bash final-completion-test.sh
result=$?
echo ""
echo "Final result: $result"
if [ $result -eq 0 ]; then
    echo "✅ TASK COMPLETED SUCCESSFULLY!"
else
    echo "❌ TASK FAILED!"
fi
exit $result