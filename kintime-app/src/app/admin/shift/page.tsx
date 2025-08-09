"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminShiftPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shiftRequests, setShiftRequests] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [newShift, setNewShift] = useState({
    userId: "",
    projectId: "",
    startTime: "",
    endTime: "",
    shiftType: "REGULAR" as "REGULAR" | "SPOT",
    location: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "MANAGER") {
        router.push("/dashboard");
        return;
      }
      fetchShiftRequests();
      fetchProjects();
      fetchUsers();
    }
  }, [status, currentMonth]);

  const fetchShiftRequests = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/admin/shift/requests?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setShiftRequests(data);
      }
    } catch (error) {
      console.error("シフト希望取得エラー:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/admin/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error("プロジェクト取得エラー:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("ユーザー取得エラー:", error);
    }
  };

  const createShift = async () => {
    try {
      const shiftData = {
        ...newShift,
        date: selectedDate,
        startTime: `${selectedDate}T${newShift.startTime}:00`,
        endTime: `${selectedDate}T${newShift.endTime}:00`,
      };

      const response = await fetch("/api/admin/shift/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shiftData),
      });

      if (response.ok) {
        alert("シフトを作成しました");
        setShowCreateShift(false);
        setNewShift({
          userId: "",
          projectId: "",
          startTime: "",
          endTime: "",
          shiftType: "REGULAR",
          location: "",
        });
        fetchShiftRequests();
      } else {
        alert("シフトの作成に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  const groupedRequests = shiftRequests.reduce((acc, request) => {
    const date = new Date(request.date).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(request);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">シフト管理（管理者）</h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowCreateShift(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  シフト作成
                </button>
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

            <div className="space-y-6">
              {Object.entries(groupedRequests).map(([date, requests]: [string, any]) => (
                <div key={date} className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-3">
                    {new Date(date).toLocaleDateString("ja-JP", {
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {requests.map((request: any) => (
                      <div key={request.id} className="bg-gray-50 p-3 rounded">
                        <div className="font-medium">{request.user.name}</div>
                        <div className="text-sm text-gray-600">
                          {request.user.role} | {request.user.partner?.name || "自社"}
                        </div>
                        <div className="text-sm text-green-600">
                          {request.isAvailable ? "勤務可能" : "勤務不可"}
                        </div>
                        {request.note && (
                          <div className="text-xs text-gray-500 mt-1">{request.note}</div>
                        )}
                        <button
                          onClick={() => {
                            setSelectedDate(new Date(request.date).toISOString().split('T')[0]);
                            setNewShift({...newShift, userId: request.userId});
                            setShowCreateShift(true);
                          }}
                          className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          シフト作成
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(groupedRequests).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                この月のシフト希望はありません
              </div>
            )}

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

      {/* シフト作成モーダル */}
      {showCreateShift && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">シフト作成</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">日付</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">スタッフ</label>
                <select
                  value={newShift.userId}
                  onChange={(e) => setNewShift({...newShift, userId: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">選択してください</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">プロジェクト</label>
                <select
                  value={newShift.projectId}
                  onChange={(e) => setNewShift({...newShift, projectId: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">選択してください</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} - {project.client}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">開始時間</label>
                  <input
                    type="time"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({...newShift, startTime: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">終了時間</label>
                  <input
                    type="time"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({...newShift, endTime: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">シフトタイプ</label>
                <select
                  value={newShift.shiftType}
                  onChange={(e) => setNewShift({...newShift, shiftType: e.target.value as "REGULAR" | "SPOT"})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="REGULAR">常勤シフト</option>
                  <option value="SPOT">スポットシフト</option>
                </select>
              </div>

              {newShift.shiftType === "SPOT" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">勤務地</label>
                  <input
                    type="text"
                    value={newShift.location}
                    onChange={(e) => setNewShift({...newShift, location: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="勤務地を入力"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateShift(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={createShift}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}