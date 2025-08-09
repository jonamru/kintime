"use client";

import { useState, useEffect } from "react";

import PageAccessGuard from "@/components/PageAccessGuard";
import TimeBaseHeader from "@/components/TimeBaseHeader";
import { showAlert, showNotification } from '@/lib/notification';
import { getJapanNow, formatJapanDate, getJapanTodayString } from '@/lib/dateUtils';
export default function ExpensePage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    type: "TRANSPORT",
    date: getJapanTodayString(),
    departure: "",
    arrival: "",
    route: "",
    amount: "",
    description: "",
    referenceUrl: "",
    validFrom: "", // 定期券の開始日用
    validUntil: "", // 定期券の終了日用
    imageUrl: "", // 画像URL用
    tripType: "ONE_WAY", // 往復・片道
  });
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // 日付の最小値を計算（期限無視権限がない場合の制限）
  const getMinDate = () => {
    const hasIgnoreDeadlinePermission = currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline;
    
    if (hasIgnoreDeadlinePermission) {
      return undefined; // 制限なし
    }
    
    const today = getJapanNow();
    const currentDay = today.getDate();
    
    if (currentDay <= 3) {
      // 3日以内なら前月も選択可能
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return formatJapanDate(prevMonth);
    } else {
      // 3日を過ぎたら当月のみ
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return formatJapanDate(currentMonth);
    }
  };

  // 日付の最大値を計算（期限無視権限がない場合は今日まで）
  const getMaxDate = () => {
    const hasIgnoreDeadlinePermission = currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline;
    
    if (hasIgnoreDeadlinePermission) {
      return undefined; // 制限なし
    }
    
    const today = getJapanNow();
    return formatJapanDate(today); // 今日まで
  };

  // 期限制限チェック（クライアントサイド）
  const canRegisterForDate = (targetDate: string) => {
    const expenseDate = new Date(targetDate);
    const today = new Date();
    const targetYear = expenseDate.getFullYear();
    const targetMonth = expenseDate.getMonth();
    const targetDate_day = expenseDate.getDate();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();
    
    // 権限がある場合は期限無視
    const hasIgnoreDeadlinePermission = currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline;
    if (hasIgnoreDeadlinePermission) {
      return true;
    }
    
    // 未来日付は登録不可
    if (targetYear > todayYear || 
        (targetYear === todayYear && targetMonth > todayMonth) ||
        (targetYear === todayYear && targetMonth === todayMonth && targetDate_day > todayDate)) {
      return false;
    }
    
    // 当月は常に登録可能
    if (targetYear === todayYear && targetMonth === todayMonth) {
      return true;
    }
    
    // 過去月の場合、翌月3日までかチェック
    const nextMonth = new Date(targetYear, targetMonth + 1, 3);
    nextMonth.setHours(23, 59, 59, 999);
    
    return today <= nextMonth;
  };

  useEffect(() => {
    fetchExpenses();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("ユーザー情報取得エラー:", error);
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await fetch("/api/expenses");
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error("経費取得エラー:", error);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, imageUrl: data.url }));
        setUploadedFile(file);
        showAlert('画像をアップロードしました');
      } else {
        const errorData = await response.json();
        showAlert(`アップロードに失敗しました: ${errorData.error}`);
      }
    } catch (error) {
      console.error('アップロードエラー:', error);
      showAlert('アップロード中にエラーが発生しました');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // フォームデータの検証とログ
    let finalAmount = parseFloat(formData.amount);
    
    // 交通費で往復の場合は金額を2倍にする
    if (formData.type === 'TRANSPORT' && formData.tripType === 'ROUND_TRIP') {
      finalAmount = finalAmount * 2;
    }
    
    const submitData = {
      ...formData,
      amount: finalAmount,
    };
    
    console.log("送信するデータ:", submitData);
    
    // 基本的な検証
    if (!submitData.type || !submitData.date || !submitData.amount || isNaN(submitData.amount)) {
      showAlert("必須項目を正しく入力してください");
      setLoading(false);
      return;
    }
    
    if (submitData.type === 'TRANSPORT' && (!submitData.departure || !submitData.arrival)) {
      showAlert("交通費の場合、出発地と到着地は必須です");
      setLoading(false);
      return;
    }
    
    if (submitData.type === 'LODGING' && !submitData.description) {
      showAlert("宿泊費の場合、詳細は必須です");
      setLoading(false);
      return;
    }

    if (submitData.type === 'COMMUTE_PASS' && (!submitData.departure || !submitData.arrival || !submitData.validFrom || !submitData.validUntil)) {
      showAlert("定期券の場合、開始駅、終了駅、開始日、終了日は必須です");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        await fetchExpenses();
        resetForm();
        showAlert("交通費を登録しました");
      } else {
        console.error("レスポンスステータス:", response.status);
        console.error("レスポンスヘッダー:", Object.fromEntries(response.headers.entries()));
        
        let errorData;
        try {
          errorData = await response.json();
          console.error("申請エラー:", errorData);
        } catch (parseError) {
          console.error("エラーレスポンスのパースに失敗:", parseError);
          const responseText = await response.text();
          console.error("エラーレスポンステキスト:", responseText);
          showAlert("サーバーエラーが発生しました。コンソールを確認してください。");
          return;
        }
        
        const errorMessage = errorData.error || "経費申請に失敗しました";
        const details = errorData.details ? `\n詳細: ${errorData.details}` : "";
        showAlert(errorMessage + details);
      }
    } catch (error) {
      console.error("通信エラー:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showAlert("エラーが発生しました: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const parseTransitInfo = async () => {
    if (!formData.description) {
      showAlert("経路詳細にYahoo!乗換案内のテキストを入力してください");
      return;
    }

    setParsing(true);
    try {
      const response = await fetch("/api/transit/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: formData.description,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const hasData = data.departure || data.arrival || data.route || data.amount;
        
        if (hasData) {
          setFormData(prev => ({
            ...prev,
            departure: data.departure || prev.departure,
            arrival: data.arrival || prev.arrival,
            route: data.route || prev.route,
            amount: data.amount ? data.amount.toString() : prev.amount,
            date: data.date || prev.date,
            referenceUrl: data.referenceUrl || prev.referenceUrl,
          }));
          
          let successMessage = "テキストを解析しました！自動入力された内容をご確認ください。\n\n";
          if (data.departure && data.arrival) successMessage += `経路: ${data.departure} → ${data.arrival}\n`;
          if (data.route) successMessage += `路線: ${data.route}\n`;
          if (data.amount) successMessage += `運賃: ${data.amount}円\n`;
          if (data.date) successMessage += `日付: ${data.date}\n`;
          if (data.duration) successMessage += `所要時間: ${data.duration}\n`;
          if (data.transfers !== undefined) successMessage += `乗換: ${data.transfers}回\n`;
          if (data.referenceUrl) successMessage += `参照URL: 自動設定済み`;
          
          showNotification(successMessage, 'success');
        } else {
          showAlert("解析できませんでした。テキストの形式を確認してください。");
        }
      } else {
        showAlert("解析に失敗しました");
      }
    } catch (error) {
      console.error("経路解析エラー:", error);
      showAlert("解析中にエラーが発生しました");
    } finally {
      setParsing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: "TRANSPORT",
      date: new Date().toISOString().split('T')[0],
      departure: "",
      arrival: "",
      route: "",
      amount: "",
      description: "",
      referenceUrl: "",
      validFrom: "",
      validUntil: "",
      imageUrl: "",
      tripType: "ONE_WAY",
    });
    setUploadedFile(null);
  };


  return (
    <PageAccessGuard page="expense">
      <TimeBaseHeader />
      <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">交通費登録</h1>
            <p className="mt-2 text-sm text-gray-600">交通費・宿泊費の登録を行えます</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 申請フォーム */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">新規登録</h2>
            </div>
            <div className="p-6">
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">💡 使い方のヒント</h3>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>• <strong>交通費:</strong> Yahoo!乗換案内のテキストを「経路詳細」に貼り付けて「テキスト解析」ボタンを押すと自動入力されます</p>
                  <p>• <strong>宿泊費:</strong> 領収書を参考に金額と詳細を入力してください</p>
                  <p>• 登録後すぐに反映されます</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    種別
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData({
                        type: newType,
                        date: new Date().toISOString().split('T')[0],
                        departure: "",
                        arrival: "",
                        route: "",
                        amount: "",
                        description: "",
                        referenceUrl: "",
                        validFrom: "",
                        validUntil: "",
                        imageUrl: "",
                        tripType: "ONE_WAY",
                      });
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="TRANSPORT">交通費</option>
                    <option value="LODGING">宿泊費</option>
                    <option value="COMMUTE_PASS">定期券</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    min={getMinDate()}
                    max={getMaxDate()}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      !canRegisterForDate(formData.date) && !currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline
                        ? 'border-red-300 bg-red-50'
                        : !canRegisterForDate(formData.date) && currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-300'
                    }`}
                    required
                  />
                  {!canRegisterForDate(formData.date) && !currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline && (
                    <p className="mt-1 text-sm text-red-600">
                      ⚠️ この日付は登録期限を過ぎています（翌月3日まで）
                    </p>
                  )}
                  {!canRegisterForDate(formData.date) && currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline && (
                    <p className="mt-1 text-sm text-orange-600">
                      ⚠️ この日付は登録期限を過ぎていますが、管理者権限により登録可能です
                    </p>
                  )}
                </div>

                {formData.type === 'TRANSPORT' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        往復・片道 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="ONE_WAY"
                            checked={formData.tripType === "ONE_WAY"}
                            onChange={(e) => setFormData(prev => ({ ...prev, tripType: e.target.value }))}
                            className="mr-2"
                          />
                          片道
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="ROUND_TRIP"
                            checked={formData.tripType === "ROUND_TRIP"}
                            onChange={(e) => setFormData(prev => ({ ...prev, tripType: e.target.value }))}
                            className="mr-2"
                          />
                          往復
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        経路詳細
                        <span className="text-xs text-gray-500 ml-2">
                          (Yahoo!乗換案内のテキストを貼り付け)
                        </span>
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="例: 新宿駅 ⇒ 東京駅 JR山手線 160円"
                        maxLength={5000}
                      />
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">
                          {formData.description.length}/5000文字
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={parseTransitInfo}
                        disabled={parsing || !formData.description}
                        className="mt-2 w-full bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {parsing ? "解析中..." : "🔍 テキスト解析"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          出発地 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.departure}
                          onChange={(e) => setFormData(prev => ({ ...prev, departure: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="例: 新宿"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          到着地 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.arrival}
                          onChange={(e) => setFormData(prev => ({ ...prev, arrival: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="例: 東京"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        経路
                      </label>
                      <input
                        type="text"
                        value={formData.route}
                        onChange={(e) => setFormData(prev => ({ ...prev, route: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="例: JR山手線"
                      />
                    </div>
                  </>
                )}

                {formData.type === 'LODGING' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      詳細 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="例: ビジネスホテル宿泊 (○○ホテル)"
                      maxLength={1000}
                      required
                    />
                  </div>
                )}

                {formData.type === 'COMMUTE_PASS' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          開始駅 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.departure}
                          onChange={(e) => setFormData(prev => ({ ...prev, departure: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="例: 新宿"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          終了駅 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.arrival}
                          onChange={(e) => setFormData(prev => ({ ...prev, arrival: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="例: 東京"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          開始日 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.validFrom}
                          min={getMinDate()}
                          max={getMaxDate()}
                          onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          終了日 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.validUntil}
                          min={getMinDate()}
                          onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        購入証明画像
                      </label>
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={uploading}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                        {uploading && (
                          <div className="flex items-center text-sm text-gray-500">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                            アップロード中...
                          </div>
                        )}
                        {uploadedFile && (
                          <div className="flex items-center text-sm text-green-600">
                            <span className="mr-2">✓</span>
                            {uploadedFile.name} がアップロードされました
                          </div>
                        )}
                        {formData.imageUrl && (
                          <div className="mt-2">
                            <img
                              src={formData.imageUrl}
                              alt="購入証明"
                              className="max-w-xs h-32 object-cover border border-gray-300 rounded-md"
                            />
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          JPEG、PNG、GIF、WebP形式、5MB以下のファイルをアップロードしてください
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    金額 (円) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    min="0"
                    step="1"
                    placeholder="0"
                    required
                  />
                  {formData.type === 'TRANSPORT' && formData.tripType === 'ROUND_TRIP' && formData.amount && (
                    <p className="mt-1 text-sm text-blue-600">
                      💡 往復のため、登録時は金額が2倍（¥{(parseFloat(formData.amount) * 2).toLocaleString()}）になります
                    </p>
                  )}
                </div>

                {formData.type === 'TRANSPORT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      参照URL <span className="text-xs text-gray-500">(解析で自動設定)</span>
                    </label>
                    <input
                      type="url"
                      value={formData.referenceUrl}
                      readOnly
                      className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Yahoo!乗換案内の解析で自動設定されます"
                    />
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    リセット
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {loading ? "登録中..." : "📝 登録する"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* 登録履歴 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">最近の登録</h2>
                <a 
                  href="/expense/monthly"
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  📅 月次一覧を見る
                </a>
              </div>
            </div>
            <div className="p-6">

              {expenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">まだ登録がありません</p>
                  <p className="text-xs mt-1">左側のフォームから登録してください</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(expense.date).toLocaleDateString('ja-JP')}
                          </span>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            expense.type === 'TRANSPORT' ? 'bg-blue-100 text-blue-800' :
                            expense.type === 'LODGING' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {expense.type === 'TRANSPORT' ? '交通費' : 
                             expense.type === 'LODGING' ? '宿泊費' : '定期券'}
                          </span>
                        </div>
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          登録済み
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-900">
                        {expense.type === 'TRANSPORT' ? (
                          <div>
                            <div className="font-medium">
                              {expense.departure} → {expense.arrival}
                              {expense.tripType === 'ROUND_TRIP' && <span className="text-xs text-green-600 ml-2">(往復)</span>}
                            </div>
                            {expense.route && (
                              <div className="text-xs text-gray-500 mt-1">
                                {expense.route}
                              </div>
                            )}
                          </div>
                        ) : expense.type === 'COMMUTE_PASS' ? (
                          <div>
                            <div className="font-medium">
                              {expense.departure} → {expense.arrival}
                            </div>
                            {(expense.validFrom || expense.validUntil) && (
                              <div className="text-xs text-gray-500 mt-1">
                                {expense.validFrom && expense.validUntil 
                                  ? `有効期間: ${new Date(expense.validFrom).toLocaleDateString('ja-JP')} ～ ${new Date(expense.validUntil).toLocaleDateString('ja-JP')}`
                                  : expense.validUntil 
                                    ? `有効期限: ${new Date(expense.validUntil).toLocaleDateString('ja-JP')}`
                                    : `開始日: ${new Date(expense.validFrom).toLocaleDateString('ja-JP')}`
                                }
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="font-medium">{expense.description}</div>
                        )}
                      </div>
                      
                      <div className="mt-2 text-right">
                        <span className="text-lg font-bold text-gray-900">¥{expense.amount.toLocaleString()}</span>
                      </div>
                      
                      {expense.type === 'TRANSPORT' && expense.referenceUrl && (
                        <div className="mt-2">
                          <a 
                            href={expense.referenceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            🔗 参照URL
                          </a>
                        </div>
                      )}
                      {expense.type === 'COMMUTE_PASS' && expense.imageUrl && (
                        <div className="mt-2">
                          <a 
                            href={expense.imageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            📷 購入証明画像
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>

    </PageAccessGuard>
  );
}