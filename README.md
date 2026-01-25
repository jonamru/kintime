# kintime - 勤怠・シフト管理システム

イベント・人材派遣業向けの包括的な勤怠管理システムです。自社・パートナー企業の人材を一元管理し、勤怠、シフト、交通費・経費を統合管理できます。

## 📋 主な機能

### 🔐 認証・ユーザー管理
- カスタムロールシステムによる柔軟な権限管理
- JWT認証による安全なセッション管理
- ユーザー階層管理（管理者とスタッフの関係）
- パートナー企業管理機能

### ⏰ 勤怠管理
- スマートフォンからのWeb打刻（GPS位置情報付き）
- 4種類の打刻（出勤/退勤/起床報告/出発報告）
- 勤怠修正申請・承認機能
- 強制打刻機能（管理者権限）
- 月次勤怠サマリー機能

### 📅 シフト管理
- シフト希望提出・管理機能
- 常勤シフト・スポットシフトの2種類対応
- 管理者によるシフト作成・一括登録
- CSVアップロードによる一括シフト登録
- シフトロック・アンロック機能
- 本日のシフト確認機能

### 💰 交通費・経費管理
- Yahoo!乗換案内からの自動抽出機能
- 定期券情報の登録（写真添付可能）
- 交通費・宿泊費の申請・承認
- 経費月次集計機能
- 経費ロック機能

### 📊 レポート・分析
- 勤怠レポート（PDF/Excel出力）
- シフトレポート（PDF/Excel出力）
- 経費レポート（PDF/Excel出力）
- データ分析・可視化機能

### 🛠 管理者機能
- ユーザー一括編集機能
- インライン編集機能
- システム設定管理
- パートナー企業管理
- ロール・権限管理
- データベース最適化機能

## 🛠 技術スタック

- **フロントエンド**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **バックエンド**: Next.js API Routes
- **データベース**: MySQL + Prisma ORM v6.12
- **認証**: カスタムJWT認証システム
- **PDF生成**: jsPDF + jsPDF-AutoTable
- **Excel出力**: XLSX
- **ファイルアップロード**: Next.js内蔵機能
- **スクレイピング**: Puppeteer（Yahoo!乗換案内）

## 🚀 セットアップ

### Docker での起動（推奨）

#### 1. クイックスタート
```bash
# リポジトリのクローン
git clone <repository-url>
cd kintime-app

# Docker Compose で起動
docker-compose up -d

# 初期データの投入
docker-compose exec app npm run db:push
docker-compose exec app npm run db:seed
```

#### 2. 本番環境設定
```bash
# 環境変数ファイルをコピー・編集
cp .env.docker .env.production

# セキュリティキーを生成・設定
# JWT_SECRET_STRING を32文字以上のランダム文字列に変更
# MySQL パスワードも変更

# 本番用起動
docker-compose -f docker-compose.yml up -d
```

### 従来のセットアップ方法

#### 1. 環境準備
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

# JWT Authentication
JWT_SECRET_STRING=your-secret-key-here

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
```bash
# 安全な初期データの投入
curl http://localhost:3000/api/seed-safe

# または開発用ダミーデータの追加
npm run db:add-dummy-users
```

### 5. 開発サーバーの起動
```bash
npm run dev
```

## 👥 初期ユーザー（開発環境）

| ロール | メールアドレス | パスワード | 権限範囲 |
|--------|----------------|------------|----------|
| システム管理者 | admin@example.com | password123 | 全機能アクセス可能 |
| 勤怠管理者 | manager@example.com | password123 | 勤怠・シフト管理 |
| パートナー管理者 | partner@example.com | password123 | パートナー企業管理 |
| 一般スタッフ | staff@example.com | password123 | 基本機能のみ |

## 🌐 本番環境デプロイ

### Docker での本番デプロイ（推奨）

#### Ubuntu Server での簡単デプロイ
```bash
# 1. Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 2. Docker Composeのインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. アプリケーションのクローン
git clone <repository-url>
cd kintime-app

# 4. 本番環境設定
cp .env.docker .env.production
# .env.production を編集してセキュリティキーを設定

# 5. 本番環境での起動
docker-compose up -d

# 6. 初期データ投入
docker-compose exec app npm run db:push
docker-compose exec app npm run db:seed
```

#### SSL証明書設定（Let's Encrypt）
```bash
# Certbotコンテナでの証明書取得
docker run -it --rm --name certbot \
  -v ./nginx/ssl:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone -d your-domain.com

# nginx/default.conf の HTTPS 設定を有効化後
docker-compose restart nginx
```

### 従来のデプロイ方法

#### さくらVPS等でのマニュアルデプロイ

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
├── app/                           # App Router
│   ├── api/                      # API Routes
│   │   ├── admin/               # 管理者API
│   │   │   ├── users/          # ユーザー管理
│   │   │   ├── roles/          # ロール管理
│   │   │   ├── partners/       # パートナー管理
│   │   │   ├── system-settings/ # システム設定
│   │   │   ├── bulk-edit/      # 一括編集
│   │   │   └── shift-*/        # シフト管理系
│   │   ├── auth/               # 認証関連
│   │   ├── attendance/         # 勤怠API
│   │   ├── shift/             # シフトAPI
│   │   ├── expenses/          # 経費API
│   │   ├── reports/           # レポートAPI
│   │   └── transit/           # 乗換検索API
│   ├── login/                 # ログインページ
│   ├── dashboard/             # ダッシュボード
│   ├── attendance/            # 勤怠管理ページ
│   ├── shift/                 # シフト管理ページ
│   ├── expense/               # 交通費・経費ページ
│   ├── reports/               # レポートページ
│   └── admin/                 # 管理者ページ
├── components/                # 共通コンポーネント
├── contexts/                  # React Context
├── lib/                       # ライブラリ・ユーティリティ
│   ├── auth.ts               # JWT認証
│   ├── permissions.ts        # 権限管理
│   ├── dateUtils.ts         # 日時処理（JST統一）
│   └── prisma.ts            # DB接続
└── types/                    # 型定義

