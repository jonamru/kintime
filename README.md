# 勤怠・シフト管理システム

イベント・人材派遣業向けの包括的な勤怠管理システムです。自社・パートナー企業の人材を一元管理し、勤怠、シフト、交通費・経費を統合管理できます。

## 📋 主な機能

### 🔐 認証・ユーザー管理
- 5段階の権限管理（全権管理者、担当別管理者、パートナー企業管理者、自社スタッフ、パートナースタッフ）
- NextAuth.jsによる安全な認証

### ⏰ 勤怠管理
- スマートフォンからのWeb打刻
- GPS情報の取得（ON/OFF切替可能）
- 4種類の打刻（出勤/退勤/起床報告/出発報告）
- 勤怠修正申請・承認機能

### 📅 シフト管理
- カレンダー形式のシフト希望提出
- 常勤シフト・スポットシフトの2種類対応
- 管理者によるシフト作成・承認
- シフト確定通知（アプリ内・メール）

### 💰 交通費・経費管理
- Yahoo!乗換案内からの自動抽出機能
- 定期券情報の登録（写真添付可能）
- 宿泊費等の経費申請
- 承認フロー・コメント機能

### 📊 レポート・分析
- 月次勤怠レポート
- 案件別収支レポート
- スタッフ別実績レポート
- CSV/Excel出力機能

## 🛠 技術スタック

- **フロントエンド**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: MySQL + Prisma ORM
- **認証**: NextAuth.js
- **ファイルアップロード**: Next.js内蔵機能

## 🚀 セットアップ

### 1. 環境準備
```bash
# リポジトリのクローン
git clone <repository-url>
cd kintime-app

# 依存関係のインストール
npm install
```

### 2. 環境変数の設定
`.env.local`ファイルを作成：
```bash
# Database
DATABASE_URL="mysql://root:password@localhost:3306/kintime"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Upload Directory
UPLOAD_DIR=./public/uploads
```

### 3. データベースのセットアップ
```bash
# MySQLデータベースの作成
mysql -u root -p
CREATE DATABASE kintime CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Prismaの設定
npm run db:generate
npm run db:push
```

### 4. 初期データの投入
ブラウザで http://localhost:3000/api/seed にアクセス

### 5. 開発サーバーの起動
```bash
npm run dev
```

## 👥 初期ユーザー

| 権限 | メールアドレス | パスワード |
|------|---------------|------------|
| 全権管理者 | admin@example.com | password123 |
| 担当別管理者 | manager@example.com | password123 |
| パートナー企業管理者 | partner@example.com | password123 |
| 自社スタッフ | staff@example.com | password123 |
| パートナースタッフ | partnerstaff@example.com | password123 |

## 🌐 本番環境デプロイ

### さくらVPS等への部署

1. **サーバーのセットアップ**
```bash
# Node.js, MySQL, Nginxのインストール
sudo apt update
sudo apt install mysql-server nginx
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **アプリケーションのビルド**
```bash
npm run build
```

3. **PM2での起動**
```bash
npm install -g pm2
pm2 start npm --name "kintime" -- start
pm2 save
pm2 startup
```

4. **Nginxの設定**
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

## 📁 プロジェクト構造

```
src/
├── app/                    # App Router
│   ├── api/               # API Routes
│   ├── login/             # ログインページ
│   ├── dashboard/         # ダッシュボード
│   ├── attendance/        # 勤怠管理
│   ├── shift/            # シフト管理
│   ├── expense/          # 交通費・経費管理
│   ├── reports/          # レポート
│   └── admin/            # 管理者機能
├── components/           # 共通コンポーネント
├── lib/                 # ライブラリ・ユーティリティ
└── types/              # 型定義

prisma/
├── schema.prisma       # データベーススキーマ

public/
└── uploads/           # アップロードファイル
```

## 🔧 開発用コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start

# データベース関連
npm run db:generate    # Prismaクライアント生成
npm run db:push       # スキーマをDBに反映
npm run db:migrate    # マイグレーション作成・適用

# リンティング
npm run lint
```

## 📱 モバイル対応

- レスポンシブデザインによる全デバイス対応
- PWA対応でアプリライクな体験
- GPS機能を活用した位置情報取得
- スマートフォン最適化UI

## 🔐 セキュリティ機能

- JWT認証による安全なセッション管理
- 権限ベースのアクセス制御
- HTTPS通信対応
- アクセスログの記録
- パスワードのハッシュ化

## 💳 運用コスト

- さくらVPS 1GBプラン: 月額990円
- 独自ドメイン: 年額1,000円程度
- SSL証明書: 無料（Let's Encrypt）

**総運用コスト: 月額約1,000円〜2,000円**

## 📝 ライセンス

MIT License

## 🤝 サポート

- バグ報告: GitHub Issues
- 機能要望: GitHub Issues
- その他: README_SETUP.mdを参照