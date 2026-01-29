FROM node:20-alpine AS base

# 依存関係ステージ
FROM base AS deps
WORKDIR /app

# システムパッケージのインストール（ネイティブモジュール用）
RUN apk add --no-cache libc6-compat

# パッケージ定義のみコピー
COPY package.json package-lock.json ./
# 依存関係インストール
RUN npm ci

# ビルダー ステージ
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 環境変数をビルド時に注入しない（Next.jsのクライアントサイド定数などが影響受けるため注意）
# サーバーサイドのシークレットはランタイム環境変数で設定
ENV NEXT_TELEMETRY_DISABLED=1

# ビルドを通すためのダミー環境変数（ランタイムでは上書きされる）
ENV JWT_SECRET="build_time_secret"
ENV NEXTAUTH_SECRET="build_time_secret"
ENV DATABASE_URL="mysql://db:3306/dummy"
ENV JWT_SECRET_STRING="build_time_secret"

# Prismaクライアント生成
RUN npx prisma generate

# ビルド実行
RUN npm run build

# ランナー ステージ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# システムユーザーの作成
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Puppeteer用の依存関係とタイムゾーンデータをインストール（Alpine版）
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk \
    tzdata

# タイムゾーンを設定
ENV TZ=Asia/Tokyo

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# public配下と.next/staticをコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# standalone出力結果をコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# アップロードディレクトリ作成
RUN mkdir -p /app/private-uploads && chown -R nextjs:nodejs /app/private-uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]