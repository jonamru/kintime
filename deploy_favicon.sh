#!/bin/bash

# Configuration
VPS_IP="162.43.76.99"
REMOTE_DIR="/opt/kintime"

echo "========================================"
echo "Deploying Favicon to $VPS_IP"
echo "========================================"

echo "1. Syncing new icon.png..."
rsync -avz src/app/icon.png root@$VPS_IP:$REMOTE_DIR/src/app/

if [ $? -ne 0 ]; then
    echo "Error: File sync failed."
    exit 1
fi

echo "2. Rebuilding application on VPS..."
# Rebuild is necessary for Next.js to process the new metadata icon
ssh root@$VPS_IP "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d app"

if [ $? -ne 0 ]; then
    echo "Error: Rebuild failed."
    exit 1
fi

echo "========================================"
echo "Favicon Deployment Complete!"
echo "If it doesn't appear immediately, please clear your browser cache."
echo "========================================"
