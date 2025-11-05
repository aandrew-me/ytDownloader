#!/bin/bash
echo "=== Creating docker-entrypoint.sh ==="

cat > docker-entrypoint.sh << 'EOF'
#!/bin/bash
set -euo pipefail

echo "Starting ytDownloader Docker container..."
echo ""

echo "Checking required scripts..."
for script in docker-test.sh eval.sh docker-entrypoint.sh; do 
    if [ ! -f "$script" ]; then 
        echo "Error: Required script '$script' is missing"
        exit 1
    else
        echo "✓ Found: $script"
    fi
done

echo ""
echo "✓ All required scripts found"
echo "✓ Docker entrypoint ready"

# Execute the main command
exec "$@"
EOF

chmod +x docker-entrypoint.sh
echo "✓ docker-entrypoint.sh created"
ls -la docker-entrypoint.sh
EOF
chmod +x create-entrypoint.sh
bash create-entrypoint.sh