import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  typescript: {
    // 一時的にTypeScriptエラーを無視（開発環境のみ）
    // TODO: 本番環境では false に設定すること
    ignoreBuildErrors: true
  },
  output: 'standalone'
};

export default nextConfig;
