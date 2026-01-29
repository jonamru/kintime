#!/bin/bash
VPS_IP="162.43.76.99"
ssh root@$VPS_IP "cd /opt/kintime && docker compose -f docker-compose.prod.yml down && rm -rf .next && docker compose -f docker-compose.prod.yml up -d --build app"
echo "Clean build triggerd."
