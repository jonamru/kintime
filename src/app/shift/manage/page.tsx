"use client";

import { useState, useEffect } from "react";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import { showAlert } from '@/lib/notification';
export default function ShiftManagePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<any[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, [currentMonth]);

  useEffect(() => {
    filterShifts();
  }, [shifts, filterStatus]);

  const fetchShifts = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/shift/admin-shifts?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      }
    } catch (error) {
      console.error("シフト取得エラー:", error);
    }
  };

  const filterShifts = () => {
    if (filterStatus === "all") {
      setFilteredShifts(shifts);
    } else {
      setFilteredShifts(shifts.filter(shift => shift.status === filterStatus));
    }
  };

  const handleShiftAction = async (shiftId: string, action: 'approve' | 'reject', comment?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/shift/shifts/${shiftId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          comment: comment || null,
        }),
      });

      if (response.ok) {
        await fetchShifts();
        setShowDetailModal(false);
        setSelectedShift(null);
        showAlert(action === 'approve' ? "シフトを承認しました" : "シフトを却下しました");
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "処理に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return '承認待ち';
      case 'APPROVED': return '承認済み';
      case 'REJECTED': return '却下';
      case 'CANCELLED': return 'キャンセル';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusCount = (status: string) => {
    return shifts.filter(shift => shift.status === status).length;
  };

  const calculateWorkHours = (startTime: string, endTime: string, breakTime: number) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const workHours = diffHours - (breakTime / 60);
    return Math.max(0, workHours);
  };

  return (
    <>
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
                <h1 className="text-2xl font-bold text-gray-900">シフト承認管理</h1>
                <div className="flex items-center space-x-4">
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
            </div>

            {/* ステータス別サマリー */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-800">{getStatusCount('PENDING')}</div>
                <div className="text-sm text-yellow-600">承認待ち</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-800">{getStatusCount('APPROVED')}</div>
                <div className="text-sm text-green-600">承認済み</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-800">{getStatusCount('REJECTED')}</div>
                <div className="text-sm text-red-600">却下</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-800">{shifts.length}</div>
                <div className="text-sm text-gray-600">総申請数</div>
              </div>
            </div>

            {/* フィルター */}
            <div className="mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    filterStatus === "all"
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  全て ({shifts.length})
                </button>
                <button
                  onClick={() => setFilterStatus("PENDING")}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    filterStatus === "PENDING"
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  承認待ち ({getStatusCount('PENDING')})
                </button>
                <button
                  onClick={() => setFilterStatus("APPROVED")}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    filterStatus === "APPROVED"
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  承認済み ({getStatusCount('APPROVED')})
                </button>
                <button
                  onClick={() => setFilterStatus("REJECTED")}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    filterStatus === "REJECTED"
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  却下 ({getStatusCount('REJECTED')})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      申請者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日付
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      タイプ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      勤務地
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        該当するシフト申請がありません
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="font-medium">{shift.user?.name}</div>
                          <div className="text-xs text-gray-500">{shift.user?.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(shift.date).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex items-center">
                            <span className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${
                              shift.shiftType === 'REGULAR' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {shift.shiftType === 'REGULAR' ? '常勤' : 'スポット'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - 
                            {new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            休憩: {shift.breakTime}分 | 
                            実働: {calculateWorkHours(shift.startTime, shift.endTime, shift.breakTime).toFixed(1)}h
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {shift.location}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(shift.status)}`}>
                            {getStatusText(shift.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedShift(shift);
                              setShowDetailModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            </div>
          </div>
        </div>
      </div>

      {/* 詳細・承認モーダル */}
      {showDetailModal && selectedShift && (
        <ShiftDetailModal
          shift={selectedShift}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedShift(null);
          }}
          onAction={handleShiftAction}
          loading={loading}
        />
      )}
    </>
  );
}

function ShiftDetailModal({ shift, onClose, onAction, loading }: any) {
  const [comment, setComment] = useState("");

  const handleAction = (action: 'approve' | 'reject') => {
    if (action === 'reject' && !comment.trim()) {
      showAlert("却下の場合はコメントを入力してください");
      return;
    }
    onAction(shift.id, action, comment);
  };

  const calculateWorkHours = (startTime: string, endTime: string, breakTime: number) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const workHours = diffHours - (breakTime / 60);
    return Math.max(0, workHours);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">シフト申請詳細</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">申請者</label>
                <div className="mt-1 text-sm text-gray-900">{shift.user?.name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">日付</label>
                <div className="mt-1 text-sm text-gray-900">
                  {new Date(shift.date).toLocaleDateString('ja-JP')}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">タイプ</label>
              <div className="mt-1 text-sm text-gray-900">
                <span className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${
                  shift.shiftType === 'REGULAR' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {shift.shiftType === 'REGULAR' ? '常勤' : 'スポット'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">開始時間</label>
                <div className="mt-1 text-sm text-gray-900">
                  {new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">終了時間</label>
                <div className="mt-1 text-sm text-gray-900">
                  {new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">休憩時間</label>
                <div className="mt-1 text-sm text-gray-900">{shift.breakTime}分</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">実働時間</label>
                <div className="mt-1 text-sm text-gray-900">
                  {calculateWorkHours(shift.startTime, shift.endTime, shift.breakTime).toFixed(1)}時間
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">勤務地</label>
              <div className="mt-1 text-sm text-gray-900">
                {shift.location}
              </div>
            </div>

            {shift.note && (
              <div>
                <label className="block text-sm font-medium text-gray-700">備考</label>
                <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {shift.note}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">申請日時</label>
              <div className="mt-1 text-sm text-gray-900">
                {new Date(shift.createdAt).toLocaleString('ja-JP')}
              </div>
            </div>

            {shift.status === 'PENDING' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  管理者コメント（却下時必須）
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 h-20"
                  placeholder="承認・却下理由やコメントを入力"
                />
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                閉じる
              </button>
              {shift.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:bg-gray-400"
                  >
                    {loading ? "処理中..." : "却下"}
                  </button>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {loading ? "処理中..." : "承認"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}