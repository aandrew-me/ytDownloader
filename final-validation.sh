#!/bin/bash
bash run-complete-validation.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🏆 FINAL RESULT: TASK COMPLETED SUCCESSFULLY!"
else
    echo "⚠️ FINAL RESULT: TASK FAILED!"
fi
exit $result