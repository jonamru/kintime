"use client";

import { useState, useEffect } from "react";

import { showAlert, showNotification } from '@/lib/notification';
import PageAccessGuard from "@/components/PageAccessGuard";
import TimeBaseHeader from "@/components/TimeBaseHeader";

export default function ImprovedAttendancePage() {
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsRequired, setIsGpsRequired] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastAttendance, setLastAttendance] = useState<any>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState<string | null>(null);
  const [confirmationSettings, setConfirmationSettings] = useState({
    showConfirmDialog: false,
    enableUndo: true,
    undoTimeoutMs: 5000
  });

  useEffect(() => {
    // ページタイトルを設定
    document.title = "TimeBase - 勤怠打刻";
    
    fetchTodayAttendance();
    fetchUserSettings();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userSettings?.gpsEnabled) {
      setIsGpsRequired(true);
      requestLocation();
    } else {
      setIsGpsRequired(false);
      setGpsError(null);
    }
  }, [userSettings]);

  const requestLocation = () => {
    console.log("GPS取得開始");
    
    // HTTPS接続チェック
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setGpsError("位置情報を取得するにはHTTPS接続が必要です。");
      setGpsLoading(false);
      return;
    }
    
    if (!navigator.geolocation) {
      setGpsError("このブラウザは位置情報をサポートしていません。");
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);
    setLocation(null);

    // 権限状態をチェック（対応ブラウザのみ）
    if (navigator.permissions) {
      navigator.permissions.query({name: 'geolocation'}).then((result) => {
        console.log("GPS権限状態:", result.state);
        if (result.state === 'denied') {
          setGpsError("位置情報の使用が拒否されています。ブラウザの設定で位置情報を許可してください。");
          setGpsLoading(false);
          return;
        } else {
          // 権限が拒否されていない場合のみ位置情報を取得
          getLocationPosition();
        }
      }).catch((err) => {
        console.log("権限チェックエラー:", err);
        // 権限APIが使えない場合は直接取得を試みる
        getLocationPosition();
      });
    } else {
      // 権限APIが使えない場合は直接取得を試みる
      getLocationPosition();
    }
  };

  const getLocationPosition = () => {
    // iOSの検出
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // iOSの場合の特別な設定
    const options: PositionOptions = {
      enableHighAccuracy: false, // iOSではfalseの方が安定する場合がある
      timeout: isIOS ? 30000 : 10000, // iOSでは長めのタイムアウト
      maximumAge: 0 // キャッシュを使用しない
    };

    console.log("GPS取得開始 (iOS:", isIOS, ", options:", options, ")");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("GPS取得成功:", position.coords);
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsError(null);
        setGpsLoading(false);
      },
      (error) => {
        let errorMessage = "";
        let debugInfo = "";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "位置情報の使用が拒否されました。";
            if (isIOS) {
              debugInfo = "設定 > プライバシーとセキュリティ > 位置情報サービス から、このサイトへのアクセスを許可してください。";
            } else {
              debugInfo = "ブラウザの設定から位置情報の使用を許可してください。";
            }
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "位置情報を取得できませんでした。";
            debugInfo = "GPS信号が弱い可能性があります。屋外や窓際で再度お試しください。";
            break;
          case error.TIMEOUT:
            errorMessage = "位置情報の取得がタイムアウトしました。";
            debugInfo = "通信環境を確認して、再度お試しください。";
            break;
          default:
            errorMessage = "位置情報の取得中に不明なエラーが発生しました。";
            debugInfo = `エラーコード: ${error.code}, メッセージ: ${error.message}`;
            break;
        }
        
        // 権限拒否は通常の動作なのでconsole.logを使用
        if (error.code === error.PERMISSION_DENIED) {
          console.log("GPS権限拒否:", errorMessage, debugInfo);
        } else {
          console.error("GPS取得エラー:", errorMessage, error, debugInfo);
        }
        
        setGpsError(`${errorMessage}\n${debugInfo}`);
        setLocation(null);
        setGpsLoading(false);
      },
      options
    );
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await fetch("/api/attendance/today");
      if (response.ok) {
        const data = await response.json();
        setTodayAttendance(data.attendance || []);
      }
    } catch (error) {
      console.error("勤怠情報の取得に失敗しました:", error);
    }
  };

  const fetchUserSettings = async () => {
    try {
      const response = await fetch("/api/attendance/user-settings");
      if (response.ok) {
        const data = await response.json();
        setUserSettings(data);
      }
    } catch (error) {
      console.error("ユーザー設定の取得に失敗しました:", error);
    }
  };

  // 改善された打刻処理
  const handleClock = async (type: string) => {
    // GPS必須ユーザーの位置情報チェック
    if (isGpsRequired && !location) {
      showAlert("位置情報が必要です。位置情報を有効にしてから打刻してください。");
      return;
    }

    // 打刻順序のチェック
    if (!isClockingAllowed(type)) {
      showAlert("打刻順序が正しくありません。正しい順序で打刻してください。");
      return;
    }

    // 確認ダイアログが有効な場合
    if (confirmationSettings.showConfirmDialog) {
      const confirmed = confirm(`${getTypeLabel(type)}しますか？`);
      if (!confirmed) return;
    }

    setLoading(true);
    
    try {
      const response = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          latitude: userSettings?.gpsEnabled ? location?.lat : null,
          longitude: userSettings?.gpsEnabled ? location?.lng : null,
        }),
      });

      if (response.ok) {
        const newAttendance = await response.json();
        await fetchTodayAttendance();
        
        // 成功アニメーションを表示
        setSuccessAnimation(type);
        setTimeout(() => setSuccessAnimation(null), 1000);
        
        // Undo機能が有効な場合
        if (confirmationSettings.enableUndo) {
          setLastAttendance(newAttendance);
          setShowUndo(true);
          
          // Undoタイマーをセット
          if (undoTimer) clearTimeout(undoTimer);
          const timer = setTimeout(() => {
            setShowUndo(false);
            setLastAttendance(null);
          }, confirmationSettings.undoTimeoutMs);
          setUndoTimer(timer);
        }

        // 強化された成功通知
        showNotification(`${getTypeLabel(type)}しました！`, 'success');
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "打刻に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // Undo機能
  const handleUndo = async () => {
    if (!lastAttendance) return;
    
    try {
      const response = await fetch("/api/attendance/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendanceId: lastAttendance.id,
        }),
      });

      if (response.ok) {
        await fetchTodayAttendance();
        showNotification("打刻を取り消しました", 'info');
        
        // Undoステートをクリア
        setShowUndo(false);
        setLastAttendance(null);
        if (undoTimer) clearTimeout(undoTimer);
      } else {
        showAlert("取り消しに失敗しました");
      }
    } catch (error) {
      showAlert("取り消し処理でエラーが発生しました");
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "WAKE_UP": return "起床報告";
      case "DEPARTURE": return "出発報告";
      case "CLOCK_IN": return "出勤";
      case "CLOCK_OUT": return "退勤";
      default: return "打刻";
    }
  };

  const getButtonStatus = (type: string) => {
    return todayAttendance.some((a) => a.type === type);
  };

  const isClockingAllowed = (type: string) => {
    const hasWakeUp = getButtonStatus("WAKE_UP");
    const hasDeparture = getButtonStatus("DEPARTURE");
    const hasClockIn = getButtonStatus("CLOCK_IN");
    const hasClockOut = getButtonStatus("CLOCK_OUT");

    switch (type) {
      case "WAKE_UP":
        return true;
      case "DEPARTURE":
        if (userSettings?.wakeUpEnabled) {
          return hasWakeUp;
        }
        return true;
      case "CLOCK_IN":
        if (userSettings?.departureEnabled) {
          return hasDeparture;
        } else if (userSettings?.wakeUpEnabled) {
          return hasWakeUp;
        }
        return true;
      case "CLOCK_OUT":
        return hasClockIn;
      default:
        return true;
    }
  };

  const getButtonClass = (type: string) => {
    const isDisabled = loading || getButtonStatus(type) || !isClockingAllowed(type);
    const isAnimating = successAnimation === type;
    
    const baseClass = "relative inline-block w-full max-w-72 py-5 mb-4 border-none rounded-xl text-xl font-bold text-white cursor-pointer transition-all duration-300 shadow-lg transform";
    
    if (isDisabled) {
      return `${baseClass} bg-gray-400 cursor-not-allowed opacity-75`;
    }

    let colorClass = "";
    switch (type) {
      case "WAKE_UP":
        colorClass = "bg-blue-600 hover:bg-blue-700";
        break;
      case "DEPARTURE":
        colorClass = "bg-purple-600 hover:bg-purple-700";
        break;
      case "CLOCK_IN":
        colorClass = "bg-[#4A90E2] hover:bg-blue-600";
        break;
      case "CLOCK_OUT":
        colorClass = "bg-[#e74c3c] hover:bg-red-600";
        break;
      default:
        colorClass = "bg-gray-600 hover:bg-gray-700";
        break;
    }

    const hoverClass = "hover:-translate-y-1 hover:shadow-xl active:scale-95";
    const animationClass = isAnimating ? "animate-pulse bg-green-500 scale-105" : "";

    return `${baseClass} ${colorClass} ${hoverClass} ${animationClass}`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!userSettings) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div>Loading...</div>
    </div>;
  }

  return (
    <PageAccessGuard page="attendance">
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

      {/* メインコンテンツエリア */}
      <main className="flex justify-center items-center px-5 py-10 min-h-[calc(100vh-4rem)] bg-[#f4f7fc]">
        <div className="w-full max-w-lg text-center bg-white p-10 rounded-2xl shadow-xl">
          
          {/* 時計表示 */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-gray-800 mb-2 tracking-wider">
              {currentTime.toLocaleTimeString("ja-JP", { hour12: false })}
            </h1>
            <p className="text-lg text-gray-600">
              {currentTime.getFullYear()}年{currentTime.getMonth() + 1}月{currentTime.getDate()}日 ({['日', '月', '火', '水', '木', '金', '土'][currentTime.getDay()]})
            </p>
          </div>

          {/* ステータス表示 */}
          <div className="mb-8 py-3 px-4 bg-[#eaf2fd] text-[#4A90E2] rounded-lg text-lg font-medium">
            現在のステータス: <strong>
              {todayAttendance.length === 0 ? "勤務前" :
               todayAttendance.some(a => a.type === "CLOCK_OUT") ? "退勤済み" :
               todayAttendance.some(a => a.type === "CLOCK_IN") ? "勤務中" :
               todayAttendance.some(a => a.type === "DEPARTURE") ? "出発済み" :
               todayAttendance.some(a => a.type === "WAKE_UP") ? "起床報告済み" :
               "勤務前"}
            </strong>
          </div>

          {/* Undo通知 */}
          {showUndo && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-green-400 mr-2">✅</span>
                  <span className="text-sm text-green-800 font-medium">
                    {getTypeLabel(lastAttendance?.type)}が完了しました
                  </span>
                </div>
                <button
                  onClick={handleUndo}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                >
                  取り消し
                </button>
              </div>
              <div className="mt-2">
                <div className="w-full bg-green-200 rounded-full h-1">
                  <div 
                    className="bg-green-600 h-1 rounded-full transition-all duration-300"
                    style={{
                      width: '100%',
                      animation: `shrink ${confirmationSettings.undoTimeoutMs}ms linear forwards`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {userSettings.gpsEnabled && (
            <div className={`mb-6 border rounded-lg p-4 ${
              gpsError 
                ? 'bg-red-50 border-red-200' 
                : location 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${
                  gpsError 
                    ? 'text-red-700' 
                    : location 
                      ? 'text-green-700' 
                      : 'text-yellow-700'
                }`}>
                  📍 GPS情報取得: {
                    gpsLoading ? '取得中...' :
                    location ? '取得完了' : 
                    gpsError ? '取得失敗' : 
                    '待機中'
                  }
                </span>
                {(gpsError || (!location && !gpsLoading)) && (
                  <button
                    onClick={requestLocation}
                    disabled={gpsLoading}
                    className={`px-3 py-1 text-white text-xs rounded transition-colors ${
                      gpsLoading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {gpsLoading ? '取得中...' : gpsError ? '再取得' : '取得開始'}
                  </button>
                )}
              </div>
              {location ? (
                <p className="text-xs text-green-600 mt-1">
                  現在地: 緯度 {location.lat.toFixed(6)}, 経度 {location.lng.toFixed(6)}
                </p>
              ) : gpsError ? (
                <p className="text-xs text-red-600 mt-1">
                  {gpsError}
                  <br />
                  <small className="text-gray-500">
                    ※ブラウザの位置情報設定を確認してください
                    {/iPhone|iPad|iPod/.test(navigator.userAgent) && (
                      <span className="block mt-1">
                        iOS設定: 設定アプリ → Safari → 位置情報 → 許可
                      </span>
                    )}
                  </small>
                </p>
              ) : gpsLoading ? (
                <p className="text-xs text-blue-600 mt-1">
                  📡 位置情報を取得中...（ブラウザで位置情報の使用を許可してください）
                </p>
              ) : (
                <p className="text-xs text-yellow-600 mt-1">
                  位置情報の取得が必要です。上記ボタンを押して取得してください。
                </p>
              )}
            </div>
          )}

          {/* アクションボタン */}
          <div className="mb-10 space-y-4">
              {userSettings.wakeUpEnabled && (
              <button
                onClick={() => handleClock("WAKE_UP")}
                disabled={loading || getButtonStatus("WAKE_UP") || !isClockingAllowed("WAKE_UP") || (isGpsRequired && !location)}
                className={getButtonClass("WAKE_UP")}
              >
                <svg className="inline-block w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                起床報告
              </button>
            )}
            
            {userSettings.departureEnabled && (
              <button
                onClick={() => handleClock("DEPARTURE")}
                disabled={loading || getButtonStatus("DEPARTURE") || !isClockingAllowed("DEPARTURE") || (isGpsRequired && !location)}
                className={getButtonClass("DEPARTURE")}
              >
                <svg className="inline-block w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                出発報告
              </button>
            )}

            <button
              onClick={() => handleClock("CLOCK_IN")}
              disabled={loading || getButtonStatus("CLOCK_IN") || !isClockingAllowed("CLOCK_IN") || (isGpsRequired && !location)}
              className={getButtonClass("CLOCK_IN")}
            >
              <svg className="inline-block w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              出勤
            </button>

            <button
              onClick={() => handleClock("CLOCK_OUT")}
              disabled={loading || getButtonStatus("CLOCK_OUT") || !isClockingAllowed("CLOCK_OUT") || (isGpsRequired && !location)}
              className={getButtonClass("CLOCK_OUT")}
            >
              <svg className="inline-block w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退勤
            </button>
          </div>

          {isGpsRequired && !location && (
            <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-orange-400">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800">
                    位置情報が必要です
                  </h3>
                  <div className="mt-2 text-sm text-orange-700">
                    <p>打刻には位置情報が必要です。位置情報を有効にしてから打刻を行ってください。</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 本日の打刻記録 */}
          <div className="mb-10 text-left">
            <h3 className="text-lg font-bold mb-4 pb-2 border-b border-gray-200">
              本日の打刻記録
            </h3>
            {todayAttendance.length === 0 ? (
              <p className="text-gray-500 text-center py-4">まだ打刻がありません</p>
            ) : (
              <ul className="space-y-0">
                {todayAttendance.map((attendance) => (
                  <li
                    key={attendance.id}
                    className="flex justify-between py-3 px-1 text-base border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-gray-600">
                      {attendance.type === "CLOCK_IN" && "出勤"}
                      {attendance.type === "CLOCK_OUT" && "退勤"}
                      {attendance.type === "WAKE_UP" && "起床報告"}
                      {attendance.type === "DEPARTURE" && "出発報告"}
                    </span>
                    <span className="font-medium text-gray-800">
                      {formatTime(attendance.clockTime)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* 履歴リンク */}
          <a
            href="/attendance/history"
            className="inline-block mt-8 text-[#4A90E2] no-underline font-medium hover:underline"
          >
            すべての履歴を見る 
            <svg className="inline-block w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>

        </div>
      </main>

      {/* アニメーション用のCSS */}
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </PageAccessGuard>
  );
}