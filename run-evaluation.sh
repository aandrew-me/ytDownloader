#!/bin/bash

echo "Setting up Docker support..."
chmod +x docker-test.sh eval.sh docker-entrypoint.sh

echo ""
echo "Running evaluation script..."
./eval.sh