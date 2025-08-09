"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import { isUserAdmin, hasUserPageAccess } from "@/lib/clientPermissions";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [todayShift, setTodayShift] = useState<any>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    // ページタイトルを設定
    document.title = "TimeBase - ダッシュボード";
    
    if (user) {
      fetchTodayShift();
      fetchTodayAttendance();
      fetchMonthlySummary();
    }
  }, [user]);

  useEffect(() => {
    // サイドバーの外部クリックで閉じる & メニューリンククリックで閉じる
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const menuButton = event.target as Element;
      const overlay = document.getElementById('sidebar-overlay');
      
      if (sidebar && !sidebar.contains(event.target as Node) && 
          !menuButton.closest('button[class*="md:hidden"]')) {
        sidebar.classList.add('-translate-x-full');
        overlay?.classList.add('hidden');
      }
    };

    const handleMenuClick = (event: MouseEvent) => {
      const target = event.target as Element;
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      
      // スマホでメニューリンクをクリックした場合、サイドバーを閉じる
      if (target.closest('a') && window.innerWidth < 768) {
        sidebar?.classList.add('-translate-x-full');
        overlay?.classList.add('hidden');
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('click', handleMenuClick);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('click', handleMenuClick);
    };
  }, []);

  const fetchTodayShift = async () => {
    try {
      const response = await fetch("/api/shift/my-today");
      if (response.ok) {
        const data = await response.json();
        console.log("ダッシュボード - 取得したシフトデータ:", data);
        setTodayShift(data.shift);
      } else {
        console.error("シフト取得APIエラー:", response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error("エラー詳細:", errorData);
      }
    } catch (error) {
      console.error("今日のシフト取得エラー:", error);
    } finally {
      setShiftLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await fetch("/api/attendance/today");
      if (response.ok) {
        const data = await response.json();
        console.log("ダッシュボード - 取得した本日の勤怠:", data);
        setTodayAttendance(data.attendance || []);
      } else {
        console.error("本日勤怠取得APIエラー:", response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error("エラー詳細:", errorData);
      }
    } catch (error) {
      console.error("本日勤怠取得エラー:", error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchMonthlySummary = async () => {
    try {
      const response = await fetch("/api/attendance/monthly-summary");
      if (response.ok) {
        const data = await response.json();
        console.log("ダッシュボード - 取得した月次サマリー:", data);
        setMonthlySummary(data);
      } else {
        console.error("月次サマリー取得APIエラー:", response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error("エラー詳細:", errorData);
      }
    } catch (error) {
      console.error("月次サマリー取得エラー:", error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getWorkStatus = () => {
    if (attendanceLoading || shiftLoading) return { status: "読み込み中...", color: "text-gray-500" };
    
    // シフトが登録されていない場合は公休日
    if (!todayShift) {
      // ただし打刻がある場合は打刻状況を表示
      if (todayAttendance && todayAttendance.length > 0) {
        const attendanceTypes = todayAttendance.map(a => a.type);
        const hasWakeUp = attendanceTypes.includes('WAKE_UP');
        const hasDeparture = attendanceTypes.includes('DEPARTURE');
        const hasClockIn = attendanceTypes.includes('CLOCK_IN');
        const hasClockOut = attendanceTypes.includes('CLOCK_OUT');

        if (hasClockOut) {
          return { status: "退勤済み", color: "text-green-600" };
        } else if (hasClockIn) {
          return { status: "勤務中", color: "text-blue-600" };
        } else if (hasDeparture) {
          return { status: "出発済み", color: "text-orange-600" };
        } else if (hasWakeUp) {
          return { status: "起床報告済み", color: "text-yellow-600" };
        }
      }
      return { status: "公休日", color: "text-purple-600" };
    }

    // シフトがある場合の打刻状況確認
    if (!todayAttendance || todayAttendance.length === 0) {
      return { status: "勤務前", color: "text-gray-600" };
    }

    const attendanceTypes = todayAttendance.map(a => a.type);
    const hasWakeUp = attendanceTypes.includes('WAKE_UP');
    const hasDeparture = attendanceTypes.includes('DEPARTURE');
    const hasClockIn = attendanceTypes.includes('CLOCK_IN');
    const hasClockOut = attendanceTypes.includes('CLOCK_OUT');

    if (hasClockOut) {
      return { status: "退勤済み", color: "text-green-600" };
    } else if (hasClockIn) {
      return { status: "勤務中", color: "text-blue-600" };
    } else if (hasDeparture) {
      return { status: "出発済み", color: "text-orange-600" };
    } else if (hasWakeUp) {
      return { status: "起床報告済み", color: "text-yellow-600" };
    }

    return { status: "勤務前", color: "text-gray-600" };
  };

  const getAttendanceDetails = () => {
    if (!todayAttendance || todayAttendance.length === 0) return [];
    
    return todayAttendance.map(attendance => {
      const time = formatTime(attendance.clockTime);
      switch (attendance.type) {
        case 'WAKE_UP':
          return { label: "起床報告", time, color: "text-yellow-600" };
        case 'DEPARTURE':
          return { label: "出発報告", time, color: "text-orange-600" };
        case 'CLOCK_IN':
          return { label: "出勤", time, color: "text-blue-600" };
        case 'CLOCK_OUT':
          return { label: "退勤", time, color: "text-green-600" };
        default:
          return { label: attendance.type, time, color: "text-gray-600" };
      }
    });
  };

  if (!user) {
    return null; // AuthProviderがリダイレクトを処理
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* モバイル用オーバーレイ */}
      <div 
        id="sidebar-overlay"
        className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden hidden"
        onClick={() => {
          const sidebar = document.getElementById('sidebar');
          const overlay = document.getElementById('sidebar-overlay');
          sidebar?.classList.add('-translate-x-full');
          overlay?.classList.add('hidden');
        }}
      />
      
      {/* サイドバー */}
      <aside className="w-64 bg-white shadow-lg fixed left-0 top-0 h-full z-50 transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out" id="sidebar">
        <div className="flex flex-col h-full">
          {/* ロゴ・タイトル - 固定ヘッダー */}
          <div className="px-4 md:px-6 py-3 md:py-6 border-b border-gray-100 flex-shrink-0">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <div className="w-8 h-8 bg-[#4A90E2] rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-lg md:text-2xl font-bold text-[#4A90E2]">TimeBase</h1>
              </div>
              <p className="text-xs text-gray-500 hidden md:block">勤怠管理システム</p>
            </div>
          </div>

          {/* ナビゲーションメニュー - スクロール可能エリア */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 relative">
            {/* スクロール可能インジケーター（スマホのみ） */}
            <div className="md:hidden absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white to-transparent pointer-events-none z-10"></div>
            {/* 勤怠管理 */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">勤怠管理</h3>
              <div className="space-y-2">
                <a
                  href="/dashboard"
                  className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-white bg-[#4A90E2] hover:bg-blue-600 rounded-lg"
                >
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  ダッシュボード
                </a>
{hasUserPageAccess(user, 'attendance') && (
                  <a
                    href="/attendance"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    打刻
                  </a>
                )}
                {hasUserPageAccess(user, 'attendanceHistory') && (
                  <a
                    href="/attendance/history"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    勤怠履歴
                  </a>
                )}
              </div>
            </div>

            {/* シフト管理 */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">シフト管理</h3>
              <div className="space-y-2">
                {hasUserPageAccess(user, 'shiftRequest') && (
                  <a
                    href="/shift/request"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    シフト申請
                  </a>
                )}
                {hasUserPageAccess(user, 'shiftWorkers') && (
                  <a
                    href="/shift/workers"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    出勤者管理
                  </a>
                )}
                {hasUserPageAccess(user, 'shiftOverview') && (
                  <a
                    href="/shift/overview"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    シフト一覧
                  </a>
                )}
                {hasUserPageAccess(user, 'shiftRegister') && (
                  <a
                    href="/admin/shift-register"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    シフト登録
                  </a>
                )}
                {hasUserPageAccess(user, 'shiftLock') && (
                  <a
                    href="/admin/shift-lock"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    登録ロック管理
                  </a>
                )}
              </div>
            </div>

            {/* 経費管理 */}
            {(hasUserPageAccess(user, 'expense') || hasUserPageAccess(user, 'expenseMonthly')) && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">経費管理</h3>
                <div className="space-y-2">
                  {hasUserPageAccess(user, 'expense') && (
                    <a
                      href="/expense"
                      className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      交通費・経費登録
                    </a>
                  )}
                  {hasUserPageAccess(user, 'expenseMonthly') && (
                    <a
                      href="/expense/monthly"
                      className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      月次一覧
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* レポート */}
            {hasUserPageAccess(user, 'reports') && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">レポート</h3>
                <div className="space-y-2">
                  <a
                    href="/reports"
                    className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    勤務・経費レポート
                  </a>
                </div>
              </div>
            )}

            {/* 管理者メニュー */}
            {isUserAdmin(user) && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">管理者メニュー</h3>
                <div className="space-y-2">
                  {hasUserPageAccess(user, 'adminUsers') && (
                    <a
                      href="/admin/users"
                      className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      ユーザー管理
                    </a>
                  )}
                  {hasUserPageAccess(user, 'adminSystem') && (
                    <a
                      href="/admin/system"
                      className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      システム設定
                    </a>
                  )}
                  {hasUserPageAccess(user, 'adminPartners') && (
                    <a
                      href="/admin/partners"
                      className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M8 6a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V8a2 2 0 00-2-2" />
                      </svg>
                      パートナー管理
                    </a>
                  )}
                  {hasUserPageAccess(user, 'bulkEdit') && (
                    <a
                      href="/admin/bulk-edit"
                      className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      一括修正管理
                    </a>
                  )}
                </div>
              </div>
            )}
          </nav>

          {/* ユーザープロフィール・ログアウト - 固定フッター */}
          <div className="border-t border-gray-200 p-4 flex-shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0 flex-1">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 md:h-8 md:w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-2 md:ml-3 min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-700 truncate">{user.name}</p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm">
          <div className="px-4 md:px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <button 
                  className="md:hidden mr-3 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => {
                    const sidebar = document.getElementById('sidebar');
                    const overlay = document.getElementById('sidebar-overlay');
                    if (sidebar && overlay) {
                      sidebar.classList.toggle('-translate-x-full');
                      overlay.classList.toggle('hidden');
                    }
                  }}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">ダッシュボード</h1>
              </div>
{hasUserPageAccess(user, 'attendance') && (
                <a
                  href="/attendance"
                  className="inline-flex items-center px-3 py-2 md:px-4 md:py-2 border border-transparent text-xs md:text-sm font-medium rounded-lg text-white bg-[#4A90E2] hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A90E2] transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <svg className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">出勤打刻</span>
                  <span className="sm:hidden">打刻</span>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* カードグリッド */}
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* 本日の勤務情報 */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-1">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M8 6a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V8a2 2 0 00-2-2" />
                  </svg>
                </div>
                <h3 className="ml-3 text-base md:text-lg font-semibold text-gray-900">本日の勤務情報</h3>
              </div>
              <div className="space-y-2">
                {/* 勤務状況 */}
                <div className="mb-3">
                  <p className="text-gray-600">ステータス: 
                    <span className={`font-medium ml-1 ${getWorkStatus().color}`}>
                      {getWorkStatus().status}
                    </span>
                  </p>
                </div>

                {/* 打刻詳細 */}
                {getAttendanceDetails().length > 0 && (
                  <div className="space-y-1 mb-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">打刻履歴</p>
                    {getAttendanceDetails().map((detail, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className={`font-medium ${detail.color}`}>{detail.label}</span>
                        <span className="text-gray-600">{detail.time}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* シフト情報 */}
                {shiftLoading ? (
                  <p className="text-gray-500 text-sm">シフト情報読み込み中...</p>
                ) : todayShift ? (
                  <div className="space-y-1 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">予定シフト</p>
                    <p className="text-sm text-gray-600">勤務時間: <span className="font-medium text-gray-900">{formatTime(todayShift.startTime)} - {formatTime(todayShift.endTime)}</span></p>
                    <p className="text-sm text-gray-600">勤務地: <span className="font-medium text-gray-900">{todayShift.location}</span></p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm pt-2 border-t border-gray-100">本日のシフトは登録されていません</p>
                )}
              </div>
            </div>

            {/* 今月の勤怠サマリー */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-1">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="ml-3 text-base md:text-lg font-semibold text-gray-900">今月の勤怠サマリー</h3>
              </div>
              <div className="space-y-2">
                {summaryLoading ? (
                  <p className="text-gray-500">読み込み中...</p>
                ) : monthlySummary ? (
                  <>
                    <p className="text-gray-600">シフト登録日数: <span className="font-medium text-blue-600">{monthlySummary.scheduledWorkDays || 0}日</span></p>
                    <p className="text-gray-600">総労働時間: <span className="font-medium text-gray-900">{monthlySummary.totalWorkHours || "0:00"}</span></p>
                    <p className="text-gray-600">出勤日数: <span className="font-medium text-gray-900">{monthlySummary.workDays || 0}日</span></p>
                    <p className="text-gray-600">遅刻回数: <span className="font-medium text-gray-900">{monthlySummary.lateCount || 0}回</span></p>
                    <p className="text-gray-600">欠勤日数: <span className="font-medium text-red-600">{monthlySummary.absentDays || 0}日</span></p>
                    {monthlySummary.error && (
                      <p className="text-xs text-orange-600">⚠️ {monthlySummary.error}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-gray-600">シフト登録日数: <span className="font-medium text-blue-600">0日</span></p>
                    <p className="text-gray-600">総労働時間: <span className="font-medium text-gray-900">0:00</span></p>
                    <p className="text-gray-600">出勤日数: <span className="font-medium text-gray-900">0日</span></p>
                    <p className="text-gray-600">遅刻回数: <span className="font-medium text-gray-900">0回</span></p>
                    <p className="text-gray-600">欠勤日数: <span className="font-medium text-red-600">0日</span></p>
                    <p className="text-xs text-gray-500">データを取得できませんでした</p>
                  </>
                )}
              </div>
            </div>

            {/* クイックアクション */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-1">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="ml-3 text-base md:text-lg font-semibold text-gray-900">クイックアクション</h3>
              </div>
              <div className="space-y-2 md:space-y-3">
{hasUserPageAccess(user, 'attendance') && (
                  <a
                    href="/attendance"
                    className="block w-full text-center px-3 py-2 md:px-4 md:py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm md:text-base"
                  >
                    打刻する
                  </a>
                )}
                {hasUserPageAccess(user, 'shiftRequest') && (
                  <a
                    href="/shift/request"
                    className="block w-full text-center px-3 py-2 md:px-4 md:py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm md:text-base"
                  >
                    シフト申請
                  </a>
                )}
                {hasUserPageAccess(user, 'expense') && (
                  <a
                    href="/expense"
                    className="block w-full text-center px-3 py-2 md:px-4 md:py-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors text-sm md:text-base"
                  >
                    経費登録
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}