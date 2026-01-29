#!/bin/bash

# ==========================================
# Kintime Production Deployment Script
# ==========================================

# 設定
DOMAIN="timebase.alphadoor.jp"
EMAIL="admin@alphadoor.jp" # Certbot用のメールアドレス
PROJECT_DIR="/opt/kintime"
NGINX_CONF_DIR="./nginx"
UPLOAD_DIR="./private-uploads"
WEBROOT_DIR="./nginx/webroot"

# 色の定義
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment for $DOMAIN...${NC}"

# 1. 動作確認
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}Error: docker-compose.prod.yml not found!${NC}"
    exit 1
fi

if [ ! -f ".env.production" ]; then
    echo -e "${RED}Error: .env.production not found!${NC}"
    exit 1
fi

# 2. ディレクトリ作成と権限設定
echo -e "${GREEN}Setting up directories and permissions...${NC}"
mkdir -p $NGINX_CONF_DIR
mkdir -p $UPLOAD_DIR
mkdir -p $WEBROOT_DIR

# アップロードディレクトリの権限設定 (Next.jsのユーザーに合わせる)
# コンテナ内のnextjsユーザーは通常 UID 1001 です
echo "Setting permission for upload directory..."
chmod 777 $UPLOAD_DIR 
# 注意: 本番セキュリティを高めるなら、コンテナ起動後に chown -R 1001:1001 $UPLOAD_DIR を実行するのがベストですが、
# ここでは簡易的に777許可を与え、あとでコンテナ側で制御させます。

# 3. HTTPのみの設定ファイルを作成 (Certbot用)
echo -e "${GREEN}Creating HTTP-only Nginx config for Certbot validation...${NC}"
cat > $NGINX_CONF_DIR/default.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF

# 4. コンテナ起動 (Nginxのみ)
echo -e "${GREEN}Starting Nginx for validation...${NC}"
docker compose -f docker-compose.prod.yml up -d nginx

echo "Waiting for Nginx to start..."
sleep 5

# 5. SSL証明書の取得 (Certbot)
echo -e "${GREEN}Requesting SSL certificate...${NC}"
docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path /var/www/html --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN --force-renewal

if [ $? -ne 0 ]; then
    echo -e "${RED}Certbot failed! Check logs.${NC}"
    exit 1
fi

# 6. HTTPS設定ファイルを作成 (本番用)
echo -e "${GREEN}Creating production HTTPS Nginx config...${NC}"
cat > $NGINX_CONF_DIR/default.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://kintime_app;
        proxy_http_version 1.1;
        
        # Connectionヘッダーを明示的に空にする(Node.jsバックエンドとの互換性のため)
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "";
        
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        client_max_body_size 10M;
    }
}
EOF

# 7. 全コンテナ再起動 (反映)
echo -e "${GREEN}Applying final configuration and restarting all services...${NC}"
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

echo -e "${GREEN}Deployment Complete! Access https://$DOMAIN to verify.${NC}"
