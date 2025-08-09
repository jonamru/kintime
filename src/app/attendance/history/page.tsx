"use client";

import { useState, useEffect, useRef } from "react";

import PageAccessGuard from "@/components/PageAccessGuard";
import TimeBaseHeader from "@/components/TimeBaseHeader";
import { showAlert, showConfirm } from '@/lib/notification';
interface Attendance {
  id: string;
  userId: string;
  date: string;
  type: string;
  clockTime: string;
  latitude?: number;
  longitude?: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  corrections: Correction[];
}

interface Correction {
  id: string;
  oldTime: string;
  newTime: string;
  reason: string;
  comment?: string;
  status: string;
  createdAt: string;
}

export default function AttendanceHistoryPage() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    newTime: "",
    reason: "",
    comment: "",
  });
  const [editingDayAttendances, setEditingDayAttendances] = useState<Attendance[]>([]);
  const [bulkEditForm, setBulkEditForm] = useState({
    wakeUp: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
    departure: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
    clockIn: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
    clockOut: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
  });
  const [targetDay, setTargetDay] = useState<number | null>(null);

  useEffect(() => {
    // ページタイトルを設定
    document.title = "TimeBase - 勤怠履歴";
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchAttendances();
  }, [year, month, selectedUserId]);

  // データ読み込み完了後に対象日付に移動
  useEffect(() => {
    if (!loading && targetDay && attendances.length > 0) {
      const targetElement = document.getElementById(`day-${targetDay}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
        setTargetDay(null); // 一度だけ実行
      }
    }
  }, [loading, attendances, targetDay]);


  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        console.log("管理者用ユーザーデータ:", data);
        setUsers(data.users || []);
        setIsAdmin(true);
        
        // 現在のユーザー情報を取得
        const userResponse = await fetch("/api/attendance/user-settings");
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
          
          // 管理者の場合、初期選択は自分にする
          if (data.users && data.users.length > 0 && !selectedUserId) {
            // 現在のユーザーがユーザーリストに含まれているか確認
            const currentUserInList = data.users.find((u: any) => u.id === userData.id);
            if (currentUserInList) {
              console.log("自分を初期選択:", userData.id);
              setSelectedUserId(userData.id);
            } else {
              // 自分がリストにない場合は最初のユーザーを選択
              const firstUserId = data.users[0].id;
              console.log("最初のユーザーを選択:", firstUserId);
              setSelectedUserId(firstUserId);
            }
          }
        }
      } else {
        console.log("一般ユーザーとして処理");
        // 一般ユーザーの場合、自分の情報を取得
        setIsAdmin(false);
        const userResponse = await fetch("/api/attendance/user-settings");
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
        }
      }
    } catch (error) {
      console.error("ユーザー情報の取得に失敗しました:", error);
      setIsAdmin(false);
    }
  };

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
      });
      
      // 管理者の場合は選択されたユーザー、一般ユーザーの場合は自動的に自分のデータ
      if (isAdmin && selectedUserId) {
        params.append('userId', selectedUserId);
        console.log("管理者として勤怠履歴を取得:", { year, month, selectedUserId });
      } else {
        console.log("一般ユーザーとして勤怠履歴を取得:", { year, month });
      }

      const response = await fetch(`/api/attendance/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        console.log("取得した勤怠履歴:", data);
        setAttendances(data);
      } else {
        console.error("勤怠履歴の取得に失敗しました");
      }
    } catch (error) {
      console.error("勤怠履歴の取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCorrection = async () => {
    if (!editingAttendance || !correctionForm.newTime || !correctionForm.reason) {
      showAlert("必須項目を入力してください");
      return;
    }

    try {
      // 元の打刻日と新しい時刻を組み合わせ（ローカルタイムゾーンを維持）
      const originalDate = new Date(editingAttendance.clockTime);
      const [hours, minutes] = correctionForm.newTime.split(':').map(Number);
      const correctedDateTime = new Date(
        originalDate.getFullYear(),
        originalDate.getMonth(),
        originalDate.getDate(),
        hours,
        minutes,
        0,
        0
      );

      // ローカルタイムゾーンでの日時を文字列として作成（UTCに変換しない）
      const year = correctedDateTime.getFullYear();
      const month = String(correctedDateTime.getMonth() + 1).padStart(2, '0');
      const day = String(correctedDateTime.getDate()).padStart(2, '0');
      const timeHours = String(correctedDateTime.getHours()).padStart(2, '0');
      const timeMinutes = String(correctedDateTime.getMinutes()).padStart(2, '0');
      const timeSeconds = String(correctedDateTime.getSeconds()).padStart(2, '0');
      const localDateTimeString = `${year}-${month}-${day}T${timeHours}:${timeMinutes}:${timeSeconds}`;

      const response = await fetch("/api/attendance/correct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendanceId: editingAttendance.id,
          newTime: localDateTimeString,
          reason: correctionForm.reason,
          comment: correctionForm.comment,
        }),
      });

      if (response.ok) {
        showAlert("打刻時刻を修正しました");
        // 修正した日付に戻る
        const attendanceDate = new Date(editingAttendance.date);
        setTargetDay(attendanceDate.getDate());
        setEditingAttendance(null);
        setCorrectionForm({ newTime: "", reason: "", comment: "" });
        fetchAttendances();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "修正に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    }
  };

  const handleDelete = async (attendance: Attendance) => {
    if (!(await showConfirm(`${getTypeLabel(attendance.type)}の打刻記録を削除しますか？\n\n${attendance.user.name}さん\n${formatDateTime(attendance.clockTime)}`))) {
      return;
    }

    try {
      const response = await fetch(`/api/attendance/delete?id=${attendance.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showAlert("打刻記録を削除しました");
        fetchAttendances();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "削除に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    }
  };

  const openCorrectionModal = (attendance: Attendance) => {
    setEditingAttendance(attendance);
    
    // 時間のみを取得（HH:MM形式）
    const clockTime = new Date(attendance.clockTime);
    const hours = String(clockTime.getHours()).padStart(2, '0');
    const minutes = String(clockTime.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    setCorrectionForm({
      newTime: timeString,
      reason: "",
      comment: "",
    });
  };

  const openBulkEditModal = (day: number) => {
    // その日の全ての打刻データを取得
    const dayAttendances = [
      attendanceMap[`${day}-WAKE_UP`],
      attendanceMap[`${day}-DEPARTURE`],
      attendanceMap[`${day}-CLOCK_IN`],
      attendanceMap[`${day}-CLOCK_OUT`],
    ].filter(Boolean);

    setEditingDayAttendances(dayAttendances);

    // フォームを初期化
    const formatTime = (attendance: Attendance | undefined) => {
      if (!attendance) return "";
      const clockTime = new Date(attendance.clockTime);
      const hours = String(clockTime.getHours()).padStart(2, '0');
      const minutes = String(clockTime.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    setBulkEditForm({
      wakeUp: { 
        time: formatTime(attendanceMap[`${day}-WAKE_UP`]), 
        reason: "", 
        comment: "", 
        hasChanges: false,
        shouldDelete: false
      },
      departure: { 
        time: formatTime(attendanceMap[`${day}-DEPARTURE`]), 
        reason: "", 
        comment: "", 
        hasChanges: false,
        shouldDelete: false
      },
      clockIn: { 
        time: formatTime(attendanceMap[`${day}-CLOCK_IN`]), 
        reason: "", 
        comment: "", 
        hasChanges: false,
        shouldDelete: false
      },
      clockOut: { 
        time: formatTime(attendanceMap[`${day}-CLOCK_OUT`]), 
        reason: "", 
        comment: "", 
        hasChanges: false,
        shouldDelete: false
      },
    });
  };

  const handleBulkCorrection = async () => {
    const corrections = [];
    const deletions = [];
    // 編集中の日付を取得（editingDayAttendancesから推定）
    const currentDay = editingDayAttendances.length > 0 ? 
      new Date(editingDayAttendances[0].date).getDate() : null;
    
    const dayAttendanceMap = {
      wakeUp: attendanceMap[`${currentDay}-WAKE_UP`],
      departure: attendanceMap[`${currentDay}-DEPARTURE`],
      clockIn: attendanceMap[`${currentDay}-CLOCK_IN`],
      clockOut: attendanceMap[`${currentDay}-CLOCK_OUT`],
    };

    // 削除と修正の処理を分ける
    for (const [key, formData] of Object.entries(bulkEditForm)) {
      const attendance = dayAttendanceMap[key as keyof typeof dayAttendanceMap];
      if (attendance) {
        if (formData.shouldDelete) {
          deletions.push(attendance);
        } else if (formData.hasChanges && formData.time && formData.reason) {
          // 元の打刻日と新しい時刻を組み合わせ
          const originalDate = new Date(attendance.clockTime);
          const [hours, minutes] = formData.time.split(':').map(Number);
          const correctedDateTime = new Date(
            originalDate.getFullYear(),
            originalDate.getMonth(),
            originalDate.getDate(),
            hours,
            minutes,
            0,
            0
          );

          const year = correctedDateTime.getFullYear();
          const month = String(correctedDateTime.getMonth() + 1).padStart(2, '0');
          const day = String(correctedDateTime.getDate()).padStart(2, '0');
          const timeHours = String(correctedDateTime.getHours()).padStart(2, '0');
          const timeMinutes = String(correctedDateTime.getMinutes()).padStart(2, '0');
          const timeSeconds = String(correctedDateTime.getSeconds()).padStart(2, '0');
          const localDateTimeString = `${year}-${month}-${day}T${timeHours}:${timeMinutes}:${timeSeconds}`;

          corrections.push({
            attendanceId: attendance.id,
            newTime: localDateTimeString,
            reason: formData.reason,
            comment: formData.comment,
          });
        }
      }
    }

    if (corrections.length === 0 && deletions.length === 0) {
      showAlert("修正・削除する項目がありません");
      return;
    }

    try {
      let totalActions = 0;

      // 削除処理
      for (const attendance of deletions) {
        const response = await fetch(`/api/attendance/delete?id=${attendance.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "削除に失敗しました");
        }
        totalActions++;
      }

      // 修正処理
      for (const correction of corrections) {
        const response = await fetch("/api/attendance/correct", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(correction),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "修正に失敗しました");
        }
        totalActions++;
      }

      const message = [];
      if (deletions.length > 0) message.push(`${deletions.length}件を削除`);
      if (corrections.length > 0) message.push(`${corrections.length}件を修正`);
      showAlert(`${message.join('、')}しました`);

      // 修正・削除した日付に戻る
      if (currentDay) {
        setTargetDay(currentDay);
      }

      setEditingDayAttendances([]);
      setBulkEditForm({
        wakeUp: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
        departure: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
        clockIn: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
        clockOut: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
      });
      
      fetchAttendances();
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "エラーが発生しました");
    }
  };

  const updateBulkEditForm = (type: string, field: string, value: string | boolean) => {
    setBulkEditForm(prev => ({
      ...prev,
      [type]: {
        ...prev[type as keyof typeof prev],
        [field]: value,
        hasChanges: field === 'time' ? true : prev[type as keyof typeof prev].hasChanges,
      }
    }));
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ja-JP");
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "CLOCK_IN": return "出勤";
      case "CLOCK_OUT": return "退勤";
      case "WAKE_UP": return "起床報告";
      case "DEPARTURE": return "出発報告";
      default: return type;
    }
  };

  // 月の日数を取得
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  // 勤怠データを日付とタイプでマッピング
  const attendanceMap = attendances.reduce((map, attendance) => {
    const date = new Date(attendance.date).getDate();
    const key = `${date}-${attendance.type}`;
    map[key] = attendance;
    return map;
  }, {} as Record<string, Attendance>);

  // 月の全日付を生成
  const daysInMonth = getDaysInMonth(year, month);
  const allDates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <PageAccessGuard page="attendanceHistory">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-md rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">勤怠履歴</h1>
            </div>

            {/* フィルター */}
            <div className={`mb-6 grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  年
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  月
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ユーザー
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.userId})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">読み込み中...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        日付
                      </th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        起床報告
                      </th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        出発報告
                      </th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        出勤時刻
                      </th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        退勤時刻
                      </th>
                      {isAdmin && (
                        <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allDates.map((day) => {
                      const dateStr = `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
                      const wakeUpAttendance = attendanceMap[`${day}-WAKE_UP`];
                      const departureAttendance = attendanceMap[`${day}-DEPARTURE`];
                      const clockInAttendance = attendanceMap[`${day}-CLOCK_IN`];
                      const clockOutAttendance = attendanceMap[`${day}-CLOCK_OUT`];
                      
                      return (
                        <tr key={day} id={`day-${day}`} className="hover:bg-gray-50">
                          <td className="py-4 px-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                            {dateStr} ({new Date(year, month - 1, day).toLocaleDateString('ja-JP', { weekday: 'short' }).slice(0, 1)})
                          </td>
                          
                          {/* 起床報告 */}
                          <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-700 text-center">
                            {wakeUpAttendance ? (
                              <div className="space-y-1">
                                <div className="font-medium text-gray-900">
                                  {formatTime(wakeUpAttendance.clockTime)}
                                </div>
                                {wakeUpAttendance.corrections.length > 0 && (
                                  <div className="text-xs text-orange-600 font-medium">
                                    修正済み
                                  </div>
                                )}
                                {isAdmin && wakeUpAttendance.latitude && wakeUpAttendance.longitude && (
                                  <div className="text-xs text-gray-500">
                                    📍 {wakeUpAttendance.latitude.toFixed(6)}, {wakeUpAttendance.longitude.toFixed(6)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* 出発報告 */}
                          <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-700 text-center">
                            {departureAttendance ? (
                              <div className="space-y-1">
                                <div className="font-medium text-gray-900">
                                  {formatTime(departureAttendance.clockTime)}
                                </div>
                                {departureAttendance.corrections.length > 0 && (
                                  <div className="text-xs text-orange-600 font-medium">
                                    修正済み
                                  </div>
                                )}
                                {isAdmin && departureAttendance.latitude && departureAttendance.longitude && (
                                  <div className="text-xs text-gray-500">
                                    📍 {departureAttendance.latitude.toFixed(6)}, {departureAttendance.longitude.toFixed(6)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* 出勤 */}
                          <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-700 text-center">
                            {clockInAttendance ? (
                              <div className="space-y-1">
                                <div className="font-medium text-gray-900">
                                  {formatTime(clockInAttendance.clockTime)}
                                </div>
                                {clockInAttendance.corrections.length > 0 && (
                                  <div className="text-xs text-orange-600 font-medium">
                                    修正済み
                                  </div>
                                )}
                                {isAdmin && clockInAttendance.latitude && clockInAttendance.longitude && (
                                  <div className="text-xs text-gray-500">
                                    📍 {clockInAttendance.latitude.toFixed(6)}, {clockInAttendance.longitude.toFixed(6)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* 退勤 */}
                          <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-700 text-center">
                            {clockOutAttendance ? (
                              <div className="space-y-1">
                                <div className="font-medium text-gray-900">
                                  {formatTime(clockOutAttendance.clockTime)}
                                </div>
                                {clockOutAttendance.corrections.length > 0 && (
                                  <div className="text-xs text-orange-600 font-medium">
                                    修正済み
                                  </div>
                                )}
                                {isAdmin && clockOutAttendance.latitude && clockOutAttendance.longitude && (
                                  <div className="text-xs text-gray-500">
                                    📍 {clockOutAttendance.latitude.toFixed(6)}, {clockOutAttendance.longitude.toFixed(6)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* 操作カラム */}
                          {isAdmin && (
                            <td className="py-4 px-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => openBulkEditModal(day)}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                編集
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 修正モーダル */}
            {editingAttendance && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      打刻時刻の修正
                    </h3>
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        {getTypeLabel(editingAttendance.type)} - {editingAttendance.user.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        現在の時刻: {formatDateTime(editingAttendance.clockTime)}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          新しい時刻 *
                        </label>
                        <input
                          type="time"
                          value={correctionForm.newTime}
                          onChange={(e) => setCorrectionForm(prev => ({ ...prev, newTime: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          修正理由 *
                        </label>
                        <select
                          value={correctionForm.reason}
                          onChange={(e) => setCorrectionForm(prev => ({ ...prev, reason: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        >
                          <option value="">選択してください</option>
                          <option value="打刻忘れ">打刻忘れ</option>
                          <option value="システム不具合">システム不具合</option>
                          <option value="GPS位置情報エラー">GPS位置情報エラー</option>
                          <option value="その他">その他</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          コメント
                        </label>
                        <textarea
                          value={correctionForm.comment}
                          onChange={(e) => setCorrectionForm(prev => ({ ...prev, comment: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          rows={3}
                          placeholder="詳細な説明があれば入力してください"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setEditingAttendance(null);
                          setCorrectionForm({ newTime: "", reason: "", comment: "" });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleCorrection}
                        className="px-4 py-2 text-sm font-medium text-white bg-[#4A90E2] rounded-md hover:bg-blue-600"
                      >
                        修正する
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 一括編集モーダル */}
            {editingDayAttendances.length > 0 && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {editingDayAttendances.length > 0 ? new Date(editingDayAttendances[0].date).getDate() : ''}日の勤怠一括編集
                      </h3>
                      <button
                        onClick={() => {
                          setEditingDayAttendances([]);
                          setBulkEditForm({
                            wakeUp: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                            departure: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                            clockIn: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                            clockOut: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                          });
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 起床報告 */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          起床報告
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">時刻</label>
                              <input
                                type="time"
                                value={bulkEditForm.wakeUp.time}
                                onChange={(e) => updateBulkEditForm('wakeUp', 'time', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                disabled={bulkEditForm.wakeUp.shouldDelete}
                              />
                            </div>
                            {bulkEditForm.wakeUp.time && (
                              <div className="flex items-center mt-6">
                                <input
                                  type="checkbox"
                                  id="delete-wakeUp"
                                  checked={bulkEditForm.wakeUp.shouldDelete}
                                  onChange={(e) => updateBulkEditForm('wakeUp', 'shouldDelete', e.target.checked)}
                                  className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <label htmlFor="delete-wakeUp" className="ml-2 text-sm text-red-600">削除</label>
                              </div>
                            )}
                          </div>
                          {bulkEditForm.wakeUp.hasChanges && !bulkEditForm.wakeUp.shouldDelete && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">修正理由 *</label>
                                <select
                                  value={bulkEditForm.wakeUp.reason}
                                  onChange={(e) => updateBulkEditForm('wakeUp', 'reason', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  required
                                >
                                  <option value="">選択してください</option>
                                  <option value="打刻忘れ">打刻忘れ</option>
                                  <option value="システム不具合">システム不具合</option>
                                  <option value="GPS位置情報エラー">GPS位置情報エラー</option>
                                  <option value="その他">その他</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                                <textarea
                                  value={bulkEditForm.wakeUp.comment}
                                  onChange={(e) => updateBulkEditForm('wakeUp', 'comment', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  rows={2}
                                  placeholder="詳細な説明があれば入力してください"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 出発報告 */}
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <h4 className="font-medium text-green-900 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          出発報告
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">時刻</label>
                              <input
                                type="time"
                                value={bulkEditForm.departure.time}
                                onChange={(e) => updateBulkEditForm('departure', 'time', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                disabled={bulkEditForm.departure.shouldDelete}
                              />
                            </div>
                            {bulkEditForm.departure.time && (
                              <div className="flex items-center mt-6">
                                <input
                                  type="checkbox"
                                  id="delete-departure"
                                  checked={bulkEditForm.departure.shouldDelete}
                                  onChange={(e) => updateBulkEditForm('departure', 'shouldDelete', e.target.checked)}
                                  className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <label htmlFor="delete-departure" className="ml-2 text-sm text-red-600">削除</label>
                              </div>
                            )}
                          </div>
                          {bulkEditForm.departure.hasChanges && !bulkEditForm.departure.shouldDelete && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">修正理由 *</label>
                                <select
                                  value={bulkEditForm.departure.reason}
                                  onChange={(e) => updateBulkEditForm('departure', 'reason', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  required
                                >
                                  <option value="">選択してください</option>
                                  <option value="打刻忘れ">打刻忘れ</option>
                                  <option value="システム不具合">システム不具合</option>
                                  <option value="GPS位置情報エラー">GPS位置情報エラー</option>
                                  <option value="その他">その他</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                                <textarea
                                  value={bulkEditForm.departure.comment}
                                  onChange={(e) => updateBulkEditForm('departure', 'comment', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  rows={2}
                                  placeholder="詳細な説明があれば入力してください"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 出勤時刻 */}
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          出勤時刻
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">時刻</label>
                              <input
                                type="time"
                                value={bulkEditForm.clockIn.time}
                                onChange={(e) => updateBulkEditForm('clockIn', 'time', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                disabled={bulkEditForm.clockIn.shouldDelete}
                              />
                            </div>
                            {bulkEditForm.clockIn.time && (
                              <div className="flex items-center mt-6">
                                <input
                                  type="checkbox"
                                  id="delete-clockIn"
                                  checked={bulkEditForm.clockIn.shouldDelete}
                                  onChange={(e) => updateBulkEditForm('clockIn', 'shouldDelete', e.target.checked)}
                                  className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <label htmlFor="delete-clockIn" className="ml-2 text-sm text-red-600">削除</label>
                              </div>
                            )}
                          </div>
                          {bulkEditForm.clockIn.hasChanges && !bulkEditForm.clockIn.shouldDelete && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">修正理由 *</label>
                                <select
                                  value={bulkEditForm.clockIn.reason}
                                  onChange={(e) => updateBulkEditForm('clockIn', 'reason', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  required
                                >
                                  <option value="">選択してください</option>
                                  <option value="打刻忘れ">打刻忘れ</option>
                                  <option value="システム不具合">システム不具合</option>
                                  <option value="GPS位置情報エラー">GPS位置情報エラー</option>
                                  <option value="その他">その他</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                                <textarea
                                  value={bulkEditForm.clockIn.comment}
                                  onChange={(e) => updateBulkEditForm('clockIn', 'comment', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  rows={2}
                                  placeholder="詳細な説明があれば入力してください"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 退勤時刻 */}
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <h4 className="font-medium text-orange-900 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          退勤時刻
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">時刻</label>
                              <input
                                type="time"
                                value={bulkEditForm.clockOut.time}
                                onChange={(e) => updateBulkEditForm('clockOut', 'time', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                disabled={bulkEditForm.clockOut.shouldDelete}
                              />
                            </div>
                            {bulkEditForm.clockOut.time && (
                              <div className="flex items-center mt-6">
                                <input
                                  type="checkbox"
                                  id="delete-clockOut"
                                  checked={bulkEditForm.clockOut.shouldDelete}
                                  onChange={(e) => updateBulkEditForm('clockOut', 'shouldDelete', e.target.checked)}
                                  className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <label htmlFor="delete-clockOut" className="ml-2 text-sm text-red-600">削除</label>
                              </div>
                            )}
                          </div>
                          {bulkEditForm.clockOut.hasChanges && !bulkEditForm.clockOut.shouldDelete && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">修正理由 *</label>
                                <select
                                  value={bulkEditForm.clockOut.reason}
                                  onChange={(e) => updateBulkEditForm('clockOut', 'reason', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  required
                                >
                                  <option value="">選択してください</option>
                                  <option value="打刻忘れ">打刻忘れ</option>
                                  <option value="システム不具合">システム不具合</option>
                                  <option value="GPS位置情報エラー">GPS位置情報エラー</option>
                                  <option value="その他">その他</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                                <textarea
                                  value={bulkEditForm.clockOut.comment}
                                  onChange={(e) => updateBulkEditForm('clockOut', 'comment', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                                  rows={2}
                                  placeholder="詳細な説明があれば入力してください"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        ※ 時刻を変更した項目のみ修正されます
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            setEditingDayAttendances([]);
                            setBulkEditForm({
                              wakeUp: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                              departure: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                              clockIn: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                              clockOut: { time: "", reason: "", comment: "", hasChanges: false, shouldDelete: false },
                            });
                          }}
                          className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={handleBulkCorrection}
                          className="px-6 py-2 text-sm font-medium text-white bg-[#4A90E2] rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg"
                        >
                          一括修正する
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    </PageAccessGuard>
  );
}