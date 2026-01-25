FROM node:20-alpine

WORKDIR /app

# システムに必要なパッケージのインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteer用のChromiumパス設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係のインストール（本番ビルドにはdevDependenciesも必要）
RUN npm ci && npm cache clean --force

# Prismaスキーマをコピー
COPY prisma ./prisma/

# Prismaクライアント生成
RUN npx prisma generate

# アプリケーションコードをコピー
COPY . .

# ビルド時の環境変数を設定（ダミー値）
ENV DATABASE_URL="mysql://user:pass@host:3306/db" \
    NEXTAUTH_URL="http://localhost:3000" \
    NEXTAUTH_SECRET="build-time-secret" \
    JWT_SECRET="build-time-jwt-secret"

# Next.jsアプリケーションのビルド
RUN npm run build

# standaloneモード用の静的ファイルをコピー
RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public && \
    cp -r prisma .next/standalone/prisma

# アップロードディレクトリの作成と権限設定
RUN mkdir -p /app/public/uploads/commute-passes && \
    chmod -R 755 /app/public/uploads

# 非rootユーザーの作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# ファイルの所有権を変更
RUN chown -R nextjs:nodejs /app
USER nextjs

# standaloneディレクトリに移動
WORKDIR /app/.next/standalone

# ポートを公開
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/auth/me || exit 1

# アプリケーション起動
CMD ["node", "server.js"]