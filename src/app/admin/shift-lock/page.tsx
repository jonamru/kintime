"use client";

import { useState, useEffect } from "react";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import PageAccessGuard from "@/components/PageAccessGuard";
import { showAlert } from '@/lib/notification';
export default function AdminShiftLockPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [lockData, setLockData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLockData();
  }, [currentMonth]);

  const fetchLockData = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/admin/shift-lock?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setLockData(data);
      }
    } catch (error) {
      console.error("ロック状態取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLockAction = async (userId: string, action: 'unlock' | 'lock') => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch("/api/admin/shift-lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          year,
          month,
          action,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showAlert(result.message);
        await fetchLockData();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "操作に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  };

  if (loading || !lockData) {
    return (
      <PageAccessGuard page="shiftLock">
        <div className="min-h-screen bg-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">読み込み中...</div>
        </div>
        </div>
      </PageAccessGuard>
    );
  }

  return (
    <PageAccessGuard page="shiftLock">
      <TimeBaseHeader 
        rightAction={
          <a
            href="/dashboard"
            className="inline-flex items-center px-3 py-2 md:px-4 md:py-2 border border-transparent text-xs md:text-sm font-medium rounded-lg text-white bg-[#4A90E2] hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A90E2] transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="hidden sm:inline">ダッシュボード</span>
            <span className="sm:hidden">ホーム</span>
          </a>
        }
      />
      <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* ヘッダー */}
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">シフト登録ロック管理</h1>
            </div>
            
            {/* 月ナビゲーション */}
            <div className="flex justify-center items-center space-x-4 mb-6">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ← 前月
              </button>
              <h2 className="text-lg font-medium">{formatMonth(currentMonth)}</h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                次月 →
              </button>
            </div>

            {/* 状態表示 */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-800">
                    {formatMonth(currentMonth)}の登録状況
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    登録期限: 毎月{lockData.registrationDeadline}日まで
                    {lockData.deadline && (
                      <span className="ml-2">
                        ({new Date(lockData.deadline).toLocaleDateString('ja-JP')} 23:59)
                      </span>
                    )}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  lockData.isAfterDeadline 
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {lockData.isAfterDeadline ? '期限終了' : '登録期間中'}
                </div>
              </div>
            </div>

            {/* ユーザー一覧 */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      登録状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ロック解除情報
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lockData.users.map((user: any) => (
                    <tr key={user.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.userName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isLocked 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.isLocked ? 'ロック中' : '登録可能'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {user.isUnlocked ? (
                          <div>
                            <div className="text-green-600 font-medium">一時解除中</div>
                            {user.unlockedAt && (
                              <div className="text-xs text-gray-500">
                                解除日時: {new Date(user.unlockedAt).toLocaleString('ja-JP')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        {lockData.isAfterDeadline ? (
                          <div className="flex justify-center space-x-2">
                            {user.isUnlocked ? (
                              <button
                                onClick={() => handleLockAction(user.userId, 'lock')}
                                className="text-red-600 hover:text-red-900"
                              >
                                ロック
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLockAction(user.userId, 'unlock')}
                                className="text-green-600 hover:text-green-900"
                              >
                                解除
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">期限内</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 説明 */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    シフト登録ロックについて
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>毎月{lockData.registrationDeadline}日を過ぎると、ユーザーはシフト登録ができなくなります</li>
                      <li>管理者は個別にユーザーのロックを一時的に解除できます</li>
                      <li>ロック解除は該当月のみ有効です</li>
                      <li>期限内は全ユーザーが自由に登録できます</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* 統計情報 */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-800">
                  {lockData.users.filter((u: any) => !u.isLocked).length}
                </div>
                <div className="text-sm text-green-600">登録可能ユーザー</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-800">
                  {lockData.users.filter((u: any) => u.isLocked).length}
                </div>
                <div className="text-sm text-red-600">ロック中ユーザー</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-800">
                  {lockData.users.filter((u: any) => u.isUnlocked).length}
                </div>
                <div className="text-sm text-blue-600">一時解除中ユーザー</div>
              </div>
            </div>

          </div>
        </div>
      </div>
      </div>

    </PageAccessGuard>
  );
}