# TimeBase サーバー移行・バックアップ手順書

本番環境（VPS）のデータベースとアップロードファイルを、新しいサーバーへ完全移行する際の手順です。

## 前提条件

- **旧サーバー**: 現在稼働中のVPS（移行元）
- **新サーバー**: 新しくセットアップしたVPS（移行先）
  - Docker と Docker Compose がインストール済みであること
- **ローカル環境**: 作業用PC（Mac/Windows）

---

## 1. 旧サーバーでのバックアップ取得

旧サーバーにSSH接続し、MySQLのデータをダンプ（エクスポート）します。

```bash
# 旧サーバーにログイン
ssh root@<旧サーバーIP>

# アプリディレクトリへ移動
cd /opt/kintime

# データベースのダンプを作成（backup.sql というファイルに出力）
# パスワードは .env.production の DATABASE_PASSWORD と一致させてください
docker compose -f docker-compose.prod.yml exec db mysqldump -u kintime -p'Kintime_Prod_2026!' kintime > backup.sql

# 完了したらログアウト
exit
```

---

## 2. データをローカルPCへダウンロード

ローカルPCのターミナルで以下のコマンドを実行し、旧サーバーからデータとファイルをダウンロードします。

### 作業用ディレクトリの作成
```bash
mkdir -p ~/Desktop/kintime-migration
cd ~/Desktop/kintime-migration
```

### データベースとファイルの取得
```bash
# 1. SQLバックアップファイルの取得
scp root@<旧サーバーIP>:/opt/kintime/backup.sql ./

# 2. アップロード画像（公開）の取得
rsync -avz root@<旧サーバーIP>:/opt/kintime/uploads ./

# 3. アップロード画像（非公開/領収書など）の取得
rsync -avz root@<旧サーバーIP>:/opt/kintime/private-uploads ./
```

---

## 3. 新サーバーへのデータ転送

取得したデータを新サーバーへアップロードします。

```bash
# 1. 新サーバーにディレクトリ作成（SSH経由で実行）
ssh root@<新サーバーIP> "mkdir -p /opt/kintime"

# 2. SQLファイルの転送
scp ./backup.sql root@<新サーバーIP>:/opt/kintime/

# 3. アップロード画像の転送
rsync -avz ./uploads root@<新サーバーIP>:/opt/kintime/
rsync -avz ./private-uploads root@<新サーバーIP>:/opt/kintime/

# 4. Docker構成ファイル一式の転送（ローカルのプロジェクトフォルダから）
# ※ プロジェクトのルートディレクトリに移動してから実行してください
cd /Users/kohei/Desktop/ファイルまとめ/kintimeのコピー/kintime-app

rsync -avz \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude '*.md' \
  --exclude 'docs/' \
  --exclude '.DS_Store' \
  --exclude 'scripts/' \
  --exclude '.env.local' \
  -e ssh . root@<新サーバーIP>:/opt/kintime/
```

---

## 4. 新サーバーでの復元（リストア）

新サーバーにSSH接続し、アプリを起動してデータを復元します。

```bash
# 新サーバーにログイン
ssh root@<新サーバーIP>

cd /opt/kintime

# 1. コンテナの起動
docker compose -f docker-compose.prod.yml up -d

# DBが起動するまで30秒ほど待機...

# 2. データベースの復元（リストア）
# -T オプションを忘れないでください
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db mysql -u kintime -p'Kintime_Prod_2026!' kintime

# 3. 画像ディレクトリの権限修正（重要）
# アップロード機能が正常に動くよう権限を設定します
docker compose -f docker-compose.prod.yml exec -u root app chown -R nextjs:nodejs /app/public/uploads
docker compose -f docker-compose.prod.yml exec -u root app chown -R 1001:1001 /app/private-uploads

# 4. アプリケーション再起動
docker compose -f docker-compose.prod.yml restart app
```

---

## 5. 動作確認

ブラウザで新サーバーへアクセスし、以下の点を確認してください。

1. **ログイン**できること（旧サーバーと同じユーザー/パスワードで）
2. **過去のデータ**（勤怠、経費、ユーザー一覧）が表示されること
3. **画像**（経費の領収書など）が表示されること
4. **新規画像アップロード**ができること

以上で移行完了です。
