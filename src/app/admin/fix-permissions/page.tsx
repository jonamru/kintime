"use client";

import { useState } from "react";
import { showAlert } from '@/lib/notification';

export default function FixPermissionsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFixPermissions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/add-bulk-edit-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      setResult(data);
      
      if (response.ok) {
        showAlert('権限フィールド追加完了！');
      } else {
        showAlert('エラー: ' + data.error);
      }
    } catch (error) {
      showAlert('API実行エラー');
      setResult({ error: 'API実行エラー' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">権限修正ツール</h1>
        
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            一括修正管理の権限をロールに追加します。
          </p>
          
          <button
            onClick={handleFixPermissions}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "処理中..." : "権限を追加"}
          </button>
          
          {result && (
            <div className="mt-4 p-3 bg-gray-50 rounded border">
              <h3 className="font-medium text-sm mb-2">実行結果:</h3>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <a
            href="/admin/system"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← システム設定に戻る
          </a>
        </div>
      </div>
    </div>
  );
}