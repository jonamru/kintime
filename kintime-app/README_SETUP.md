# 勤怠管理システム セットアップガイド

## 1. 環境準備

### 必要なソフトウェア
- Node.js 18以上
- MySQL 8.0以上
- npm または yarn

## 2. データベースのセットアップ

### MySQLデータベースの作成
```bash
mysql -u root -p
```

```sql
CREATE DATABASE kintime CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 環境変数の設定
`.env.local`ファイルの`DATABASE_URL`を自分の環境に合わせて修正してください：
```
DATABASE_URL="mysql://root:yourpassword@localhost:3306/kintime"
```

## 3. 依存関係のインストール
```bash
npm install
```

## 4. データベースのマイグレーション
```bash
npx prisma generate
npx prisma db push
```

## 5. 初期データの投入
ブラウザで以下のURLにアクセス：
```
http://localhost:3000/api/seed
```

## 6. 開発サーバーの起動
```bash
npm run dev
```

## 7. ログイン情報

初期ユーザー：
- 全権管理者: admin@example.com / password123
- 担当別管理者: manager@example.com / password123
- パートナー企業管理者: partner@example.com / password123
- 自社スタッフ: staff@example.com / password123
- パートナースタッフ: partnerstaff@example.com / password123

## 8. 本番環境へのデプロイ（さくらVPS等）

### 必要なソフトウェアのインストール
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL
sudo apt update
sudo apt install mysql-server

# Nginx
sudo apt install nginx

# PM2
sudo npm install -g pm2
```

### アプリケーションのビルド
```bash
npm run build
```

### PM2での起動
```bash
pm2 start npm --name "kintime" -- start
pm2 save
pm2 startup
```

### Nginxの設定
`/etc/nginx/sites-available/kintime`：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kintime /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```