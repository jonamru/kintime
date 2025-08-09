"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import { showAlert } from '@/lib/notification';
import { isUserAdmin } from "@/lib/clientPermissions";
import PageAccessGuard from "@/components/PageAccessGuard";
interface Worker {
  shift: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    shiftType: string;
    location: string;
  };
  user: {
    id: string;
    userId?: string;
    name: string;
    email: string;
    wakeUpEnabled: boolean;
    departureEnabled: boolean;
    partner: {
      name: string;
    } | null;
  };
  attendances: any[];
  attendanceStatus: string;
  clockInTime?: string;
  clockOutTime?: string;
}

interface WorkersData {
  date: string;
  totalWorkers: number;
  workers: Worker[];
}


interface ForceClockModalProps {
  worker: Worker;
  selectedDate: string; // YYYY-MM-DD形式
  onClose: () => void;
  onSuccess: () => void;
}

// 強制打刻モーダルコンポーネント
function ForceClockModal({ worker, selectedDate, onClose, onSuccess }: ForceClockModalProps) {
  const [type, setType] = useState<'CLOCK_IN' | 'CLOCK_OUT' | 'WAKE_UP' | 'DEPARTURE'>('CLOCK_IN');
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const [loading, setLoading] = useState(false);

  // 利用可能な打刻タイプを取得
  const getAvailableTypes = () => {
    const types = [];
    
    // 固定順序で追加: 起床 → 出発 → 出勤 → 退勤
    if (worker.user.wakeUpEnabled) {
      types.push({ value: 'WAKE_UP', label: '起床' });
    }
    
    if (worker.user.departureEnabled) {
      types.push({ value: 'DEPARTURE', label: '出発' });
    }
    
    types.push({ value: 'CLOCK_IN', label: '出勤' });
    types.push({ value: 'CLOCK_OUT', label: '退勤' });
    
    return types;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const [hours, minutes] = clockTime.split(':').map(Number);
      
      // 選択された日付に時刻を設定
      const [year, month, day] = selectedDate.split('-').map(Number);
      const clockDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      const response = await fetch('/api/admin/attendance/force-clock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: worker.user.id,
          type,
          clockTime: clockDateTime,
        }),
      });

      if (response.ok) {
        const typeLabels = {
          'CLOCK_IN': '出勤',
          'CLOCK_OUT': '退勤',
          'WAKE_UP': '起床',
          'DEPARTURE': '出発'
        };
        showAlert(`${worker.user.name}の${typeLabels[type]}を記録しました`);
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        showAlert(error.error || '打刻に失敗しました');
      }
    } catch (error) {
      showAlert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            強制打刻
          </h3>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              ユーザー: {worker.user.name}
            </p>
            <p className="text-sm text-gray-600">
              日付: {selectedDate}
            </p>
            <p className="text-sm text-gray-600">
              シフト時間: {new Date(worker.shift.startTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} - {new Date(worker.shift.endTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                打刻タイプ
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                {getAvailableTypes().map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                打刻時刻
              </label>
              <input
                type="time"
                value={clockTime}
                onChange={(e) => setClockTime(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {loading ? "処理中..." : "打刻"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const { user } = useAuth();
  const [workersData, setWorkersData] = useState<WorkersData | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [loading, setLoading] = useState(false);
  const [showForceClockModal, setShowForceClockModal] = useState(false);
  const [selectedWorkerForClock, setSelectedWorkerForClock] = useState<Worker | null>(null);

  useEffect(() => {
    if (user) {
      fetchWorkers();
    }
  }, [user, selectedDate]);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/shift/today-workers?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setWorkersData(data);
      } else {
        console.error("出勤者データの取得に失敗しました");
      }
    } catch (error) {
      console.error("出勤者データの取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    // YYYY-MM-DD形式の日付文字列をローカルタイムゾーンで正確に解釈
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "退勤済み":
        return "bg-gray-100 text-gray-800";
      case "出勤中":
        return "bg-green-100 text-green-800";
      case "出発済み":
        return "bg-blue-100 text-blue-800";
      case "起床済み":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  const handleForceClock = (worker: Worker) => {
    setSelectedWorkerForClock(worker);
    setShowForceClockModal(true);
  };

  const isAdmin = user && isUserAdmin(user);

  if (!user) {
    return null;
  }

  return (
    <PageAccessGuard page="shiftWorkers">
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
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">出勤者管理</h1>
            </div>

            {/* 日付選択 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                日付を選択
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">読み込み中...</div>
              </div>
            ) : workersData ? (
              <div>
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h2 className="text-lg font-medium text-blue-900">
                    {formatDate(workersData.date)}の出勤状況
                  </h2>
                  <p className="text-sm text-blue-700 mt-1">
                    出勤予定者: {workersData.totalWorkers}名
                  </p>
                </div>

                {workersData.workers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500">この日の出勤予定者はいません</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ユーザー
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            シフト時間
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            勤務地
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            打刻状況
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            出勤時刻
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            退勤時刻
                          </th>
                          {isAdmin && (
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              管理者操作
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {workersData.workers.map((worker) => (
                          <tr key={worker.shift.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {worker.user.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {worker.user.userId || worker.user.email}
                                </div>
                                {worker.user.partner && (
                                  <div className="text-xs text-gray-400">
                                    {worker.user.partner.name}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatTime(worker.shift.startTime)} - {formatTime(worker.shift.endTime)}
                              <div className="text-xs text-gray-500">
                                {worker.shift.shiftType === "REGULAR" ? "通常" : "スポット"}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {worker.shift.location}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(worker.attendanceStatus)}`}>
                                {worker.attendanceStatus}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                              {worker.clockInTime ? formatTime(worker.clockInTime) : "-"}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                              {worker.clockOutTime ? formatTime(worker.clockOutTime) : "-"}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <div className="flex justify-center space-x-2">
                                  <button
                                    onClick={() => handleForceClock(worker)}
                                    className="text-indigo-600 hover:text-indigo-900 text-xs"
                                  >
                                    強制打刻
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500">データを読み込めませんでした</div>
              </div>
            )}

            {/* 強制打刻モーダル */}
            {showForceClockModal && selectedWorkerForClock && (
              <ForceClockModal
                worker={selectedWorkerForClock}
                selectedDate={selectedDate}
                onClose={() => {
                  setShowForceClockModal(false);
                  setSelectedWorkerForClock(null);
                }}
                onSuccess={() => {
                  fetchWorkers(); // データを再取得
                }}
              />
            )}
          </div>
        </div>
      </div>
      </div>
    </PageAccessGuard>
  );
}