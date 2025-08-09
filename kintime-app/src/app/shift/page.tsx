"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ShiftPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftRequests, setShiftRequests] = useState<any[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchShifts();
      fetchShiftRequests();
    }
  }, [status, currentMonth]);

  const fetchShifts = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/shift/confirmed?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      }
    } catch (error) {
      console.error("シフト取得エラー:", error);
    }
  };

  const fetchShiftRequests = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/shift/requests?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setShiftRequests(data);
        
        // 希望提出済みの日付をセットに追加
        const submittedDates = new Set(
          data.map((req: any) => new Date(req.date).toDateString())
        );
        setSelectedDates(submittedDates);
      }
    } catch (error) {
      console.error("シフト希望取得エラー:", error);
    }
  };

  const handleDateClick = (date: Date) => {
    const dateString = date.toDateString();
    const newSelectedDates = new Set(selectedDates);
    
    if (newSelectedDates.has(dateString)) {
      newSelectedDates.delete(dateString);
    } else {
      newSelectedDates.add(dateString);
    }
    setSelectedDates(newSelectedDates);
  };

  const submitShiftRequests = async () => {
    setLoading(true);
    try {
      const requests = Array.from(selectedDates).map(dateString => ({
        date: new Date(dateString).toISOString().split('T')[0],
        isAvailable: true
      }));

      const response = await fetch("/api/shift/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      });

      if (response.ok) {
        alert("シフト希望を提出しました");
        fetchShiftRequests();
      } else {
        alert("シフト希望の提出に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const isDateInCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const getShiftForDate = (date: Date) => {
    return shifts.find(shift => 
      new Date(shift.date).toDateString() === date.toDateString()
    );
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">シフト管理</h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  ＜
                </button>
                <span className="text-lg font-medium">
                  {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                </span>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  ＞
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-4">
              {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                <div key={day} className="p-2 text-center font-medium text-gray-700 bg-gray-50">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mb-6">
              {days.map((day, index) => {
                const isCurrentMonth = isDateInCurrentMonth(day);
                const isSelected = selectedDates.has(day.toDateString());
                const shift = getShiftForDate(day);

                return (
                  <div
                    key={index}
                    onClick={() => isCurrentMonth && handleDateClick(day)}
                    className={`
                      p-2 min-h-[80px] border cursor-pointer transition-colors
                      ${!isCurrentMonth ? "bg-gray-100 text-gray-400" : "bg-white"}
                      ${isSelected ? "bg-blue-100 border-blue-300" : "border-gray-200"}
                      ${shift ? "bg-green-100 border-green-300" : ""}
                      hover:bg-gray-50
                    `}
                  >
                    <div className="text-sm font-medium">{day.getDate()}</div>
                    {shift && (
                      <div className="text-xs text-green-700 mt-1">
                        <div className="font-medium">{shift.project.name}</div>
                        <div>
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </div>
                        {shift.location && (
                          <div className="text-gray-600">{shift.location}</div>
                        )}
                      </div>
                    )}
                    {isSelected && !shift && (
                      <div className="text-xs text-blue-700 mt-1">希望中</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 mr-2"></div>
                    <span>希望提出済み</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 mr-2"></div>
                    <span>シフト確定</span>
                  </div>
                </div>
              </div>
              <button
                onClick={submitShiftRequests}
                disabled={loading || selectedDates.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "送信中..." : "シフト希望を提出"}
              </button>
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
  );
}