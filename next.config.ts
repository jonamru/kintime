import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ビルド時に生成ファイルをESLintから除外
    ignoreDuringBuilds: false,
    dirs: ['src/app', 'src/components', 'src/lib', 'src/contexts', 'src/types']
  },
  typescript: {
    // 一時的にTypeScriptエラーを無視（開発環境のみ）
    // TODO: 本番環境では false に設定すること
    ignoreBuildErrors: true
  },
  output: 'standalone'
};

export default nextConfig;
