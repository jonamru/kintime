"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { showAlert, showConfirm } from '@/lib/notification';
import PageAccessGuard from "@/components/PageAccessGuard";
import TimeBaseHeader from "@/components/TimeBaseHeader";

interface Shift {
  id: string;
  date: string;
  userId: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  location?: string;
  breakTime?: number;
  note?: string;
  status: string;
}

interface UserSettings {
  defaultLocation?: string;
}

interface SystemSettings {
  shiftApprovalDeadlineDays?: number;
}

interface UnlockStatus {
  isUnlocked?: boolean;
  reason?: string;
  endTime?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  dateString: string;
  isToday: boolean;
  isPast: boolean;
  isPastSelectable?: boolean;
}

interface CurrentUser {
  id: string;
  name: string;
  role?: string;
  customRole?: {
    name?: string;
    permissions?: {
      shiftManagement?: {
        approve?: boolean;
      };
    };
  };
}

export default function ShiftRequestPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(false);

  // カレンダー関連
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  // ロック解除状態
  const [unlockStatus, setUnlockStatus] = useState<UnlockStatus | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);

  // 現在のユーザー情報
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // フォームへの参照
  const formRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    startTime: "10:00",
    endTime: "19:00",
    shiftType: "REGULAR",
    location: "",
    breakTime: 60,
    note: "",
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // カレンダー生成（月変更時とロック解除状態変更時に実行）
  useEffect(() => {
    generateCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, unlockStatus]); // unlockStatusの変更時も再生成する

  useEffect(() => {
    fetchUnlockStatus();
    // 30秒ごとにロック解除状態をチェック
    const interval = setInterval(fetchUnlockStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // 残り時間のカウントダウン
  useEffect(() => {
    if (remainingTime > 0) {
      const timer = setTimeout(() => {
        setRemainingTime(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [remainingTime]);

  const fetchData = async () => {
    await Promise.all([
      fetchShifts(),
      fetchUserSettings(),
      fetchSystemSettings(),
    ]);
  };

  const fetchShifts = async () => {
    try {
      const response = await fetch("/api/shift/my-shifts");
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      }
    } catch (error: unknown) {
      console.error("シフト取得エラー:", error);
    }
  };

  const fetchUserSettings = async () => {
    try {
      const response = await fetch("/api/user/settings");
      if (response.ok) {
        const data = await response.json();
        setUserSettings(data);
        setCurrentUser(data); // 現在のユーザー情報も設定
        // デフォルト勤務地があれば設定
        if (data.defaultLocation) {
          setFormData(prev => ({ ...prev, location: data.defaultLocation }));
        }
      }
    } catch (error: unknown) {
      console.error("ユーザー設定取得エラー:", error);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const response = await fetch("/api/admin/system-settings");
      if (response.ok) {
        const data = await response.json();
        setSystemSettings(data);
      }
    } catch (error: unknown) {
      console.error("システム設定取得エラー:", error);
    }
  };

  const fetchUnlockStatus = async () => {
    try {
      const response = await fetch("/api/shift/unlock-status");
      if (response.ok) {
        const data = await response.json();
        setUnlockStatus(data);
        setRemainingTime(data.remainingTime || 0);
      }
    } catch (error: unknown) {
      console.error("ロック解除状態取得エラー:", error);
    }
  };

  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const isPast = date < todayStart;
      const isCurrentMonthAndYear = date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

      // ロック解除時は当月の過去日付も選択可能
      const isPastSelectable = isPast && unlockStatus?.isUnlocked && isCurrentMonthAndYear;

      days.push({
        date: date,
        isCurrentMonth: date.getMonth() === month,
        dateString: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
        isToday: date.toDateString() === today.toDateString(),
        isPast: isPast,
        isPastSelectable: isPastSelectable,
      });
    }
    setCalendarDays(days);
  };

  // 自動承認期限のメッセージを生成
  const getAutoApprovalMessage = () => {
    if (!systemSettings) return "";

    // デフォルト値を3に設定（undefinedまたはNaNの場合）
    const deadlineDays = systemSettings.shiftApprovalDeadlineDays || 3;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();


    // 今月の締切日
    const currentMonthDeadline = new Date(currentYear, currentMonth, deadlineDays, 23, 59, 59);
    // 来月の締切日
    const nextMonthDeadline = new Date(currentYear, currentMonth + 1, deadlineDays, 23, 59, 59);

    const formatDeadline = (date: Date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日 23:59`;
    };

    if (now <= currentMonthDeadline) {
      return `${formatDeadline(currentMonthDeadline)}まで今月分のシフトは自動承認されます`;
    } else {
      return `今月分の自動承認期限は終了しました。${formatDeadline(nextMonthDeadline)}まで来月分のシフトは自動承認されます`;
    }
  };


  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setDate(1); // 1日にセットして月末問題（例：1/31 -> 2月への遷移で3月になる）を回避
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  const toggleDate = (dateString: string, isPast: boolean, isCurrentMonth: boolean, isPastSelectable: boolean) => {
    // 過去の日付は通常選択不可だが、ロック解除時は当月の過去日付は選択可能
    if ((isPast && !isPastSelectable) || !isCurrentMonth) return;

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

    if (selectedDates.length === 0 && !editingShift) {
      showAlert("日付を選択してください");
      return;
    }

    setLoading(true);

    try {
      if (editingShift) {
        // 編集モード
        const response = await fetch(`/api/shift/shifts/${editingShift.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formData,
            date: editingShift.date.split('T')[0],
            breakTime: parseInt(formData.breakTime.toString()),
          }),
        });

        if (response.ok) {
          await fetchShifts();
          setEditingShift(null);
          resetForm();
          showAlert("シフトを更新しました");
        } else {
          const errorData = await response.json();
          showAlert(errorData.error || "更新に失敗しました");
        }
      } else {
        // 新規作成（複数日付）
        const shiftsData = selectedDates.map(date => ({
          date,
          ...formData,
          breakTime: parseInt(formData.breakTime.toString()),
        }));

        const response = await fetch("/api/shift/shifts/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ shifts: shiftsData }),
        });

        if (response.ok) {
          const result = await response.json();
          await fetchShifts();
          resetForm();
          showAlert(`${result.created}件のシフトを申請しました`);
        } else {
          const errorData = await response.json();
          showAlert(errorData.error || "申請に失敗しました");
        }
      }
    } catch {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const editShift = (shift: Shift) => {
    // 編集権限をチェック
    if (!canEditShift(shift)) {
      showAlert("当日を含む過去のシフトは編集できません");
      return;
    }

    setEditingShift(shift);
    setFormData({
      startTime: new Date(shift.startTime).toTimeString().slice(0, 5),
      endTime: new Date(shift.endTime).toTimeString().slice(0, 5),
      shiftType: shift.shiftType,
      location: shift.location || "",
      breakTime: shift.breakTime ?? 60,
      note: shift.note || "",
    });

    // フォームへスクロール
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const deleteShift = async (shift: Shift) => {
    // 削除権限をチェック
    const canDelete = await canDeleteShift(shift);
    if (!canDelete) {
      if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'MANAGER') {
        showAlert("このシフトは打刻済みのため削除できません");
      } else {
        showAlert("当日を含む過去のシフトは削除できません");
      }
      return;
    }

    if (!(await showConfirm("このシフトを削除しますか？"))) return;

    try {
      const response = await fetch(`/api/shift/shifts/${shift.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchShifts();
        showAlert("シフトを削除しました");
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "削除に失敗しました");
      }
    } catch {
      showAlert("エラーが発生しました");
    }
  };

  const resetForm = () => {
    setFormData({
      startTime: "10:00",
      endTime: "19:00",
      shiftType: "REGULAR",
      location: userSettings?.defaultLocation || "",
      breakTime: 60,
      note: "",
    });
    setSelectedDates([]);
  };

  // 編集・削除権限の判定（メモ化によるパフォーマンス最適化）
  const canEditShift = useCallback((shift: Shift) => {
    if (!currentUser) return false;

    const shiftDate = new Date(shift.date);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const roleName = currentUser.customRole?.name || 'UNKNOWN';

    // 自社管理者のみ全て編集可能
    if (roleName === 'SUPER_ADMIN' || roleName === 'MANAGER') {
      return true;
    }

    // 一般ユーザー・パートナーユーザー（STAFF, PARTNER_MANAGER, PARTNER_STAFF）は当日を含む過去分は編集不可
    return shiftDate >= todayStart;
  }, [currentUser]);

  const canDeleteShift = async (shift: Shift) => {
    if (!currentUser) return false;

    const shiftDate = new Date(shift.date);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const roleName = currentUser.customRole?.name || 'UNKNOWN';

    // 一般ユーザー・パートナーユーザー（STAFF, PARTNER_MANAGER, PARTNER_STAFF）は当日を含む過去分は削除不可
    if (roleName !== 'SUPER_ADMIN' && roleName !== 'MANAGER') {
      const canDelete = shiftDate >= todayStart;
      return canDelete;
    }

    // 管理者の場合、打刻済みかチェック
    try {
      const response = await fetch(`/api/shift/attendance-check?shiftId=${shift.id}`);
      if (response.ok) {
        const data = await response.json();
        return !data.hasAttendance; // 打刻済みでなければ削除可能
      }
    } catch (error: unknown) {
      console.error("打刻チェックエラー:", error);
    }

    return false;
  };

  const getDateStatus = (dateString: string) => {
    const shift = shifts.find(s => s.date.split('T')[0] === dateString);
    return shift ? shift.status : null;
  };

  const getDayClass = (day: CalendarDay) => {
    const status = getDateStatus(day.dateString);
    const isSelected = selectedDates.includes(day.dateString);


    let baseClass = "w-full h-full flex items-center justify-center text-sm font-medium rounded-lg cursor-pointer transition-colors ";

    if (!day.isCurrentMonth) {
      baseClass += "bg-gray-50 text-gray-400 cursor-not-allowed";
    } else if (status) {
      baseClass += "bg-blue-100 text-blue-800 cursor-not-allowed";
    } else if (isSelected) {
      baseClass += "bg-indigo-600 text-white hover:bg-indigo-700";
    } else if (day.isPastSelectable) {
      baseClass += "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200";
    } else if (day.isPast && !day.isPastSelectable) {
      baseClass += "bg-gray-50 text-gray-400 cursor-not-allowed";
    } else if (day.isToday) {
      baseClass += "bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold";
    } else {
      baseClass += "bg-white text-gray-900 hover:bg-gray-50";
    }

    return baseClass;
  };



  return (
    <PageAccessGuard page="shiftRequest">
      <TimeBaseHeader />
      <div className="min-h-screen bg-gray-100 py-6 pb-24 safe-area-bottom">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* カレンダー部分 */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">シフト登録</h1>
                </div>

                <div className="flex justify-center items-center space-x-4 mb-6">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    ← 前月
                  </button>
                  <h2 className="text-lg font-medium text-gray-900">
                    {currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}
                  </h2>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    次月 →
                  </button>
                </div>

                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">操作方法</h3>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>• カレンダーから勤務日をクリックして選択（複数選択可）</p>
                    <p>• 右側のフォームで勤務時間・勤務地を設定</p>
                    <p>• 常勤モードの場合はデフォルト勤務地が自動設定されます</p>
                    <p>• スポットモードの場合は勤務地を手動で入力してください</p>
                    {systemSettings && (
                      <p className="text-green-700 font-medium">• {getAutoApprovalMessage()}</p>
                    )}
                    {unlockStatus?.isUnlocked && (
                      <p className="text-orange-700 font-medium">
                        • 管理者によりロック解除中：当月の過去日付も選択可能（残り{Math.floor(remainingTime / 60)}分{remainingTime % 60}秒）
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-indigo-600 rounded mr-1"></div>
                      <span>選択中</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-100 rounded mr-1"></div>
                      <span>登録済み</span>
                    </div>
                    {unlockStatus?.isUnlocked && (
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-orange-50 border border-orange-200 rounded mr-1"></div>
                        <span>過去日付（選択可能）</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <div key={index} className="aspect-square p-1">
                      <div
                        onClick={() => toggleDate(day.dateString, day.isPast, day.isCurrentMonth, day.isPastSelectable || false)}
                        className={getDayClass(day)}
                      >
                        {day.date.getDate()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* フォーム部分 */}
            <div className="lg:col-span-1">
              <div ref={formRef} className="bg-white shadow rounded-lg px-4 py-5 md:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingShift
                    ? `シフト編集 ${new Date(editingShift.date).getMonth() + 1}月${new Date(editingShift.date).getDate()}日(${['日', '月', '火', '水', '木', '金', '土'][new Date(editingShift.date).getDay()]})`
                    : "登録内容設定"
                  }
                </h3>

                {selectedDates.length > 0 && !editingShift && (
                  <div className="mb-4 p-3 bg-indigo-50 rounded">
                    <div className="text-sm font-medium text-indigo-700 mb-2">
                      選択された日付: {selectedDates.length}日
                    </div>
                    <div className="text-xs text-indigo-600">
                      {selectedDates.map(date =>
                        new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                      ).join(', ')}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 overflow-x-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        開始時間
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-2 py-2 text-base md:text-sm"
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
                        className="w-full border border-gray-300 rounded-md px-2 py-2 text-base md:text-sm"
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
                      className="w-full border border-gray-300 rounded-md px-2 py-2 text-base md:text-sm"
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
                      onChange={(e) => {
                        const newType = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          shiftType: newType,
                          location: newType === 'REGULAR' && userSettings?.defaultLocation
                            ? userSettings.defaultLocation
                            : prev.location
                        }));
                      }}
                      className="w-full border border-gray-300 rounded-md px-2 py-2 text-base md:text-sm"
                    >
                      <option value="REGULAR">常勤シフト</option>
                      <option value="SPOT">スポットシフト</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      勤務地
                    </label>
                    {formData.shiftType === 'REGULAR' && userSettings?.defaultLocation ? (
                      <div className="p-3 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm text-gray-700">{formData.location || userSettings.defaultLocation}</p>
                        <p className="text-xs text-gray-500 mt-1">（常勤モード：デフォルト勤務地）</p>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-2 py-2 text-base md:text-sm"
                        placeholder="勤務地を入力"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      備考
                    </label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2 py-2 h-20 text-base md:text-sm"
                      placeholder="特記事項があれば入力"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setEditingShift(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      クリア
                    </button>
                    <button
                      type="submit"
                      disabled={loading || (!editingShift && selectedDates.length === 0)}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                      {loading ? "処理中..." : editingShift ? "更新" : "登録"}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>

          {/* 登録済みシフト一覧 */}
          <div className="mt-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    {currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}の登録済みシフト
                  </h2>
                </div>

                {/* モバイル表示（スマホ・タブレット） */}
                <div className="block lg:hidden">
                  {shifts.filter((shift) => {
                    const shiftDate = new Date(shift.date);
                    return shiftDate.getMonth() === currentMonth.getMonth() &&
                      shiftDate.getFullYear() === currentMonth.getFullYear();
                  }).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}のシフト申請がありません
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shifts.filter((shift) => {
                        const shiftDate = new Date(shift.date);
                        return shiftDate.getMonth() === currentMonth.getMonth() &&
                          shiftDate.getFullYear() === currentMonth.getFullYear();
                      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((shift) => (
                        <div key={shift.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="font-medium text-lg text-gray-900">
                                {new Date(shift.date).toLocaleDateString('ja-JP')}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} -
                                {new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                {shift.breakTime !== undefined && ` (休憩: ${shift.breakTime}分)`}
                              </div>
                            </div>
                            <div className="flex space-x-3">
                              {canEditShift(shift) && (
                                <button
                                  onClick={() => editShift(shift)}
                                  className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                                >
                                  編集
                                </button>
                              )}
                              <button
                                onClick={() => deleteShift(shift)}
                                className="text-red-600 hover:text-red-900 text-sm font-medium"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${shift.shiftType === 'REGULAR' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                }`}>
                                {shift.shiftType === 'REGULAR' ? '常勤' : 'スポット'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-sm font-medium text-gray-900">
                            📍 {shift.location}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* デスクトップ表示 */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          日付
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          時間
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          勤務地
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {shifts.filter((shift) => {
                        const shiftDate = new Date(shift.date);
                        return shiftDate.getMonth() === currentMonth.getMonth() &&
                          shiftDate.getFullYear() === currentMonth.getFullYear();
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            {currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}のシフト申請がありません
                          </td>
                        </tr>
                      ) : (
                        shifts.filter((shift) => {
                          const shiftDate = new Date(shift.date);
                          return shiftDate.getMonth() === currentMonth.getMonth() &&
                            shiftDate.getFullYear() === currentMonth.getFullYear();
                        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((shift) => (
                          <tr key={shift.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(shift.date).toLocaleDateString('ja-JP')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>
                                {new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} -
                                {new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {shift.breakTime !== undefined && (
                                <div className="text-xs text-gray-500">休憩: {shift.breakTime}分</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="flex items-center">
                                <span className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${shift.shiftType === 'REGULAR' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                  {shift.shiftType === 'REGULAR' ? '常勤' : 'スポット'}
                                </span>
                                <span className="ml-2">{shift.location}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                              <div className="flex justify-center space-x-2">
                                {canEditShift(shift) && (
                                  <button
                                    onClick={() => editShift(shift)}
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    編集
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteShift(shift)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  削除
                                </button>
                              </div>
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
      </div>

    </PageAccessGuard>
  );
}

