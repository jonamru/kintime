# Ubuntu Server デプロイメントガイド

## 前提条件
- Ubuntu Server 20.04 LTS または 22.04 LTS
- root権限またはsudo権限を持つユーザー
- サーバーのIPアドレスまたはドメイン名

## 1. サーバーの準備

### 1.1 システムの更新
```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 必要なパッケージのインストール
```bash
# Node.js 20.xのインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL Serverのインストール
sudo apt install -y mysql-server

# Nginxのインストール（リバースプロキシ用）
sudo apt install -y nginx

# PM2のインストール（プロセスマネージャー）
sudo npm install -g pm2

# Gitのインストール
sudo apt install -y git

# ビルドツール
sudo apt install -y build-essential
```

## 2. MySQLの設定

### 2.1 MySQLのセキュリティ設定
```bash
sudo mysql_secure_installation
```

このコマンドを実行すると、以下の質問が順番に表示されます：

1. **VALIDATE PASSWORD COMPONENT（パスワード検証）を設定しますか？**
   - `Y` を入力（推奨）
   - パスワード強度レベル: `1`（MEDIUM）を選択

2. **rootユーザーのパスワードを設定しますか？**
   - `Y` を入力
   - 新しいパスワードを2回入力（例: `KintimeRoot2024!`）

3. **匿名ユーザーを削除しますか？**
   - `Y` を入力（セキュリティのため削除推奨）

4. **rootユーザーのリモートログインを禁止しますか？**
   - `Y` を入力（ローカルのみアクセス可能に）

5. **testデータベースを削除しますか？**
   - `Y` を入力（不要なので削除）

6. **権限テーブルを今すぐリロードしますか？**
   - `Y` を入力（設定を即座に反映）

### 2.2 データベースとユーザーの作成
```bash
# rootユーザーでMySQLにログイン（上で設定したパスワードを使用）
sudo mysql -u root -p
# パスワード入力: KintimeRoot2024!（例）
```

MySQLプロンプトで以下を実行：
```sql
-- データベースを作成（日本語対応）
CREATE DATABASE kintime_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- アプリケーション用ユーザーを作成
-- 'your_strong_password_here'を実際のパスワードに変更してください（例: Kintime@2024Prod）
CREATE USER 'kintime_user'@'localhost' IDENTIFIED BY 'TimeBase@2025Pre';

-- kintime_userにkintime_dbの全権限を付与
GRANT ALL PRIVILEGES ON kintime_db.* TO 'kintime_user'@'localhost';

-- 設定を反映
FLUSH PRIVILEGES;

-- MySQLを終了
EXIT;
```

接続テスト：
```bash
# 作成したユーザーで接続できるか確認
mysql -u kintime_user -p kintime_db
# パスワード入力: Kintime@2024Prod（上で設定したもの）

# 接続成功したら
EXIT;
```

## 3. アプリケーションのデプロイ

### 3.1 アプリケーション用ディレクトリの作成
```bash
sudo mkdir -p /var/www/kintime
sudo chown -R $USER:$USER /var/www/kintime
cd /var/www/kintime
```

### 3.2 コードのアップロード（ローカルPCから直接転送）

#### Step 1: ローカルMac側での作業
ローカルのターミナルを開いて、kintime-appディレクトリで以下を実行：

```bash
# 1. kintime-appディレクトリに移動
cd /Users/kohei/Desktop/kintime/kintime-app/kintime-app

# 2. デプロイ用スクリプトを実行（自動でアーカイブ作成と転送）
./deploy-to-ubuntu.sh
```

このスクリプトが自動で行うこと：
- アプリケーションファイルをtar.gz形式でアーカイブ
- データベースバックアップファイルと一緒にサーバーへ転送
- サーバー上で実行すべきコマンドを表示

#### 手動で転送する場合の代替手順：
```bash
# ローカルMacで実行

