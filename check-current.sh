#!/bin/bash
echo "=== Current Files Check ==="
echo "Current directory: $(pwd)"
echo ""
echo "Shell scripts in current directory:"
ls -la *.sh 2>/dev/null || echo "No .sh files found"
echo ""
echo "All files in directory:"
ls -la | head -20