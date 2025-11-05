#!/bin/bash
echo "=== Checking current files ==="
ls -la docker-test.sh eval.sh docker-entrypoint.sh 2>&1 || echo "Some files are missing"
echo ""
echo "=== Current directory contents ==="
ls -la *.sh | head -20