#!/bin/bash

echo "Running comprehensive validation..."
echo ""

# Make scripts executable
chmod +x *.sh 2>/dev/null || true

echo "1. Implementation completeness check:"
./check-implementation.sh

echo ""
echo "2. Dockerfile syntax validation:"
./validate-dockerfiles.sh

echo ""
echo "🎉 Docker implementation validation complete!"