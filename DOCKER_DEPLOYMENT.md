# 🐳 Docker + VPS デプロイガイド

DockerでVPSにKintimeアプリをデプロイする際の環境変数設定方法を説明します。

---

## 📋 概要

Docker環境では、**`.env`ファイルをVPSにアップロードせず**、サーバー上で環境変数を直接設定します。

---

## 🔐 推奨方法1: .env.production.local（最も簡単）

### ステップ1: VPSサーバーで強力なシークレットを生成

VPSにSSH接続してから:

```bash
# プロジェクトディレクトリに移動
cd /path/to/kintime-app

# 強力なシークレットキーを生成して .env.production.local に保存
cat > .env.production.local << EOF
# ===========================================
# 本番環境用環境変数
# ⚠️ このファイルは絶対にGitにコミットしないでください
# ===========================================

# Database (Docker Compose内部のdb サービスを使用)
DATABASE_URL="mysql://kintime:$(openssl rand -base64 16)@db:3306/kintime"

# JWT Secrets
JWT_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Node Environment
NODE_ENV=production

# MySQLデータベースのパスワード（DB作成用）
MYSQL_ROOT_PASSWORD="$(openssl rand -base64 24)"
MYSQL_PASSWORD="$(openssl rand -base64 24)"
EOF

# ファイルのパーミッションを制限（所有者のみ読み取り可能）
chmod 600 .env.production.local

# 内容を確認（シークレットが生成されていることを確認）
cat .env.production.local
```

### ステップ2: docker-compose.yml を更新

`docker-compose.yml`の`environment`セクションを修正:

```yaml
services:
  app:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: kintime-app
    restart: unless-stopped
    env_file:
      - .env.production.local  # ← 追加
    environment:
      - NODE_ENV=production
      # 他の環境変数は .env.production.local から読み込まれる
    # ... 残りの設定
```

### ステップ3: デプロイ

```bash
# Dockerコンテナをビルド・起動
docker-compose up -d --build

# ログを確認
docker-compose logs -f app
```

---

## 🔐 推奨方法2: Docker Secrets（高セキュリティ）

Docker Swarmを使用する場合の最も安全な方法。

### ステップ1: シークレットを作成

```bash
# JWT_SECRET を作成
openssl rand -base64 32 | docker secret create jwt_secret -

# DB_PASSWORD を作成
openssl rand -base64 24 | docker secret create db_password -

# シークレット一覧を確認
docker secret ls
```

### ステップ2: docker-compose.yml で使用

```yaml
version: '3.8'

services:
  app:
    # ...
    secrets:
      - jwt_secret
      - db_password
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://kintime:db_password@db:3306/kintime
      # シークレットは /run/secrets/jwt_secret として読み込まれる

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
```

---

## 🔐 推奨方法3: 環境変数ファイル + GitIgnore（シンプル）

### ステップ1: VPSで `.env.production.local` を作成

```bash
# VPSのプロジェクトディレクトリで実行
cd /path/to/kintime-app

# 本番用の .env.production.local を作成
nano .env.production.local
```

以下の内容を入力（値は実際に生成したランダム値に置き換え）:

```bash
# ===========================================
# 本番環境用環境変数 (VPS)
# ===========================================

# Database
DATABASE_URL="mysql://kintime:YOUR_STRONG_DB_PASSWORD@db:3306/kintime"

# JWT Secrets
JWT_SECRET="YOUR_GENERATED_JWT_SECRET_FROM_OPENSSL"
NEXTAUTH_SECRET="YOUR_GENERATED_NEXTAUTH_SECRET_FROM_OPENSSL"

# Node Environment
NODE_ENV=production

# MySQL Database Credentials
MYSQL_ROOT_PASSWORD="YOUR_STRONG_ROOT_PASSWORD"
MYSQL_USER=kintime
MYSQL_PASSWORD="YOUR_STRONG_DB_PASSWORD"
MYSQL_DATABASE=kintime
```

### ステップ2: docker-compose.production.yml を作成

```yaml
version: '3.8'

services:
  app:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: kintime-app
    restart: unless-stopped
    env_file:
      - .env.production.local  # VPS上でのみ存在
    ports:
      - "3000:3000"
    depends_on:
      - db
    networks:
      - kintime-network

  db:
    image: mysql:8.0
    container_name: kintime-db
    restart: unless-stopped
    env_file:
      - .env.production.local
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - kintime-network

  nginx:
    image: nginx:alpine
    container_name: kintime-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - kintime-network

volumes:
  db_data:

networks:
  kintime-network:
    driver: bridge
```

