#!/bin/bash

# Configuration
VPS_IP="162.43.76.99"

echo "========================================"
echo "Checking VPS Status ($VPS_IP)"
echo "========================================"

echo "1. Docker Container Status:"
ssh root@$VPS_IP "docker ps -a"

echo ""
echo "2. App Container Logs (Last 50 lines):"
ssh root@$VPS_IP "docker logs --tail 50 kintime-app"

echo ""
echo "3. Nginx Container Logs (Last 20 lines):"
ssh root@$VPS_IP "docker logs --tail 20 kintime-nginx"

echo "========================================"