prisma/
├── schema.prisma            # データベーススキーマ
└── migrations/              # マイグレーション履歴

public/
└── uploads/                 # アップロードファイル
    └── commute-passes/      # 定期券画像
```

## 🔧 開発用コマンド

### Docker環境での開発
```bash
# コンテナの起動・停止
docker-compose up -d          # バックグラウンドで起動
docker-compose down           # 停止・削除
docker-compose restart app    # アプリケーションのみ再起動

# アプリケーション操作
docker-compose exec app npm run db:generate     # Prismaクライアント生成
docker-compose exec app npm run db:push        # スキーマをDBに反映
docker-compose exec app npm run db:migrate     # マイグレーション
docker-compose exec app npm run db:seed        # 初期データ投入
docker-compose exec app npm run lint           # ESLint実行

# ログ確認
docker-compose logs app       # アプリケーションログ
docker-compose logs db        # データベースログ
docker-compose logs -f        # 全ログをリアルタイム表示

# データベース操作
docker-compose exec db mysql -u kintime -p kintime  # MySQLに接続
docker-compose exec app npx prisma studio           # Prisma Studio起動

# システム状態確認
docker-compose ps             # コンテナ状態確認
docker-compose top            # プロセス確認
```

### 従来の開発コマンド
```bash
# 開発サーバー起動
npm run dev               # Turbopack使用
npm run dev:https        # HTTPS開発サーバー（証明書使用）
npm run dev:https-simple # HTTPS開発サーバー（簡易版）

# ビルド・起動
npm run build
npm start

# データベース関連
npm run db:generate       # Prismaクライアント生成
npm run db:push          # スキーマをDBに反映
npm run db:migrate       # マイグレーション作成・適用
npm run db:seed          # 初期データ投入
npm run db:add-dummy-users # ダミーユーザー追加
npm run db:studio        # Prisma Studio起動

# 開発ツール
npm run lint             # ESLint実行
npm run generate-cert    # HTTPS証明書生成
```

## 📱 モバイル対応・特徴

- **完全レスポンシブデザイン**による全デバイス対応
- **GPS機能**を活用した位置情報付き勤怠管理
- **日本時間（JST）統一**による時間管理
- **パフォーマンス最適化**（データベースインデックス、クエリ最適化）
- **カスタム権限システム**による細かいアクセス制御
- **リアルタイム通知機能**

## 🔐 セキュリティ機能

- JWT認証による安全なセッション管理
- CustomRoleテーブルによる柔軟な権限管理システム
- 細かい権限制御（userManagement, shiftManagement, attendanceManagement, expenseManagement, systemSettings）
- HTTPS通信対応（開発環境でも証明書生成可能）
- bcryptによるパスワードハッシュ化
- ページアクセス制御機能
- 位置情報セキュリティ（GPS ON/OFF切替）

## 🗃 データベース設計

### 主要テーブル
- **User**: ユーザー情報（階層管理対応）
- **CustomRole**: カスタムロール・権限管理
- **Partner**: パートナー企業管理
- **Attendance**: 勤怠データ（GPS位置情報付き）
- **Shift/ShiftRequest**: シフト管理
- **Expense**: 交通費・経費管理
- **CommutePass**: 定期券情報
- **Correction**: 勤怠修正申請
- **Project**: 案件管理

### 特徴
- パフォーマンス最適化インデックス
- JST（日本時間）での統一的な時間管理
- リレーションシップによる階層管理
- JSON型フィールドによる柔軟な権限・設定管理

## 💳 運用コスト

- さくらVPS 1GBプラン: 月額990円
- 独自ドメイン: 年額1,000円程度
- SSL証明書: 無料（Let's Encrypt）

### Docker環境での運用コスト
- さくらVPS 4GBプラン: 月額2,530円（Docker推奨）
- さくらVPS 8GBプラン: 月額5,060円（高負荷時）
- 独自ドメイン: 年額1,000円〜
- SSL証明書: 無料（Let's Encrypt）

**Docker総運用コスト: 月額2,500円〜5,000円**

### 従来環境での運用コスト  
- さくらVPS 1GBプラン: 月額990円（最小構成）
- さくらVPS 2GBプラン: 月額1,738円（推奨）

**従来総運用コスト: 月額1,000円〜2,000円**

## 📝 ライセンス

MIT License

## 🤝 サポート・開発情報

- バグ報告: GitHub Issues
- 機能要望: GitHub Issues
- 開発ガイドライン: `CLAUDE.md`を参照
- セットアップ詳細: `README_SETUP.md`を参照
- パフォーマンス分析: `PERFORMANCE_ANALYSIS.md`を参照

## 🔍 主要実装ポイント

### 権限管理
- `CustomRole`テーブルによる柔軟な権限システム
- `hasPermission()`関数による統一的な権限チェック
- ページレベルアクセス制御

### 日時管理
- 全システムでJST（日本時間）統一
- `dateUtils.ts`による統一的な日時処理
- UTCへの変換は行わない設計

### パフォーマンス
- データベースインデックス最適化済み
- 効率的なクエリ設計
- Turbopack使用による高速開発体験

### セキュリティ
- JWT認証システム
- bcryptパスワードハッシュ化
- 入力値検証・SQLインジェクション対策
- 位置情報プライバシー保護