#!/bin/bash
echo "Running comprehensive task completion test..."
echo ""

# Run the final test
bash final-test.sh

# Capture exit code
result=$?

echo ""
echo "Test result: $result"
if [ $result -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Tests failed!"
fi

exit $result