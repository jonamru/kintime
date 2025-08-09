"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import PageAccessGuard from "@/components/PageAccessGuard";
import { showAlert, showConfirm } from '@/lib/notification';
export default function ShiftOverviewPage() {
  const { user: currentUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isNewShift, setIsNewShift] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [formData, setFormData] = useState({
    startTime: "09:00",
    endTime: "17:00",
    shiftType: "REGULAR",
    location: "",
    breakTime: 60,
    note: "",
  });

  useEffect(() => {
    if (currentUser?.id) {
      fetchUserPermissions();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (userPermissions !== null) {
      fetchData();
    }
  }, [currentMonth, userPermissions]);

  const fetchUserPermissions = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const userData = await response.json();
        setUserPermissions(userData.permissions);
      }
    } catch (error) {
      console.error("権限取得エラー:", error);
    }
  };


  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchShifts(),
        fetchUsers(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchShifts = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/shift/admin-shifts?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        // APIで適切にフィルタリングされているため、そのまま設定
        setShifts(data);
      }
    } catch (error) {
      console.error("シフト取得エラー:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log("ユーザーAPI呼び出し開始: /api/admin/users");
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        console.log("ユーザーAPIレスポンス:", data);
        // APIで適切にフィルタリングされているため、そのまま設定
        const filteredUsers = data.users || [];
        console.log("フィルタリング後のユーザー:", filteredUsers);
        
        setUsers(filteredUsers);
      } else {
        console.error("ユーザーAPI HTTPステータス:", response.status);
        console.error("ユーザーAPI ステータステキスト:", response.statusText);
        try {
          const errorData = await response.json();
          console.error("ユーザーAPI エラーレスポンス:", errorData);
        } catch (parseError) {
          console.error("エラーレスポンスのパースに失敗:", parseError);
          const responseText = await response.text();
          console.error("レスポンスのテキスト:", responseText);
        }
        setUsers([]);
      }
    } catch (error) {
      console.error("ユーザー取得エラー:", error);
      setUsers([]);
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

  // 月の日数を取得
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  // 特定のユーザーと日付のシフトを取得
  const getShiftForUserAndDate = (userId: string, date: Date) => {
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    return shifts.find(shift => {
      // shift.dateは既に日本時間基準のYYYY-MM-DD形式の文字列
      return shift.userId === userId && shift.date === dateString;
    });
  };

  // シフトセルクリック処理
  const handleShiftCellClick = (user: any, date: Date, shift?: any) => {
    // 既存シフトの編集時は権限チェック
    if (shift && !canModifyShift(shift)) {
      showAlert("このシフトを編集する権限がありません");
      return;
    }
    
    // 新規シフト作成時の権限チェック
    if (!shift && user.id !== currentUser?.id) {
      if (!canCreateShiftForOthers()) {
        showAlert("他のユーザーのシフトを作成する権限がありません");
        return;
      }
    }
    
    setSelectedUser(user);
    setSelectedDate(date);
    
    if (shift) {
      // 既存シフトの編集
      setSelectedShift(shift);
      setIsNewShift(false);
      setFormData({
        startTime: new Date(shift.startTime).toTimeString().slice(0, 5),
        endTime: new Date(shift.endTime).toTimeString().slice(0, 5),
        shiftType: shift.shiftType,
        location: shift.location || "",
        breakTime: shift.breakTime ?? 60,
        note: shift.note || "",
      });
    } else {
      // 新規シフト作成
      setSelectedShift(null);
      setIsNewShift(true);
      setFormData({
        startTime: "09:00",
        endTime: "17:00",
        shiftType: "REGULAR",
        location: user.defaultLocation || "",
        breakTime: 60,
        note: "",
      });
    }
    
    setShowModal(true);
  };

  // シフト保存処理
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !selectedDate) return;
    
    // 既存シフトの編集時は権限チェック
    if (!isNewShift && selectedShift && !canModifyShift(selectedShift)) {
      showAlert("このシフトを編集する権限がありません");
      return;
    }
    
    // 新規シフト作成時は権限チェック
    if (isNewShift && selectedUser.id !== currentUser?.id) {
      if (!canCreateShiftForOthers()) {
        showAlert("他のユーザーのシフトを作成する権限がありません");
        return;
      }
    }
    
    setLoading(true);
    
    try {
      if (isNewShift) {
        // 新規作成
        const requestData = {
          shifts: [{
            userId: selectedUser.id,
            date: `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`,
            ...formData,
            breakTime: parseInt(formData.breakTime.toString()),
          }]
        };
        console.log('Creating new shift with data:', requestData);
        
        const response = await fetch("/api/shift/shifts/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });
        
        const responseData = await response.json();
        console.log('Create response:', response.status, responseData);
        
        if (response.ok) {
          showAlert("シフトを作成しました");
          fetchData();
          setShowModal(false);
        } else {
          showAlert(responseData.error || "作成に失敗しました");
        }
      } else {
        // 編集
        const requestData = {
          ...formData,
          date: `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`,
          breakTime: parseInt(formData.breakTime.toString()),
        };
        console.log('Updating shift with data:', requestData);
        
        const response = await fetch(`/api/shift/shifts/${selectedShift.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });
        
        const responseData = await response.json();
        console.log('Update response:', response.status, responseData);
        
        if (response.ok) {
          showAlert("シフトを更新しました");
          fetchData();
          setShowModal(false);
        } else {
          showAlert(responseData.error || "更新に失敗しました");
        }
      }
    } catch (error) {
      console.error('Save shift error:', error);
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 権限チェック関数
  const canModifyShift = (shift: any) => {
    if (!currentUser || !shift) {
      return false;
    }
    
    // 自分のシフトは編集可能
    if (shift.userId === currentUser.id) {
      return true;
    }
    
    // 他人のシフトを編集する権限があるかチェック
    return canEditOthersShifts();
  };

  const canCreateShiftForOthers = () => {
    if (!userPermissions) return false;
    return userPermissions.shiftManagement?.viewAll || 
           userPermissions.shiftManagement?.edit ||
           userPermissions.shiftManagement?.forceRegister;
  };

  const canEditOthersShifts = () => {
    if (!userPermissions) return false;
    return userPermissions.shiftManagement?.viewAll || 
           userPermissions.shiftManagement?.edit;
  };
  
  // ログインチェック
  if (!currentUser) {
    return (
      <PageAccessGuard page="shiftOverview">
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">ログインが必要です</div>
        </div>
      </PageAccessGuard>
    );
  }

  // 権限ロード中
  if (userPermissions === null) {
    return (
      <PageAccessGuard page="shiftOverview">
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">権限を確認中...</div>
        </div>
      </PageAccessGuard>
    );
  }

  // シフト削除処理
  const handleDeleteShift = async () => {
    if (!selectedShift) return;
    
    // 権限チェック
    if (!canModifyShift(selectedShift)) {
      showAlert("このシフトを削除する権限がありません");
      return;
    }
    
    if (!(await showConfirm("このシフトを削除しますか？"))) return;
    
    setLoading(true);
    
    try {
      console.log('Deleting shift:', selectedShift.id);
      
      const response = await fetch(`/api/shift/shifts/${selectedShift.id}`, {
        method: "DELETE",
      });
      
      const responseData = await response.json();
      console.log('Delete response:', response.status, responseData);
      
      if (response.ok) {
        showAlert("シフトを削除しました");
        fetchData();
        setShowModal(false);
      } else {
        showAlert(responseData.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error('Delete shift error:', error);
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <PageAccessGuard page="shiftOverview">
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
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* ヘッダー */}
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">シフト一覧（管理者）</h1>
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

            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">読み込み中...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900 bg-gray-50 sticky left-0 z-10 min-w-[200px]">
                        名前
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 bg-gray-50 sticky left-[200px] z-10 min-w-[150px]">
                        常勤勤務地
                      </th>
                      {days.map((day, index) => {
                        const isToday = day.toDateString() === new Date().toDateString();
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        
                        return (
                          <th
                            key={index}
                            className={`text-center py-3 px-2 font-medium text-gray-900 min-w-[80px] ${
                              isToday ? 'bg-blue-100' : 'bg-gray-50'
                            } ${isWeekend ? 'text-red-600' : ''}`}
                          >
                            <div>{day.getMonth() + 1}/{day.getDate()}</div>
                            <div className="text-xs text-gray-500">
                              {['日', '月', '火', '水', '木', '金', '土'][day.getDay()]}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, userIndex) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900 bg-white sticky left-0 z-10 border-r border-gray-200">
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 bg-white sticky left-[200px] z-10 border-r border-gray-200">
                          {user.defaultLocation || '-'}
                        </td>
                        {days.map((day, dayIndex) => {
                          const shift = getShiftForUserAndDate(user.id, day);
                          const isToday = day.toDateString() === new Date().toDateString();
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          
                          return (
                            <td
                              key={dayIndex}
                              className={`py-3 px-2 text-center text-xs border-r border-gray-100 ${
                                isToday ? 'bg-blue-50' : ''
                              } ${isWeekend ? 'bg-red-50' : ''}`}
                            >
                              {shift ? (
                                <div
                                  className={`rounded px-1 py-1 bg-blue-100 text-blue-800 ${
                                    canModifyShift(shift) 
                                      ? 'cursor-pointer hover:opacity-80' 
                                      : 'cursor-default opacity-60'
                                  }`}
                                  onClick={() => handleShiftCellClick(user, day, shift)}
                                  title={canModifyShift(shift) 
                                    ? `クリックして編集\n${new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}\n勤務地: ${shift.location}` 
                                    : `編集権限がありません\n${new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}\n勤務地: ${shift.location}`
                                  }
                                >
                                  <div className="truncate">
                                    {new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <div className="truncate">
                                    {new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <div className="truncate font-medium text-xs">
                                    {shift.location.length > 8 ? shift.location.substring(0, 8) + '...' : shift.location}
                                  </div>
                                </div>
                              ) : (
                                <div 
                                  className={`text-gray-300 rounded px-1 py-1 h-full flex items-center justify-center ${
                                    (canCreateShiftForOthers() || user.id === currentUser?.id)
                                      ? 'cursor-pointer hover:bg-gray-100'
                                      : 'cursor-default'
                                  }`}
                                  onClick={() => handleShiftCellClick(user, day)}
                                  title={(canCreateShiftForOthers() || user.id === currentUser?.id)
                                    ? "クリックしてシフトを追加"
                                    : "シフト作成権限がありません"
                                  }
                                >
                                  +
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 凡例 */}
            <div className="mt-6 flex flex-wrap items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                <span>登録済みシフト</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
                <span>本日</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
                <span>土日</span>
              </div>
            </div>

            {/* 統計情報 */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-800">
                  {shifts.length}
                </div>
                <div className="text-sm text-blue-600">登録済みシフト数</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-800">
                  {users.filter(user => shifts.some(shift => shift.userId === user.id)).length}
                </div>
                <div className="text-sm text-green-600">シフト登録済みユーザー数</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {isNewShift ? 'シフト追加' : 'シフト編集'}
              </h3>
              
              {selectedUser && selectedDate && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-600">
                    <div><strong>ユーザー:</strong> {selectedUser.name}</div>
                    <div><strong>日付:</strong> {selectedDate.toLocaleDateString('ja-JP')}</div>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSaveShift} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始時間
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      終了時間
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    休憩時間（分）
                  </label>
                  <input
                    type="number"
                    value={formData.breakTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, breakTime: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    min="0"
                    step="15"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    シフトタイプ
                  </label>
                  <select
                    value={formData.shiftType}
                    onChange={(e) => setFormData(prev => ({ ...prev, shiftType: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="REGULAR">常勤シフト</option>
                    <option value="SPOT">スポットシフト</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    勤務地
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="勤務地を入力"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    備考
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 h-20"
                    placeholder="特記事項があれば入力"
                  />
                </div>
                
                <div className="flex justify-between pt-4">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                    {!isNewShift && canModifyShift(selectedShift) && (
                      <button
                        type="button"
                        onClick={handleDeleteShift}
                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading || (!isNewShift && selectedShift && !canModifyShift(selectedShift)) || (isNewShift && selectedUser?.id !== currentUser?.id && !canCreateShiftForOthers())}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {loading ? "処理中..." : isNewShift ? "追加" : "更新"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>

    </PageAccessGuard>
  );
}