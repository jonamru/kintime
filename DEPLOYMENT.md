# Kintime Deployment Guide

このガイドは、Kintimeアプリケーションを新しいVPSサーバーにデプロイする手順を説明します。
付属の `deploy.sh` スクリプトを使用することで、SSL証明書の取得やNginxの設定を自動化できます。

## 前提条件

1.  **VPSサーバー**: Ubuntu等のLinuxサーバー
2.  **Docker**: インストール済みであること
3.  **Docker Compose**: インストール済みであること (v2推奨)
4.  **ドメイン設定**: デプロイするドメイン (`timebase.alphadoor.jp`) のAレコードがVPSのIPアドレスに向けられていること

## ファイルの配置

プロジェクトファイル一式をVPSの `/opt/kintime` (または任意のディレクトリ) に配置してください。
`git clone` または `scp/rsync` を使用します。

例:
```bash
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' ./ root@YOUR_VPS_IP:/opt/kintime/
```

## デプロイ手順

### 1. サーバーへログイン
```bash
ssh root@YOUR_VPS_IP
cd /opt/kintime
```

### 2. 環境変数の設定
`.env.production` が存在することを確認してください。なければ `.env.example` からコピーして作成します。
```bash
cp .env.example .env.production
nano .env.production
# 必要な値を設定...
```

### 3. スクリプトの実行
`deploy.sh` に実行権限を与え、実行します。

```bash
chmod +x deploy.sh
./deploy.sh
```

このスクリプトは以下の処理を自動で行います：
1.  必要なディレクトリ (`nginx/webroot`, `private-uploads` 等) の作成
2.  アップロードディレクトリの権限設定
3.  HTTP設定でのNginx起動
4.  CertbotによるSSL証明書の取得
5.  HTTPS設定への切り替え
6.  全コンテナの再起動

### 4. 確認
ブラウザで `https://timebase.alphadoor.jp` にアクセスし、ログイン画面が表示されるか確認してください。

## トラブルシューティング

### 502 Bad Gateway
- Nginxのログを確認: `docker logs kintime-nginx`
- アプリのログを確認: `docker logs kintime-app`
- Node.jsアプリとの接続で `Connection: upgrade` ヘッダーが問題になることがあります (スクリプトで対策済み)。

### SSL証明書取得エラー
- ドメインのDNS設定が正しいか再確認してください。
- 以前の証明書取得回数が上限に達している可能性があります (Let's Encryptの制限)。

### 画像アップロードエラー
- `private-uploads` ディレクトリの権限を確認してください。