# 1. アプリケーションファイルのアーカイブ作成
tar -czf kintime-app-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env.local' \
  --exclude='*.log' \
  .

# 2. ファイルをサーバーへ転送
scp kintime-app-deploy.tar.gz koki@192.168.40.217:~/
scp kintime_db_backup.sql koki@192.168.40.217:~/

# 3. サーバーにSSH接続
ssh koki@192.168.40.217
```

#### Step 2: Ubuntu Server側での作業
サーバーにSSH接続後、以下を実行：

```bash
# 1. アーカイブをデプロイ先ディレクトリに展開
cd /var/www/kintime
tar -xzf ~/kintime-app-deploy.tar.gz

# 2. 転送したファイルの確認
ls -la
# package.json, prisma/, src/ などが表示されることを確認
```

### 3.3 環境変数の設定
```bash
# 環境変数ファイルを作成
nano .env.production
```

以下の内容を追加（パスワードは2.2で設定したものを使用）：
```env
# データベース設定
DATABASE_URL="mysql://kintime_user:TimeBase@2025Pre@localhost:3306/kintime_db"

# 認証設定  
NEXTAUTH_URL="http://192.168.40.217:3000"
NEXTAUTH_SECRET="s9oG7KCGn9rH0A2zXNAGjPMEsv1wqY8Y1jn5JXXmM6g="
JWT_SECRET="0GHbNNmrrY6Epu812hxQDhHbV95Kw/cIowl3OogoywQ="
JWT_SECRET_STRING="KniRvcq2ZruyV2P+/TMg1Eg2jmW3VVQTFk/XncVV3PQ="

# 環境
NODE_ENV=production
```

セキュアなランダム文字列を3つ生成して上記に貼り付け：
```bash
# 1つ目：NEXTAUTH_SECRET用
openssl rand -base64 32

# 2つ目：JWT_SECRET用  
openssl rand -base64 32

# 3つ目：JWT_SECRET_STRING用
openssl rand -base64 32
```

**重要**: 各コマンドで生成された文字列を、対応する環境変数にコピー＆ペーストしてください。

### 3.4 依存関係のインストールとビルド
```bash
# 依存関係のインストール
npm ci --production=false

# Prismaのセットアップ
npx prisma generate
npx prisma migrate deploy

# アプリケーションのビルド
npm run build
```

### 3.5 データベースの移行（既存データがある場合）

#### 既存データベースからの移行手順

**Step 1: ローカルMacでの作業（すでに完了）**
```bash
# データベースのエクスポート（実行済み）
mysqldump -u root kintime_db > kintime_db_backup.sql
# → kintime_db_backup.sql ファイルが作成されています
```

**Step 2: ファイル転送（3.2で実行済みの場合はスキップ）**
```bash
# ローカルMacから実行
scp kintime_db_backup.sql koki@192.168.40.217:~/
```

**Step 3: サーバー上でデータをインポート**
```bash
# データベースにインポート
mysql -u kintime_user -p kintime_db < ~/kintime_db_backup.sql
# パスワード入力: TimeBase@2025Pre

# インポート確認
mysql -u kintime_user -p kintime_db
# パスワード入力: TimeBase@2025Pre

# MySQLプロンプトで
SHOW TABLES;
SELECT COUNT(*) FROM User;
EXIT;

# Prismaスキーマとデータベースを同期
npx prisma db push --accept-data-loss
```

#### 新規インストールの場合（初期データの作成）
```bash
# 管理者ユーザーの作成スクリプトを実行
cat > create-admin.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  try {
    const admin = await prisma.user.create({
      data: {
        userId: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        name: '管理者',
        role: 'SUPER_ADMIN',
        birthDate: new Date('1990-01-01'),
      },
    });
    console.log('Admin user created:', admin.email);
  } catch (error) {
    console.error('Error creating admin:', error);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

node create-admin.js
rm create-admin.js
```

## 4. PM2でアプリケーションを起動

### 4.1 PM2設定ファイルの作成
```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kintime-app',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/kintime',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/kintime-error.log',
    out_file: '/var/log/pm2/kintime-out.log',
    log_file: '/var/log/pm2/kintime-combined.log',
    time: true
  }]
};
EOF
```

### 4.2 アプリケーションの起動
```bash
# ログディレクトリの作成
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# PM2でアプリケーションを起動
pm2 start ecosystem.config.js

