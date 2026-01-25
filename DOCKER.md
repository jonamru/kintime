# Docker運用ガイド - kintime

## 🐳 Docker構成について

このプロジェクトはDocker化されており、以下のサービスで構成されています：

### サービス構成
- **app**: Next.jsアプリケーション（Node.js 20）
- **db**: MySQL 8.0 データベース
- **nginx**: リバースプロキシ・ロードバランサー
- **redis**: セッション管理・キャッシュ（将来の拡張用）

## 🚀 クイックスタート

### 開発環境
```bash
# リポジトリクローン
git clone <repository-url>
cd kintime-app

# 即座に起動
docker-compose up -d

# 初期化
docker-compose exec app npm run db:push
docker-compose exec app npm run db:seed

# ブラウザでアクセス
# http://localhost
```

### 本番環境
```bash
# 環境変数設定
cp .env.docker .env.production
vi .env.production  # セキュリティキーを設定

# 本番起動
docker-compose up -d --build

# 初期化
docker-compose exec app npm run db:push
docker-compose exec app npm run db:seed
```

## ⚙️ 設定とカスタマイズ

### 環境変数の設定

**.env.docker をコピーして .env.production を作成**
```bash
# 必須変更項目
JWT_SECRET_STRING="32文字以上の強力なランダム文字列"
MYSQL_ROOT_PASSWORD="強力なrootパスワード"
MYSQL_PASSWORD="強力なアプリユーザーパスワード"
```

### ポート設定の変更
```yaml
# docker-compose.yml
services:
  nginx:
    ports:
      - "8080:80"  # HTTP
      - "8443:443" # HTTPS
```

### メモリ制限の設定
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

## 🔧 運用コマンド

### 基本操作
```bash
# サービス起動
docker-compose up -d

# サービス停止
docker-compose down

# 特定サービスの再起動
docker-compose restart app

# ログ確認
docker-compose logs -f app
docker-compose logs -f db

# システム状態確認
docker-compose ps
docker-compose top
```

### データベース操作
```bash
# MySQLに接続
docker-compose exec db mysql -u kintime -p kintime

# バックアップ作成
docker-compose exec db mysqldump -u kintime -p kintime > backup.sql

# バックアップ復元
cat backup.sql | docker-compose exec -T db mysql -u kintime -p kintime

# Prisma Studio起動
docker-compose exec app npx prisma studio
```

### アプリケーション操作
```bash
# Prisma操作
docker-compose exec app npm run db:generate
docker-compose exec app npm run db:push
docker-compose exec app npm run db:migrate

# 初期データ投入
docker-compose exec app npm run db:seed

# コンテナ内でシェル実行
docker-compose exec app sh
docker-compose exec db bash
```

## 📊 監視とログ

### ログファイルの場所
```bash
# アプリケーションログ
docker-compose logs app

# データベースログ
docker-compose logs db

# Nginxログ
docker-compose logs nginx

# すべてのログ
docker-compose logs -f
```

### システムリソース確認
```bash
# コンテナのリソース使用量
docker stats

# ディスク使用量
docker system df

# 不要なリソースのクリーンアップ
docker system prune -a
```

## 🔐 セキュリティ設定

### SSL証明書の設定

#### Let's Encryptで証明書取得
```bash
# 証明書ディレクトリ作成
mkdir -p nginx/ssl

# 証明書取得
docker run --rm -it \
  -v $PWD/nginx/ssl:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d your-domain.com

# nginx/default.confのHTTPS設定を有効化
# コメントアウトを外す

# Nginx再起動
docker-compose restart nginx
```

#### 自己署名証明書（開発用）
```bash
# 証明書作成
mkdir -p nginx/ssl
cd nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/CN=localhost"

cd ../..
docker-compose restart nginx
```

### ファイアウォール設定
```bash
# Ubuntu UFW設定例
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw --force enable
```

## 🎯 パフォーマンス最適化

### MySQL設定の調整
```bash
# docker-compose.yml でMySQLにカスタム設定を追加
services:
  db:
    command: --innodb_buffer_pool_size=512M --max_connections=200
```

### アプリケーションスケーリング
```bash
# アプリケーションを3台に増やす
docker-compose up -d --scale app=3

# ロードバランサーの設定も必要
# nginx/nginx.conf のupstream設定を調整
```

### Redis設定（将来の拡張）
```bash
# Redisコンテナの設定
services:
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### コンテナが起動しない
```bash
# ログを確認
docker-compose logs

# ポートの競合確認
sudo lsof -i :3000
sudo lsof -i :3306
sudo lsof -i :80
```

#### データベース接続エラー
```bash
# MySQLコンテナの状態確認
docker-compose exec db mysqladmin ping -h localhost -u kintime -p

# 接続設定確認
docker-compose exec app env | grep DATABASE
```

#### ディスク容量不足
```bash
# Dockerリソースのクリーンアップ
docker system prune -a --volumes

# 古いイメージの削除
docker image prune -a
```

#### メモリ不足
```bash
# メモリ使用量確認
docker stats

# 不要なコンテナ停止
docker-compose down
```

### バックアップ・復旧手順

#### 完全バックアップ
```bash
# サービス停止
docker-compose down

# データボリュームのバックアップ
sudo tar -czf kintime-backup-$(date +%Y%m%d).tar.gz \
  -C /var/lib/docker/volumes \
  kintime_db_data kintime_uploads

# サービス再開
docker-compose up -d
```

#### 復旧手順
```bash
# サービス停止
docker-compose down

# ボリューム削除
docker volume rm kintime_db_data kintime_uploads

# バックアップから復元
sudo tar -xzf kintime-backup-YYYYMMDD.tar.gz \
  -C /var/lib/docker/volumes

# サービス開始
docker-compose up -d
```

## 📈 本番運用のベストプラクティス

### 定期メンテナンス
```bash
# 週次バックアップスクリプト例
#!/bin/bash
DATE=$(date +%Y%m%d)
docker-compose exec -T db mysqldump -u kintime -ppassword kintime | gzip > backup_$DATE.sql.gz
find . -name "backup_*.sql.gz" -mtime +30 -delete
```

### 監視設定
```bash
# ヘルスチェック確認
curl http://localhost/health

# リソース監視
watch 'docker stats --no-stream'
```

### アップデート手順
```bash
# 新バージョンへの更新
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

これでDockerを使った運用が格段に簡単になります！