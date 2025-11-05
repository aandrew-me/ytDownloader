#!/bin/bash
bash ultimate-final-test.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🎉 SUCCESS: Task completed!"
else
    echo "❌ FAILURE: Task incomplete"
fi
exit $result