# PM2の起動時自動起動設定
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save
```

## 5. Nginxの設定（オプション）

### 5.1 Nginx設定ファイルの作成
```bash
sudo nano /etc/nginx/sites-available/kintime
```

以下の内容を追加：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # ドメイン名またはIPアドレスに変更

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 Nginx設定の有効化
```bash
# シンボリックリンクの作成
sudo ln -s /etc/nginx/sites-available/kintime /etc/nginx/sites-enabled/

# デフォルトサイトの無効化（オプション）
sudo rm /etc/nginx/sites-enabled/default

# 設定のテスト
sudo nginx -t

# Nginxの再起動
sudo systemctl restart nginx
```

## 6. ファイアウォールの設定

```bash
# UFWが有効な場合
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS（SSL設定時）
sudo ufw allow 3000/tcp # Next.js（Nginx未使用の場合）
```

## 7. アプリケーションの管理

### PM2コマンド
```bash
# アプリケーションの状態確認
pm2 status

# ログの確認
pm2 logs kintime-app

# アプリケーションの再起動
pm2 restart kintime-app

# アプリケーションの停止
pm2 stop kintime-app

# アプリケーションの削除
pm2 delete kintime-app
```

### アプリケーションの更新
```bash
cd /var/www/kintime
git pull origin main  # または新しいコードをアップロード
npm ci --production=false
npx prisma migrate deploy
npm run build
pm2 restart kintime-app
```

## 8. トラブルシューティング

### ログの確認
```bash
# PM2ログ
pm2 logs kintime-app --lines 100

# Nginxログ
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# システムログ
sudo journalctl -u nginx -f
```

### 権限の問題
```bash
# アップロードディレクトリの権限
sudo mkdir -p /var/www/kintime/public/uploads
sudo chown -R $USER:$USER /var/www/kintime/public/uploads
chmod -R 755 /var/www/kintime/public/uploads
```

### ポートの確認
```bash
# 使用中のポートを確認
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :80
```

## 9. SSL証明書の設定（本番環境推奨）

Let's Encryptを使用した無料SSL証明書の設定：
```bash
# Certbotのインストール
sudo apt install -y certbot python3-certbot-nginx

# SSL証明書の取得と設定
sudo certbot --nginx -d your-domain.com

# 自動更新の設定
sudo systemctl status certbot.timer
```

## アクセス情報

- **アプリケーションURL**: http://your-server-ip:3000 (直接アクセス)
- **Nginx経由**: http://your-server-ip (ポート80)
- **デフォルト管理者**:
  - メール: admin@example.com
  - パスワード: admin123（初回ログイン後に変更推奨）

## セキュリティ推奨事項

1. **SSH鍵認証の設定**
2. **ファイアウォールの適切な設定**
3. **定期的なシステムアップデート**
4. **SSL証明書の使用**
5. **環境変数の適切な管理**
6. **データベースの定期バックアップ**

## バックアップスクリプト（オプション）

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/home/$USER/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# データベースのバックアップ
mysqldump -u kintime_user -p kintime_db > $BACKUP_DIR/db_backup_$DATE.sql

# アップロードファイルのバックアップ
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz /var/www/kintime/public/uploads

# 古いバックアップの削除（30日以上）
find $BACKUP_DIR -type f -mtime +30 -delete
```

cronで定期実行：
```bash
crontab -e
# 毎日午前3時にバックアップ
0 3 * * * /home/$USER/backup.sh
```