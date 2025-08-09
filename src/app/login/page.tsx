"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ページタイトルを設定
  useEffect(() => {
    document.title = "TimeBase - ログイン";
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        router.push("/dashboard");
      }
    } catch (error) {
      // ログインしていない場合は何もしない
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push("/dashboard");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "ログインに失敗しました");
      }
    } catch (error) {
      setError("ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fc]">
      <div className="flex w-full max-w-4xl min-h-[550px] bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* 左側のブランディングパネル */}
        <div className="hidden md:flex md:w-2/5 bg-[#4A90E2] text-white flex-col items-center justify-center p-10 text-center">
          <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center mb-6 shadow-lg">
            <svg className="w-12 h-12 text-[#4A90E2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-4 drop-shadow-sm">TimeBase</h1>
          <p className="text-lg opacity-90 drop-shadow-sm">日々の業務を、よりスマートに。</p>
        </div>

        {/* 右側のログインフォームパネル */}
        <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col justify-center">
          {/* モバイル用ヘッダー */}
          <div className="md:hidden text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-[#4A90E2] rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#4A90E2]">TimeBase</h1>
            </div>
            <p className="text-sm text-gray-600">日々の業務を、よりスマートに。</p>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">ログイン</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-3 focus:ring-[#4A90E2] focus:ring-opacity-20 focus:border-[#4A90E2] transition-all duration-300"
                placeholder="メールアドレスを入力"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-3 focus:ring-[#4A90E2] focus:ring-opacity-20 focus:border-[#4A90E2] transition-all duration-300"
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#4A90E2] hover:bg-[#357ABD] text-white font-bold text-base rounded-lg transition-all duration-300 focus:outline-none focus:ring-3 focus:ring-[#4A90E2] focus:ring-opacity-20 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  ログイン中...
                </div>
              ) : (
                "ログイン"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}