#!/bin/bash
bash run.sh
result=$?
echo ""
if [ $result -eq 0 ]; then
    echo "🎉 Task verification PASSED!"
else
    echo "❌ Task verification FAILED!"
fi
exit $result