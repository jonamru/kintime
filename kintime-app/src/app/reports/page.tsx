"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reportType, setReportType] = useState("attendance");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/${reportType}?month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        alert("レポートの生成に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!reportData) return;

    let csvContent = "";
    let headers: string[] = [];
    let rows: string[][] = [];

    switch (reportType) {
      case "attendance":
        headers = ["日付", "ユーザー", "出勤時間", "退勤時間", "勤務時間"];
        rows = reportData.map((item: any) => [
          new Date(item.date).toLocaleDateString(),
          item.user.name,
          item.clockIn ? new Date(item.clockIn).toLocaleTimeString() : "-",
          item.clockOut ? new Date(item.clockOut).toLocaleTimeString() : "-",
          item.workHours || "-",
        ]);
        break;
      case "project":
        headers = ["プロジェクト", "クライアント", "受注単価", "支払単価", "利益"];
        rows = reportData.map((item: any) => [
          item.name,
          item.client,
          item.contractPrice?.toString() || "-",
          item.paymentPrice?.toString() || "-",
          item.profit?.toString() || "-",
        ]);
        break;
      case "staff":
        headers = ["スタッフ", "勤務日数", "総勤務時間", "交通費合計"];
        rows = reportData.map((item: any) => [
          item.name,
          item.workDays?.toString() || "0",
          item.totalHours?.toString() || "0",
          item.totalTransport?.toString() || "0",
        ]);
        break;
    }

    csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${reportType}_report_${month}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">レポート</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">レポート種別</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="attendance">月次勤怠レポート</option>
                  <option value="project">案件別収支レポート</option>
                  <option value="staff">スタッフ別実績レポート</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">対象月</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={generateReport}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "生成中..." : "レポート生成"}
                </button>
              </div>
            </div>

            {reportData && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    {reportType === "attendance" && "月次勤怠レポート"}
                    {reportType === "project" && "案件別収支レポート"}
                    {reportType === "staff" && "スタッフ別実績レポート"}
                  </h2>
                  <button
                    onClick={exportCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    CSV出力
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {reportType === "attendance" && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            日付
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ユーザー
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            出勤時間
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            退勤時間
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            勤務時間
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(item.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.user.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.clockIn ? new Date(item.clockIn).toLocaleTimeString() : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.clockOut ? new Date(item.clockOut).toLocaleTimeString() : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.workHours || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportType === "project" && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            プロジェクト
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            クライアント
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            受注単価
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            支払単価
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            利益
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.client}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.contractPrice ? `¥${item.contractPrice.toLocaleString()}` : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.paymentPrice ? `¥${item.paymentPrice.toLocaleString()}` : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.profit ? `¥${item.profit.toLocaleString()}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportType === "staff" && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            スタッフ
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            勤務日数
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            総勤務時間
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            交通費合計
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.workDays || 0}日
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.totalHours || 0}時間
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ¥{(item.totalTransport || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
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
    </div>
  );
}