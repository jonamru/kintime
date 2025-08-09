"use client";

import { useState, useEffect } from "react";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import PageAccessGuard from "@/components/PageAccessGuard";
import { showAlert, showNotification } from '@/lib/notification';
export default function AdminShiftRegisterPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  
  // カレンダー関連
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    startTime: "09:00",
    endTime: "17:00",  
    shiftType: "REGULAR",
    location: "",
    breakTime: 60,
    note: "",
  });

  useEffect(() => {
    fetchUsers();
    generateCalendar();
  }, []);

  useEffect(() => {
    generateCalendar();
  }, [currentMonth]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserShifts();
      // ユーザーのデフォルト勤務地を設定
      const user = users.find(u => u.id === selectedUser);
      if (user && user.defaultLocation) {
        setFormData(prev => ({ ...prev, location: user.defaultLocation }));
      }
    }
  }, [selectedUser, currentMonth]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("ユーザー取得エラー:", error);
      setUsers([]);
    }
  };

  const fetchUserShifts = async () => {
    if (!selectedUser) return;
    
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/shift/admin-shifts?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        const userShifts = data.filter((shift: any) => shift.userId === selectedUser);
        setShifts(userShifts);
      }
    } catch (error) {
      console.error("シフト取得エラー:", error);
    }
  };

  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push({
        date: date,
        isCurrentMonth: date.getMonth() === month,
        dateString: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
        isToday: date.toDateString() === new Date().toDateString(),
        isPast: date < new Date(new Date().setHours(0, 0, 0, 0)),
      });
    }
    setCalendarDays(days);
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  const toggleDate = (dateString: string, isPast: boolean, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    
    setSelectedDates(prev => {
      if (prev.includes(dateString)) {
        return prev.filter(d => d !== dateString);
      } else {
        return [...prev, dateString];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      showAlert("ユーザーを選択してください");
      return;
    }

    if (selectedDates.length === 0) {
      showAlert("日付を選択してください");
      return;
    }

    setLoading(true);

    try {
      const shiftsData = selectedDates.map(date => ({
        date,
        ...formData,
        breakTime: parseInt(formData.breakTime.toString()),
      }));

      const response = await fetch("/api/admin/shift-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          userId: selectedUser,
          shifts: shiftsData 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        await fetchUserShifts();
        setSelectedDates([]);
        showAlert(result.message);
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "登録に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDates([]);
    setFormData({
      startTime: "09:00",
      endTime: "17:00",  
      shiftType: "REGULAR",
      location: "",
      breakTime: 60,
      note: "",
    });
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  };

  return (
    <PageAccessGuard page="shiftRegister">
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
              <h1 className="text-2xl font-bold text-gray-900">シフト登録（管理者）</h1>
              <button
                onClick={() => setShowCSVUpload(!showCSVUpload)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                CSV一括登録
              </button>
            </div>

            {/* CSV一括登録セクション */}
            {showCSVUpload && (
              <CSVUploadSection onClose={() => setShowCSVUpload(false)} onSuccess={fetchUserShifts} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* カレンダーセクション */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-medium text-gray-900">日付選択</h2>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => navigateMonth(-1)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        ← 前月
                      </button>
                      <h3 className="text-lg font-medium">{formatMonth(currentMonth)}</h3>
                      <button
                        onClick={() => navigateMonth(1)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        次月 →
                      </button>
                    </div>
                  </div>

                  {/* ユーザー選択 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      対象ユーザー
                    </label>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    >
                      <option value="">ユーザーを選択してください</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.userId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* カレンダーグリッド */}
                  <div className="grid grid-cols-7 gap-1">
                    {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                      <div key={index} className="p-3 text-center font-medium text-gray-500">
                        {day}
                      </div>
                    ))}
                    
                    {calendarDays.map((day, index) => {
                      const hasShift = shifts.some(shift => {
                        // shift.dateは既に日本時間基準のYYYY-MM-DD形式の文字列
                        return shift.date === day.dateString;
                      });
                      
                      return (
                        <div
                          key={index}
                          onClick={() => toggleDate(day.dateString, day.isPast, day.isCurrentMonth)}
                          className={`
                            p-3 text-center cursor-pointer border border-gray-200 min-h-[60px] flex flex-col justify-center
                            ${!day.isCurrentMonth ? 'text-gray-300 bg-gray-50' : 'text-gray-900'}
                            ${day.isToday ? 'bg-blue-100 border-blue-300' : ''}
                            ${selectedDates.includes(day.dateString) ? 'bg-indigo-600 text-white' : ''}
                            ${hasShift ? 'bg-green-100 border-green-300' : ''}
                            ${day.isCurrentMonth && !hasShift ? 'hover:bg-gray-100' : ''}
                          `}
                        >
                          <div className="text-sm">{day.date.getDate()}</div>
                          {hasShift && <div className="text-xs mt-1">●</div>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-indigo-600 rounded mr-1"></div>
                      <span>選択中</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-1"></div>
                      <span>登録済み</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded mr-1"></div>
                      <span>今日</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* フォームセクション */}
              <div className="lg:col-span-1">
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">シフト内容設定</h3>
                  
                  {selectedDates.length > 0 && (
                    <div className="mb-4 p-3 bg-indigo-50 rounded">
                      <div className="text-sm font-medium text-indigo-700 mb-2">
                        選択された日付 ({selectedDates.length}日)
                      </div>
                      <div className="text-xs text-indigo-600">
                        {selectedDates.slice(0, 3).map(date => 
                          new Date(date).toLocaleDateString('ja-JP')
                        ).join(', ')}
                        {selectedDates.length > 3 && ` 他${selectedDates.length - 3}日`}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
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
                        シフトタイプ
                      </label>
                      <select
                        value={formData.shiftType}
                        onChange={(e) => setFormData(prev => ({ ...prev, shiftType: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="REGULAR">常勤</option>
                        <option value="SPOT">スポット</option>
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
                        休憩時間（分）
                      </label>
                      <input
                        type="number"
                        value={formData.breakTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, breakTime: parseInt(e.target.value) || 0 }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        min="0"
                        max="480"
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
                        placeholder="備考があれば入力"
                      />
                    </div>

                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        リセット
                      </button>
                      <button
                        type="submit"
                        disabled={loading || !selectedUser || selectedDates.length === 0}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
                      >
                        {loading ? "登録中..." : "登録"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <a
                href="/dashboard"
                className="text-indigo-600 hover:text-indigo-500 text-sm"
              >
                ← ダッシュボードに戻る
              </a>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PageAccessGuard>
  );
}

// CSV一括登録コンポーネント
function CSVUploadSection({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const downloadSampleCSV = () => {
    const csvContent = `userId,date,startTime,endTime,shiftType,location,breakTime,note
USER001,2025/8/1,09:00,17:00,REGULAR,,60,
USER002,2025-08-01,10:00,18:00,SPOT,auヨドバシ梅田,60,備考
USER003,2025/8/2,08:00,16:00,REGULAR,,60,
USER004,2025-08-02,13:00,22:00,SPOT,SB花園,60,夜勤`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'shift_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!csvFile) {
      showAlert("CSVファイルを選択してください");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch('/api/admin/shift-csv-upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        let message = result.message;
        
        // エラーの詳細がある場合は表示
        if (result.errors && result.errors.length > 0) {
          message += '\n\nエラー詳細:\n' + result.errors.slice(0, 5).join('\n');
          if (result.errors.length > 5) {
            message += `\n...他${result.errors.length - 5}件のエラー`;
          }
        }
        
        // CSV一括登録は成功時でも "エラー○件" を含むため、明示的にsuccessとして表示
        showNotification(message, 'success');
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "アップロードに失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-green-800">CSV一括登録</h3>
        <button
          onClick={onClose}
          className="text-green-600 hover:text-green-800"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-green-700 mb-2">
            CSVファイル
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full border border-green-300 rounded-md px-3 py-2"
          />
        </div>
        
        <div className="text-sm text-green-700">
          <div className="bg-white p-3 rounded border">
            <p className="font-medium mb-2">使用方法:</p>
            <div className="text-xs space-y-1 mb-3">
              <p>• <strong>userId:</strong> 各ユーザーに割り当てられた固有のユーザーIDを使用</p>
              <p>• <strong>date:</strong> YYYY-MM-DD 形式（例: 2025-08-01）または YYYY/M/D 形式（例: 2025/8/1）</p>
              <p>• <strong>shiftType:</strong> 「REGULAR」の場合locationが空白でもデフォルト勤務地を自動設定</p>
              <p>• <strong>location:</strong> 「SPOT」の場合は必須入力</p>
            </div>
            <button
              onClick={downloadSampleCSV}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              📄 サンプルCSVをダウンロード
            </button>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleUpload}
            disabled={!csvFile || uploading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            {uploading ? "アップロード中..." : "アップロード"}
          </button>
        </div>
      </div>
    </div>
  );
}