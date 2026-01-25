"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import { isUserAdmin, hasUserPageAccess } from "@/lib/clientPermissions";

import type { Attendance, Shift } from "@/types/common";

interface MonthlySummary {
  scheduledWorkDays?: number;
  totalWorkHours?: string;
  workDays?: number;
  lateCount?: number;
  earlyLeaveCount?: number;
  overtimeHours?: string;
  absentDays?: number;
  error?: string;
}

export default function DashboardPage() {
  const { user, loading: _loading } = useAuth();
  const [todayShift, setTodayShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [greeting, setGreeting] = useState<string>("");
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);

  useEffect(() => {
    // ページタイトルを設定
    document.title = "TimeBase - ダッシュボード";

    // 時計の更新
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // 挨拶の更新
    updateGreeting();

    if (user) {
      fetchTodayShift();
      fetchTodayAttendance();
      fetchMonthlySummary();
      fetchMonthlyExpense();
      fetchUpcomingShifts();
    }

    return () => clearInterval(timer);
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

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("おはようございます");
    } else if (hour < 18) {
      setGreeting("こんにちは");
    } else {
      setGreeting("こんばんは");
    }
  };

  const fetchTodayShift = async () => {
    try {
      const response = await fetch("/api/shift/my-today");
      if (response.ok) {
        const data = await response.json();
        setTodayShift(data.shift);
      }
    } catch (error) {
      console.error("今日のシフト取得エラー:", error);
    } finally {
      setShiftLoading(false);
    }
  };

  const fetchUpcomingShifts = async () => {
    try {
      // 明日から3日後までの範囲を計算
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 4);

      const startDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      const endDate = `${threeDaysLater.getFullYear()}-${String(threeDaysLater.getMonth() + 1).padStart(2, '0')}-${String(threeDaysLater.getDate()).padStart(2, '0')}`;

      const response = await fetch(`/api/shift/my-shifts?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const shifts: Shift[] = await response.json();
        // ステータスでフィルタリング（APPROVEDまたはCONFIRMED）
        const upcoming = shifts.filter(shift =>
          (shift.status as string) === 'APPROVED' || shift.status === 'CONFIRMED'
        );
        setUpcomingShifts(upcoming);
      }
    } catch (error) {
      console.error("今後のシフト取得エラー:", error);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await fetch("/api/attendance/today");
      if (response.ok) {
        const data = await response.json();
        setTodayAttendance(data.attendance || []);
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
        setMonthlySummary(data);
      }
    } catch (error) {
      console.error("月次サマリー取得エラー:", error);
    }
  };

  const fetchMonthlyExpense = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const response = await fetch(`/api/expenses/monthly?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setMonthlyExpense(data.total || 0);
      }
    } catch (error) {
      console.error("月次経費取得エラー:", error);
    }
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getWorkStatus = () => {
    if (attendanceLoading || shiftLoading) return { status: "読み込み中...", color: "bg-gray-100 text-gray-600" };

    if (!todayShift) {
      if (todayAttendance && todayAttendance.length > 0) {
        const attendanceTypes = todayAttendance.map(a => a.type);
        if (attendanceTypes.includes('CLOCK_OUT')) return { status: "退勤済み", color: "bg-green-100 text-green-700" };
        if (attendanceTypes.includes('CLOCK_IN')) return { status: "勤務中", color: "bg-blue-100 text-blue-700" };
        if (attendanceTypes.includes('DEPARTURE')) return { status: "出発済み", color: "bg-orange-100 text-orange-700" };
        if (attendanceTypes.includes('WAKE_UP')) return { status: "起床報告済み", color: "bg-yellow-100 text-yellow-700" };
      }
      return { status: "公休日", color: "bg-purple-100 text-purple-700" };
    }

    if (!todayAttendance || todayAttendance.length === 0) {
      return { status: "勤務前", color: "bg-gray-100 text-gray-600" };
    }

    const attendanceTypes = todayAttendance.map(a => a.type);
    if (attendanceTypes.includes('CLOCK_OUT')) return { status: "退勤済み", color: "bg-green-100 text-green-700" };
    if (attendanceTypes.includes('CLOCK_IN')) return { status: "勤務中", color: "bg-blue-100 text-blue-700" };
    if (attendanceTypes.includes('DEPARTURE')) return { status: "出発済み", color: "bg-orange-100 text-orange-700" };
    if (attendanceTypes.includes('WAKE_UP')) return { status: "起床報告済み", color: "bg-yellow-100 text-yellow-700" };

    return { status: "勤務前", color: "bg-gray-100 text-gray-600" };
  };



  const getAttendanceDetails = () => {
    if (!todayAttendance || todayAttendance.length === 0) return [];

    return todayAttendance.map(attendance => {
      const time = formatTime(attendance.clockTime);
      let label: string = attendance.type;
      let icon = null;
      let color = "text-gray-600";
      let bg = "bg-gray-100";

      switch (attendance.type) {
        case 'WAKE_UP':
          label = "起床報告";
          color = "text-yellow-600";
          bg = "bg-yellow-100";
          icon = (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          );
          break;
        case 'DEPARTURE':
          label = "出発報告";
          color = "text-orange-600";
          bg = "bg-orange-100";
          icon = (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          );
          break;
        case 'CLOCK_IN':
          label = "出勤";
          color = "text-blue-600";
          bg = "bg-blue-100";
          icon = (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          );
          break;
        case 'CLOCK_OUT':
          label = "退勤";
          color = "text-green-600";
          bg = "bg-green-100";
          icon = (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          );
          break;
        default:
          break;
      }
      return { label, time, color, bg, icon };
    });
  };

  const getLatestClockInTime = () => {
    const clockIn = todayAttendance.find(a => a.type === 'CLOCK_IN');
    if (!clockIn) return "--:--";
    return formatTime(clockIn.clockTime);
  };

  if (!user) {
    return null;
  }

  const statusInfo = getWorkStatus();
  const attendanceDetails = getAttendanceDetails();
  const progressPercent = monthlySummary && monthlySummary.scheduledWorkDays
    ? Math.min(Math.round(((monthlySummary.workDays || 0) / monthlySummary.scheduledWorkDays) * 100), 100)
    : 0;

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
                  {/* Register Lock Mng */}
                  {hasUserPageAccess(user, 'expenseLock') && (
                    <a
                      href="/admin/expense-lock"
                      className="group flex items-center px-3 py-3 md:py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      経費ロック管理
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

      {/* Main Content matching Prototype */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50/50 ml-0 md:ml-64">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center flex-1 min-w-0 mr-2">
            <button
              className="md:hidden mr-2 p-2 -ml-2 rounded-md text-gray-600 hover:bg-gray-100 flex-shrink-0"
              onClick={() => {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                sidebar?.classList.remove('-translate-x-full');
                overlay?.classList.remove('hidden');
              }}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 leading-tight">
                <span className="block md:inline">{greeting}、</span>
                <span className="block md:inline">{user.name}さん</span>
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1 truncate hidden sm:block">今日の予定を確認しましょう</p>
            </div>
          </div>
          <div className="flex items-center flex-shrink-0">
            <a
              href="/attendance"
              className="bg-[#4A90E2] hover:bg-blue-600 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg text-sm font-medium shadow-md shadow-blue-100 transition-all flex items-center whitespace-nowrap"
            >
              <svg className="w-4 h-4 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden md:inline">打刻画面へ</span>
              <span className="md:hidden">打刻</span>
            </a>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* Row 1: Main Status & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8">
            {/* Today's Status */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full transform transition hover:-translate-y-1 hover:shadow-md duration-300">
              <div className="p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-800 flex items-center">
                    <span className="w-2 h-6 bg-blue-500 rounded-full mr-3"></span>
                    本日の勤務
                    <span className="ml-3 text-sm font-normal text-gray-500">
                      {currentTime.getMonth() + 1}/{currentTime.getDate()}({['日', '月', '火', '水', '木', '金', '土'][currentTime.getDay()]})
                    </span>
                  </h3>
                </div>

                {/* ステータスバッジ - 大きく目立つデザイン */}
                <div className={`mb-4 p-3 rounded-xl text-center ${statusInfo.status === '公休日' ? 'bg-purple-100 border-2 border-purple-300' :
                  statusInfo.status === '勤務中' ? 'bg-blue-100 border-2 border-blue-300' :
                    statusInfo.status === '退勤済み' ? 'bg-green-100 border-2 border-green-300' :
                      statusInfo.status === '勤務前' ? 'bg-gray-100 border-2 border-gray-300' :
                        'bg-gray-100 border-2 border-gray-300'
                  }`}>
                  <span className={`text-lg font-bold ${statusInfo.status === '公休日' ? 'text-purple-700' :
                    statusInfo.status === '勤務中' ? 'text-blue-700' :
                      statusInfo.status === '退勤済み' ? 'text-green-700' :
                        statusInfo.status === '勤務前' ? 'text-gray-600' :
                          'text-gray-600'
                    }`}>
                    {statusInfo.status === '公休日' ? '🏖️ 公休日' :
                      statusInfo.status === '勤務中' ? '💼 勤務中' :
                        statusInfo.status === '退勤済み' ? '✅ 退勤済み' :
                          statusInfo.status === '勤務前' ? '⏰ 勤務前' :
                            statusInfo.status}
                  </span>
                </div>

                {/* 勤務時間・勤務地情報 */}
                {todayShift && (
                  <div className="bg-blue-50/70 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        勤務時間
                      </span>
                      <span className="font-bold text-gray-800">
                        {new Date(todayShift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        {' 〜 '}
                        {new Date(todayShift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {todayShift.location && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          勤務地
                        </span>
                        <span className="font-bold text-gray-800">{todayShift.location}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 現在時刻 */}
                <div className="flex flex-col items-center justify-center py-4 bg-gray-50 rounded-xl mb-4">
                  <span className="text-gray-500 text-sm mb-1">現在の時刻</span>
                  <span className="text-3xl font-bold text-gray-900 tracking-tight">
                    {currentTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {todayAttendance && todayAttendance.some(a => a.type === 'CLOCK_IN') && (
                    <span className="text-sm text-blue-600 font-medium mt-1">
                      出勤: {getLatestClockInTime()} 〜
                    </span>
                  )}
                </div>

                {/* 打刻履歴 */}
                <div className="space-y-3">
                  {attendanceDetails.length > 0 ? (
                    attendanceDetails.map((detail, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 ${detail.bg} ${detail.color}`}>
                            {detail.icon ||
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            }
                          </div>
                          <span className="text-sm text-gray-600">{detail.label}</span>
                        </div>
                        <span className="font-bold text-gray-800">{detail.time}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm text-gray-400 py-2">本日の打刻はありません</p>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full transform transition hover:-translate-y-1 hover:shadow-md duration-300">
              <div className="p-6 flex-1">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg text-gray-800 flex items-center">
                    <span className="w-2 h-6 bg-green-500 rounded-full mr-3"></span>
                    月次サマリー
                  </h3>
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">稼働日数</span>
                      <span className="font-bold text-gray-800">{monthlySummary?.workDays || 0} / {monthlySummary?.scheduledWorkDays || 0}日</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-xs text-gray-500 mb-1">遅刻</p>
                      <p className="text-xl font-bold text-gray-900">{monthlySummary?.lateCount || 0} <span
                        className="text-xs font-normal text-gray-400">回</span></p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-xs text-gray-500 mb-1">欠勤</p>
                      <p className="text-xl font-bold text-gray-900">{monthlySummary?.absentDays || 0} <span
                        className="text-xs font-normal text-gray-400">回</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Row 2: Stats & Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Upcoming Shifts - 今後の出勤予定 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-700">今後の出勤予定</p>
              </div>
              <div className="space-y-2">
                {upcomingShifts.length > 0 ? (
                  upcomingShifts.slice(0, 3).map((shift, index) => {
                    const shiftDate = new Date(shift.date);
                    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][shiftDate.getDay()];
                    return (
                      <div key={index} className="text-sm py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 font-medium">
                            {shiftDate.getMonth() + 1}/{shiftDate.getDate()}({dayOfWeek})
                          </span>
                          <span className="text-gray-800 font-medium">
                            {new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            〜
                            {new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {shift.location && (
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {shift.location}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">予定なし</p>
                )}
              </div>
            </div>

            {/* Expense */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-500">今月の経費精算</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">¥ {monthlyExpense.toLocaleString()}</p>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden flex flex-col h-full transform transition hover:-translate-y-1 hover:shadow-md duration-300">
              <div className="p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-800 flex items-center">
                    <span className="w-2 h-6 bg-purple-500 rounded-full mr-3"></span>
                    クイックアクション
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <a href="/attendance/history" className="flex items-center p-3.5 bg-white border border-purple-100 rounded-xl shadow-sm hover:shadow-md hover:border-purple-300 transition-all group">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-gray-800">打刻履歴</span>
                    </div>
                  </a>
                  <a href="/shift/request" className="flex items-center p-3.5 bg-white border border-green-100 rounded-xl shadow-sm hover:shadow-md hover:border-green-300 transition-all group">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-gray-800">シフト申請</span>
                    </div>
                  </a>
                  <a href="/expense/monthly" className="flex items-center p-3.5 bg-white border border-orange-100 rounded-xl shadow-sm hover:shadow-md hover:border-orange-300 transition-all group">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-gray-800">経費精算</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

        </div >
      </main >
    </div >
  );
}