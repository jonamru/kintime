#!/bin/bash

# Configuration
VPS_IP="162.43.76.99"
REMOTE_DIR="/opt/kintime"

echo "========================================"
echo "Deploying Expense Fix to $VPS_IP"
echo "========================================"

echo "1. Syncing source files..."
# Sync the entire src directory to ensure all changes are applied
rsync -avz src/ root@$VPS_IP:$REMOTE_DIR/src/

if [ $? -ne 0 ]; then
    echo "Error: File sync failed. Please check your password and connection."
    exit 1
fi

echo "2. Rebuilding application on VPS..."
# Rebuild and restart the app container
ssh root@$VPS_IP "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d app"

if [ $? -ne 0 ]; then
    echo "Error: Rebuild failed."
    exit 1
fi

echo "========================================"
echo "Deployment Complete!"
echo "Please verify the fix at https://timebase.alphadoor.jp/expense"
echo "========================================"
