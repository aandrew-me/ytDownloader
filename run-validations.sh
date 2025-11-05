#!/bin/bash

echo "Running validations..."
echo ""

echo "1. Checking package structure..."
node package-check.js

echo ""
echo "2. Making scripts executable..."
chmod +x *.sh

echo ""
echo "3. Running simple validation..."
./validate.sh