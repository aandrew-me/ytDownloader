#!/bin/bash
ls -la *.sh 2>/dev/null || echo "No .sh files in current directory"
ls -la | head -20