# 🔐 セキュリティセットアップガイド

このガイドでは、本番環境にデプロイする前に必要なセキュリティ設定を説明します。

---

## 📋 環境変数の設定

### ローカル開発環境

1. **`.env`ファイルを作成**（既に作成済み）

ローカル開発では、`.env`ファイルが自動的に読み込まれます。

```bash
# .envファイルの内容（開発用の一時的な値）
DATABASE_URL="mysql://root@localhost:3306/kintime"
JWT_SECRET=local-dev-jwt-secret-change-in-production
NEXTAUTH_SECRET=local-dev-secret-not-for-production
NODE_ENV=development
```

> ⚠️ **警告**: 上記の値は開発用です。本番環境では絶対に使用しないでください。

---

### 本番環境のセットアップ

#### ステップ1: 強力なシークレットキーを生成

**方法1: OpenSSLを使用**
```bash
openssl rand -base64 32
```

**方法2: Node.jsを使用**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**出力例**:
```
xK8fJ2nP4vL9qR6uY3wE1sT7mN0cA5hG8bD2fV4xZ9i=
```

#### ステップ2: 本番環境の環境変数を設定

**オプション1: サーバーの環境変数として設定（推奨）**

```bash
export DATABASE_URL="mysql://username:password@production-db-host:3306/kintime_production"
export JWT_SECRET="xK8fJ2nP4vL9qR6uY3wE1sT7mN0cA5hG8bD2fV4xZ9i="
export NEXTAUTH_SECRET="aB3cD5eF7gH9iJ1kL2mN4oP6qR8sT0uV2wX4yZ6aB8c="
export NODE_ENV="production"
```

**オプション2: クラウドプロバイダーのシークレット管理サービス**

- **AWS**: [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- **Google Cloud**: [Secret Manager](https://cloud.google.com/secret-manager)
- **Azure**: [Azure Key Vault](https://azure.microsoft.com/services/key-vault/)
- **Vercel**: [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

#### ステップ3: データベース接続文字列の設定

**フォーマット**:
```
mysql://[ユーザー名]:[パスワード]@[ホスト名]:[ポート]/[データベース名]
```

**例**:
```bash
DATABASE_URL="mysql://kintime_user:StrongPassword123!@db.example.com:3306/kintime_production"
```

---

## 🔒 HTTPS設定

### 開発環境（自己署名証明書）

既に`certificates/`ディレクトリに開発用の証明書が存在します。

**起動コマンド**:
```bash
npm run dev:https
```

### 本番環境

**Let's Encryptを使用した無料SSL証明書の取得**:

```bash
# Certbotのインストール（Ubuntu/Debian）
sudo apt install certbot

# 証明書の取得
sudo certbot certonly --standalone -d yourdomain.com

# 証明書の自動更新設定
sudo certbot renew --dry-run
```

**Nginxを使用したリバースプロキシ設定** (`nginx/conf.d/kintime.conf`):
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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

# HTTPからHTTPSへのリダイレクト
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🛡️ セキュリティチェックリスト

デプロイ前に以下を確認してください:

### 環境変数
- [ ] `JWT_SECRET`が強力なランダム値に設定されている
- [ ] `NEXTAUTH_SECRET`が強力なランダム値に設定されている
- [ ] `DATABASE_URL`に本番環境のDB接続情報が設定されている
- [ ] `NODE_ENV=production`が設定されている
- [ ] `.env`ファイルがGitにコミットされていない（`.gitignore`で除外されている）

### HTTPS/SSL
- [ ] HTTPSが有効化されている
- [ ] 有効なSSL証明書がインストールされている
- [ ] HTTPからHTTPSへのリダイレクトが設定されている

### Cookie設定
- [ ] `secure: true`に設定されている（自動: `NODE_ENV=production`で有効）
- [ ] `sameSite: "strict"`が設定されている（既に修正済み）
- [ ] `httpOnly: true`が設定されている（既に設定済み）

### データベース
- [ ] 本番DBユーザーに最小限の権限のみ付与
- [ ] データベースのバックアップが設定されている
- [ ] DBへのアクセスがファイアウォールで制限されている

### 依存関係
- [ ] `npm audit`で脆弱性がない
```bash
npm audit
# 修正が可能な場合
npm audit fix
```

### アプリケーション
- [ ] エラーログが適切に記録されている
- [ ] 本番環境で詳細なエラーメッセージが表示されない
- [ ] レート制限が実装されている（今後の実装推奨）

---

## 🚀 デプロイ手順

### 1. ビルドテスト

```bash
# 依存関係のインストール
npm install

# データベースマイグレーション
npm run db:migrate

# 本番ビルド
npm run build

# ビルドが成功することを確認
ls -la .next/
```

### 2. 本番環境での起動

```bash
# 環境変数を設定
export NODE_ENV=production
export DATABASE_URL="..."
export JWT_SECRET="..."

# 本番サーバー起動
npm start
```

**または systemd サービスとして設定**:

`/etc/systemd/system/kintime.service`:
```ini
[Unit]
Description=Kintime App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/kintime-app
Environment="NODE_ENV=production"
Environment="DATABASE_URL=mysql://..."
Environment="JWT_SECRET=..."
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# サービスの有効化と起動
sudo systemctl enable kintime
sudo systemctl start kintime
sudo systemctl status kintime
```

---

## 📞 セキュリティインシデント対応

もしセキュリティ問題が発生した場合:

1. **即座にサービスを停止**
   ```bash
   sudo systemctl stop kintime
   ```

2. **JWT_SECRETをローテーション**
   - 新しいシークレットキーを生成
   - 環境変数を更新
   - 全ユーザーが再ログイン必要

3. **ログを確認**
   ```bash
   # アプリケーションログ
   journalctl -u kintime -n 1000
   
   # Nginxアクセスログ
   sudo tail -f /var/log/nginx/access.log
   ```

4. **データベースのバックアップを確認**

5. **必要に応じてパスワードリセット**

---

## 📚 参考リンク

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/security)
- [Let's Encrypt](https://letsencrypt.org/)

---

**最終更新**: 2026-01-25  
**次回レビュー**: セキュリティ設定は定期的に見直してください
