"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ExpensePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [commutePasses, setCommutePasses] = useState<any[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCommutePassForm, setShowCommutePassForm] = useState(false);
  const [showTransportParser, setShowTransportParser] = useState(false);
  const [newExpense, setNewExpense] = useState({
    type: "TRANSPORT" as "TRANSPORT" | "LODGING",
    amount: "",
    description: "",
    departure: "",
    arrival: "",
    route: "",
    referenceUrl: "",
    date: new Date().toISOString().split('T')[0],
  });
  const [newCommutePass, setNewCommutePass] = useState({
    startStation: "",
    endStation: "",
    validFrom: "",
    validUntil: "",
    image: null as File | null,
  });
  const [transitText, setTransitText] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchExpenses();
      fetchCommutePasses();
    }
  }, [status]);

  const fetchExpenses = async () => {
    try {
      const response = await fetch("/api/expense");
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error("経費取得エラー:", error);
    }
  };

  const fetchCommutePasses = async () => {
    try {
      const response = await fetch("/api/expense/commute-pass");
      if (response.ok) {
        const data = await response.json();
        setCommutePasses(data);
      }
    } catch (error) {
      console.error("定期券取得エラー:", error);
    }
  };

  const parseTransitInfo = () => {
    try {
      // Yahoo!乗換案内のテキストから情報を抽出
      const lines = transitText.split('\n');
      
      // 出発地・到着地を抽出 (例: 寝屋川公園 ⇒ 松井山手)
      const routeLine = lines.find(line => line.includes('⇒'));
      if (routeLine) {
        const [departure, arrival] = routeLine.split('⇒').map(s => s.trim());
        setNewExpense(prev => ({ ...prev, departure, arrival }));
      }

      // 日付を抽出 (例: 2025年7月24日(木))
      const dateLine = lines.find(line => line.match(/\d{4}年\d{1,2}月\d{1,2}日/));
      if (dateLine) {
        const dateMatch = dateLine.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (dateMatch) {
          const [_, year, month, day] = dateMatch;
          const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          setNewExpense(prev => ({ ...prev, date: formattedDate }));
        }
      }

      // 運賃を抽出 (例: 運賃[IC優先] 240円)
      const fareLine = lines.find(line => line.includes('円') && (line.includes('運賃') || line.includes('料金')));
      if (fareLine) {
        const fareMatch = fareLine.match(/(\d+)円/);
        if (fareMatch) {
          setNewExpense(prev => ({ ...prev, amount: fareMatch[1] }));
        }
      }

      // 経路情報を抽出
      const routeInfo = lines.filter(line => 
        line.includes('線') || line.includes('行') || line.includes('発')
      ).join(' → ');
      if (routeInfo) {
        setNewExpense(prev => ({ ...prev, route: routeInfo }));
      }

      // URLを抽出
      const urlLine = lines.find(line => line.includes('https://'));
      if (urlLine) {
        setNewExpense(prev => ({ ...prev, referenceUrl: urlLine.trim() }));
      }

      setShowTransportParser(false);
      setShowExpenseForm(true);
      alert("交通費情報を抽出しました");
    } catch (error) {
      alert("テキストの解析に失敗しました");
    }
  };

  const submitExpense = async () => {
    try {
      const response = await fetch("/api/expense", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount),
        }),
      });

      if (response.ok) {
        alert("経費を申請しました");
        setShowExpenseForm(false);
        setNewExpense({
          type: "TRANSPORT",
          amount: "",
          description: "",
          departure: "",
          arrival: "",
          route: "",
          referenceUrl: "",
          date: new Date().toISOString().split('T')[0],
        });
        fetchExpenses();
      } else {
        alert("経費の申請に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    }
  };

  const submitCommutePass = async () => {
    try {
      const formData = new FormData();
      formData.append("startStation", newCommutePass.startStation);
      formData.append("endStation", newCommutePass.endStation);
      formData.append("validFrom", newCommutePass.validFrom);
      formData.append("validUntil", newCommutePass.validUntil);
      if (newCommutePass.image) {
        formData.append("image", newCommutePass.image);
      }

      const response = await fetch("/api/expense/commute-pass", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        alert("定期券を登録しました");
        setShowCommutePassForm(false);
        setNewCommutePass({
          startStation: "",
          endStation: "",
          validFrom: "",
          validUntil: "",
          image: null,
        });
        fetchCommutePasses();
      } else {
        alert("定期券の登録に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    const labels = {
      PENDING: "承認待ち",
      APPROVED: "承認済み",
      REJECTED: "却下",
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">交通費・経費管理</h1>
              <div className="space-x-2">
                <button
                  onClick={() => setShowTransportParser(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  交通費自動入力
                </button>
                <button
                  onClick={() => setShowExpenseForm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  経費申請
                </button>
                <button
                  onClick={() => setShowCommutePassForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  定期券登録
                </button>
              </div>
            </div>

            {/* 定期券一覧 */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">登録済み定期券</h2>
              {commutePasses.length === 0 ? (
                <p className="text-gray-500">定期券が登録されていません</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {commutePasses.map((pass) => (
                    <div key={pass.id} className="border rounded-lg p-4">
                      <div className="font-medium">{pass.startStation} ⇒ {pass.endStation}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(pass.validFrom).toLocaleDateString()} - {new Date(pass.validUntil).toLocaleDateString()}
                      </div>
                      {pass.imageUrl && (
                        <img
                          src={pass.imageUrl}
                          alt="定期券"
                          className="mt-2 w-full h-32 object-cover rounded"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 経費申請一覧 */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">経費申請履歴</h2>
              {expenses.length === 0 ? (
                <p className="text-gray-500">経費申請がありません</p>
              ) : (
                <div className="space-y-4">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {expense.type === "TRANSPORT" ? "交通費" : "宿泊費"}
                            </span>
                            {getStatusBadge(expense.status)}
                          </div>
                          <div className="text-lg font-bold text-blue-600">
                            ¥{expense.amount.toLocaleString()}
                          </div>
                          {expense.departure && expense.arrival && (
                            <div className="text-sm text-gray-600">
                              {expense.departure} → {expense.arrival}
                            </div>
                          )}
                          {expense.route && (
                            <div className="text-xs text-gray-500">
                              経路: {expense.route}
                            </div>
                          )}
                          {expense.description && (
                            <div className="text-sm text-gray-700 mt-1">
                              {expense.description}
                            </div>
                          )}
                          {expense.comment && (
                            <div className="text-sm text-red-600 mt-1">
                              コメント: {expense.comment}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(expense.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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

      {/* 交通費自動入力モーダル */}
      {showTransportParser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-medium mb-4">交通費自動入力</h3>
            <p className="text-sm text-gray-600 mb-4">
              Yahoo!乗換案内の検索結果をコピー&ペーストしてください
            </p>
            <textarea
              value={transitText}
              onChange={(e) => setTransitText(e.target.value)}
              className="w-full h-64 border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="乗換案内の結果をここに貼り付けてください..."
            />
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowTransportParser(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={parseTransitInfo}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                情報を抽出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 経費申請モーダル */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">経費申請</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">種別</label>
                <select
                  value={newExpense.type}
                  onChange={(e) => setNewExpense({...newExpense, type: e.target.value as "TRANSPORT" | "LODGING"})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="TRANSPORT">交通費</option>
                  <option value="LODGING">宿泊費</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">日付</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">金額</label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="金額を入力"
                />
              </div>

              {newExpense.type === "TRANSPORT" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">出発地</label>
                      <input
                        type="text"
                        value={newExpense.departure}
                        onChange={(e) => setNewExpense({...newExpense, departure: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">到着地</label>
                      <input
                        type="text"
                        value={newExpense.arrival}
                        onChange={(e) => setNewExpense({...newExpense, arrival: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">経路</label>
                    <input
                      type="text"
                      value={newExpense.route}
                      onChange={(e) => setNewExpense({...newExpense, route: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">参照URL</label>
                    <input
                      type="url"
                      value={newExpense.referenceUrl}
                      onChange={(e) => setNewExpense({...newExpense, referenceUrl: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">備考</label>
                <textarea
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowExpenseForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={submitExpense}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                申請
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 定期券登録モーダル */}
      {showCommutePassForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">定期券登録</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">開始駅</label>
                  <input
                    type="text"
                    value={newCommutePass.startStation}
                    onChange={(e) => setNewCommutePass({...newCommutePass, startStation: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">終了駅</label>
                  <input
                    type="text"
                    value={newCommutePass.endStation}
                    onChange={(e) => setNewCommutePass({...newCommutePass, endStation: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">開始日</label>
                  <input
                    type="date"
                    value={newCommutePass.validFrom}
                    onChange={(e) => setNewCommutePass({...newCommutePass, validFrom: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">終了日</label>
                  <input
                    type="date"
                    value={newCommutePass.validUntil}
                    onChange={(e) => setNewCommutePass({...newCommutePass, validUntil: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">定期券の写真</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewCommutePass({...newCommutePass, image: e.target.files?.[0] || null})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCommutePassForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={submitCommutePass}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                登録
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}