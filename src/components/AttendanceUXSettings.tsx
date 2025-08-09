"use client";

import { useState, useEffect } from "react";
import { showAlert, showNotification } from "@/lib/notification";

interface AttendanceUXSettingsProps {
  userId?: string;
  onSettingsChange?: (settings: AttendanceUXSettings) => void;
}

interface AttendanceUXSettings {
  showConfirmDialog: boolean;
  enableUndo: boolean;
  undoTimeoutMs: number;
  enableSuccessAnimation: boolean;
  enableSoundFeedback: boolean;
}

export default function AttendanceUXSettings({ 
  userId, 
  onSettingsChange 
}: AttendanceUXSettingsProps) {
  const [settings, setSettings] = useState<AttendanceUXSettings>({
    showConfirmDialog: false,
    enableUndo: true,
    undoTimeoutMs: 5000,
    enableSuccessAnimation: true,
    enableSoundFeedback: false,
  });
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/user/settings");
      if (response.ok) {
        const data = await response.json();
        const uxSettings = data.attendanceUX || settings;
        setSettings(uxSettings);
        onSettingsChange?.(uxSettings);
      }
    } catch (error) {
      console.error("設定の読み込みに失敗しました:", error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendanceUX: settings,
        }),
      });

      if (response.ok) {
        showNotification("設定を保存しました", "success");
        setIsDirty(false);
        onSettingsChange?.(settings);
      } else {
        showAlert("設定の保存に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof AttendanceUXSettings>(
    key: K,
    value: AttendanceUXSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setIsDirty(true);
  };

  const resetToDefaults = () => {
    const defaultSettings: AttendanceUXSettings = {
      showConfirmDialog: false,
      enableUndo: true,
      undoTimeoutMs: 5000,
      enableSuccessAnimation: true,
      enableSoundFeedback: false,
    };
    setSettings(defaultSettings);
    setIsDirty(true);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          勤怠打刻のUX設定
        </h3>
        <p className="text-sm text-gray-600">
          勤怠打刻の操作性やフィードバックをカスタマイズできます
        </p>
      </div>

      <div className="space-y-6">
        {/* 確認ダイアログ設定 */}
        <div className="border-b border-gray-200 pb-6">
          <h4 className="font-semibold text-gray-800 mb-3">操作確認</h4>
          
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="showConfirmDialog"
              checked={settings.showConfirmDialog}
              onChange={(e) => updateSetting("showConfirmDialog", e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <label htmlFor="showConfirmDialog" className="text-sm font-medium text-gray-700">
                打刻前に確認ダイアログを表示
              </label>
              <p className="text-xs text-gray-500 mt-1">
                有効にすると、打刻ボタンを押した際に確認ダイアログが表示されます
              </p>
            </div>
          </div>
        </div>

        {/* Undo機能設定 */}
        <div className="border-b border-gray-200 pb-6">
          <h4 className="font-semibold text-gray-800 mb-3">操作の取り消し</h4>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="enableUndo"
                checked={settings.enableUndo}
                onChange={(e) => updateSetting("enableUndo", e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <label htmlFor="enableUndo" className="text-sm font-medium text-gray-700">
                  打刻後に取り消しボタンを表示
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  打刻成功後、一定時間「取り消し」ボタンを表示します
                </p>
              </div>
            </div>

            {settings.enableUndo && (
              <div className="ml-7">
                <label htmlFor="undoTimeout" className="block text-sm font-medium text-gray-700 mb-2">
                  取り消し可能時間: {settings.undoTimeoutMs / 1000}秒
                </label>
                <input
                  type="range"
                  id="undoTimeout"
                  min="3000"
                  max="30000"
                  step="1000"
                  value={settings.undoTimeoutMs}
                  onChange={(e) => updateSetting("undoTimeoutMs", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>3秒</span>
                  <span>30秒</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 視覚的フィードバック設定 */}
        <div className="border-b border-gray-200 pb-6">
          <h4 className="font-semibold text-gray-800 mb-3">視覚的フィードバック</h4>
          
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="enableSuccessAnimation"
              checked={settings.enableSuccessAnimation}
              onChange={(e) => updateSetting("enableSuccessAnimation", e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <label htmlFor="enableSuccessAnimation" className="text-sm font-medium text-gray-700">
                打刻成功時にボタンアニメーションを表示
              </label>
              <p className="text-xs text-gray-500 mt-1">
                打刻成功時にボタンが光るアニメーションを表示します
              </p>
            </div>
          </div>
        </div>

        {/* 音声フィードバック設定 */}
        <div className="pb-6">
          <h4 className="font-semibold text-gray-800 mb-3">音声フィードバック</h4>
          
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="enableSoundFeedback"
              checked={settings.enableSoundFeedback}
              onChange={(e) => updateSetting("enableSoundFeedback", e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <label htmlFor="enableSoundFeedback" className="text-sm font-medium text-gray-700">
                打刻成功時に音声通知を再生
              </label>
              <p className="text-xs text-gray-500 mt-1">
                打刻成功時に確認音を再生します（ブラウザの設定により動作しない場合があります）
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 推奨設定 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h5 className="text-sm font-semibold text-blue-800 mb-2">📋 推奨設定</h5>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>初心者:</strong> 確認ダイアログ ON + 取り消し機能 ON</p>
          <p><strong>上級者:</strong> 確認ダイアログ OFF + 取り消し機能 ON（5秒）</p>
          <p><strong>高速操作:</strong> 全て OFF（最短操作）</p>
        </div>
      </div>

      {/* 操作ボタン */}
      <div className="flex justify-between">
        <button
          onClick={resetToDefaults}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          デフォルトに戻す
        </button>
        
        <div className="space-x-2">
          {isDirty && (
            <span className="text-xs text-orange-600 mr-2">
              未保存の変更があります
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={loading || !isDirty}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              loading || !isDirty
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {loading ? "保存中..." : "設定を保存"}
          </button>
        </div>
      </div>

      {/* UXの説明 */}
      <div className="mt-8 bg-gray-50 border rounded-lg p-4">
        <h5 className="text-sm font-semibold text-gray-800 mb-2">💡 UX設計について</h5>
        <div className="text-xs text-gray-600 space-y-2">
          <p>
            <strong>確認ダイアログ vs Undo機能:</strong><br />
            確認ダイアログは操作前の防止、Undo機能は操作後の修正に効果的です。
            現代的なUIでは、Undo機能の方が操作効率が良いとされています。
          </p>
          <p>
            <strong>勤怠打刻の特性:</strong><br />
            勤怠打刻は日常的な反復操作のため、操作効率を重視することが重要です。
            一方で、誤操作による影響も大きいため、適切なフィードバックが必要です。
          </p>
        </div>
      </div>
    </div>
  );
}