### ステップ3: デプロイ

```bash
# 本番用のdocker-composeで起動
docker-compose -f docker-compose.production.yml up -d --build
```

---

## 🛡️ .gitignore の確認

**重要**: `.env.production.local` がGitにコミットされないようにする

`.gitignore`に以下を追加（既に`.env*`があるので通常は不要ですが確認）:

```gitignore
# Environment files
.env
.env.*
.env.local
.env.production.local
!.env.example
```

---

## 📦 VPSへのデプロイ手順（完全版）

### 1. VPSの準備

```bash
# VPSにSSH接続
ssh user@your-vps-ip

# Docker & Docker Composeのインストール（Ubuntu/Debian）
sudo apt update
sudo apt install -y docker.io docker-compose git

# Dockerサービスを起動
sudo systemctl start docker
sudo systemctl enable docker

# 現在のユーザーをdockerグループに追加
sudo usermod -aG docker $USER
# ログアウトして再ログインが必要
```

### 2. コードのデプロイ

```bash
# プロジェクトをクローン（または rsync/scp でアップロード）
git clone https://github.com/yourname/kintime-app.git
cd kintime-app

# ⚠️ .env ファイルは含まれていないことを確認
ls -la | grep .env
# → .env.example のみ表示されるべき
```

### 3. 本番環境変数の設定

```bash
# シークレットキーを生成
JWT_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)
MYSQL_PASSWORD=$(openssl rand -base64 24)

# .env.production.local に保存
cat > .env.production.local << EOF
DATABASE_URL="mysql://kintime:${MYSQL_PASSWORD}@db:3306/kintime"
JWT_SECRET="${JWT_SECRET}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NODE_ENV=production
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD}"
MYSQL_USER=kintime
MYSQL_PASSWORD="${MYSQL_PASSWORD}"
MYSQL_DATABASE=kintime
EOF

# パーミッションを制限
chmod 600 .env.production.local
```

### 4. SSL証明書の取得（本番環境）

```bash
# Let's Encryptで無料SSL証明書を取得
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# 証明書をnginxディレクトリにコピー
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
```

### 5. データベースのマイグレーション

```bash
# Prismaコンテナで実行（初回のみ）
docker-compose run --rm app npx prisma migrate deploy
docker-compose run --rm app npx prisma generate
docker-compose run --rm app npm run db:seed
```

### 6. アプリケーション起動

```bash
# コンテナをビルド・起動
docker-compose up -d --build

# ログを確認
docker-compose logs -f

# 起動確認
curl http://localhost:3000/
```

### 7. 自動起動の設定

```bash
# Systemd サービスとして登録
sudo nano /etc/systemd/system/kintime.service
```

内容:
```ini
[Unit]
Description=Kintime Docker Compose Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/kintime-app
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# サービスを有効化
sudo systemctl enable kintime
sudo systemctl start kintime
```

---

## 🔍 環境変数の確認方法

```bash
# コンテナ内の環境変数を確認（セキュリティリスクあり - 本番では注意）
docker-compose exec app printenv | grep JWT_SECRET

# または
docker-compose exec app env
```

---

## 🚨 セキュリティチェックリスト

- [ ] `.env.production.local` がGitにコミットされていない
- [ ] VPS上の `.env.production.local` のパーミッションが `600` (所有者のみ読み取り可能)
- [ ] すべてのシークレットキーが強力なランダム値
- [ ] データベースのパスワードがデフォルト値でない
- [ ] HTTPSが有効化されている
- [ ] Docker コンテナが `restart: unless-stopped` 設定
- [ ] ファイアウォールで不要なポートが閉じられている

---

## 🔄 シークレットのローテーション方法

定期的にシークレットキーを変更する:

```bash
# 新しいキーを生成
NEW_JWT_SECRET=$(openssl rand -base64 32)

# .env.production.local を更新
sed -i "s/JWT_SECRET=.*/JWT_SECRET=\"$NEW_JWT_SECRET\"/" .env.production.local

# コンテナを再起動
docker-compose restart app
```

⚠️ **注意**: JWT_SECRETを変更すると、全ユーザーが再ログインする必要があります。

---

## 📚 参考コマンド

```bash
# コンテナのステータス確認
docker-compose ps

# ログを表示
docker-compose logs -f app

# コンテナを再起動
docker-compose restart

# コンテナを停止
docker-compose down

# データボリュームも削除して完全にクリーンアップ
docker-compose down -v
```

---

**最終更新**: 2026-01-25  
**次回レビュー**: セキュリティ設定は3ヶ月ごとに見直してください
