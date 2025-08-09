"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { hasUserPageAccess } from "@/lib/clientPermissions";
import { PageAccess } from "@/lib/permissions";

interface PageAccessGuardProps {
  page: keyof PageAccess;
  children: React.ReactNode;
  fallbackPath?: string;
}

export default function PageAccessGuard({ 
  page, 
  children, 
  fallbackPath = "/dashboard" 
}: PageAccessGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    try {
      if (!loading && user) {
        if (!hasUserPageAccess(user, page)) {
          router.push(fallbackPath);
        }
      }
    } catch (error) {
      console.error('PageAccessGuard useEffect error:', error);
      router.push(fallbackPath);
    }
  }, [user, loading, page, fallbackPath, router]);

  // ローディング中またはユーザーがいない場合
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // アクセス権限がない場合
  try {
    if (!hasUserPageAccess(user, page)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">アクセス権限がありません</h3>
          <p className="mt-1 text-sm text-gray-500">
            このページにアクセスする権限がありません。
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push(fallbackPath)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    );
    }
  } catch (error) {
    console.error('PageAccessGuard render error:', error);
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-medium text-gray-900">エラーが発生しました</h3>
          <p className="mt-1 text-sm text-gray-500">
            ページの読み込み中にエラーが発生しました。
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push(fallbackPath)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}