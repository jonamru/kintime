"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type AttendanceType = "CLOCK_IN" | "CLOCK_OUT" | "WAKE_UP" | "DEPARTURE";

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchTodayAttendance();
    }
  }, [status]);

  useEffect(() => {
    if (gpsEnabled && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("位置情報の取得に失敗しました:", error);
        }
      );
    }
  }, [gpsEnabled]);

  const fetchTodayAttendance = async () => {
    try {
      const response = await fetch("/api/attendance/today");
      if (response.ok) {
        const data = await response.json();
        setTodayAttendance(data);
      }
    } catch (error) {
      console.error("勤怠情報の取得に失敗しました:", error);
    }
  };

  const handleClock = async (type: AttendanceType) => {
    setLoading(true);
    try {
      const response = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          latitude: gpsEnabled ? location?.lat : null,
          longitude: gpsEnabled ? location?.lng : null,
        }),
      });

      if (response.ok) {
        await fetchTodayAttendance();
        alert("打刻しました");
      } else {
        alert("打刻に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const getButtonStatus = (type: AttendanceType) => {
    return todayAttendance.some((a) => a.type === type);
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

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">勤怠打刻</h1>

            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={gpsEnabled}
                  onChange={(e) => setGpsEnabled(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">GPS情報を取得する</span>
              </label>
              {gpsEnabled && location && (
                <p className="text-xs text-gray-500 mt-1">
                  現在地: 緯度 {location.lat.toFixed(6)}, 経度 {location.lng.toFixed(6)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => handleClock("CLOCK_IN")}
                disabled={loading || getButtonStatus("CLOCK_IN")}
                className={`py-4 px-6 rounded-lg font-medium text-white ${
                  getButtonStatus("CLOCK_IN")
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                } transition-colors`}
              >
                出勤
              </button>
              <button
                onClick={() => handleClock("CLOCK_OUT")}
                disabled={loading || getButtonStatus("CLOCK_OUT")}
                className={`py-4 px-6 rounded-lg font-medium text-white ${
                  getButtonStatus("CLOCK_OUT")
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                } transition-colors`}
              >
                退勤
              </button>
              <button
                onClick={() => handleClock("WAKE_UP")}
                disabled={loading || getButtonStatus("WAKE_UP")}
                className={`py-4 px-6 rounded-lg font-medium text-white ${
                  getButtonStatus("WAKE_UP")
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                } transition-colors`}
              >
                起床報告
              </button>
              <button
                onClick={() => handleClock("DEPARTURE")}
                disabled={loading || getButtonStatus("DEPARTURE")}
                className={`py-4 px-6 rounded-lg font-medium text-white ${
                  getButtonStatus("DEPARTURE")
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700"
                } transition-colors`}
              >
                出発報告
              </button>
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                本日の打刻記録
              </h2>
              {todayAttendance.length === 0 ? (
                <p className="text-gray-500">まだ打刻がありません</p>
              ) : (
                <ul className="space-y-2">
                  {todayAttendance.map((attendance) => (
                    <li
                      key={attendance.id}
                      className="flex justify-between py-2 px-3 bg-gray-50 rounded"
                    >
                      <span className="font-medium">
                        {attendance.type === "CLOCK_IN" && "出勤"}
                        {attendance.type === "CLOCK_OUT" && "退勤"}
                        {attendance.type === "WAKE_UP" && "起床報告"}
                        {attendance.type === "DEPARTURE" && "出発報告"}
                      </span>
                      <span className="text-gray-600">
                        {formatTime(attendance.clockTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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