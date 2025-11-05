#!/bin/bash
bash test-complete.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🎉 SUCCESS: Task completed!"
else
    echo "❌ FAILURE: Task incomplete"
fi
exit $result