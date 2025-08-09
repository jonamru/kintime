'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PageAccessGuard from '@/components/PageAccessGuard'

interface ExpenseReport {
  user: {
    id: string
    name: string
    userId: string
  }
  month: string
  summary: {
    totalExpenses: number
    approvedExpenses: number
    pendingExpenses: number
    rejectedExpenses: number
  }
  expenses: Array<{
    id: string
    date: string
    dayOfWeek: string
    type: string
    route: string
    detailedRoute: string
    amount: number
    referenceUrl: string
    status: string
    description: string
  }>
}

export default function ExpensePreviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [report, setReport] = useState<ExpenseReport | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = searchParams.get('userId') || ''
  const month = searchParams.get('month') || ''
  const tab = searchParams.get('tab') || 'expense'

  useEffect(() => {
    if (userId && month) {
      fetchReport()
    }
  }, [userId, month])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/reports/expense?userId=${userId}&month=${month}`)
      if (response.ok) {
        const data = await response.json()
        setReport(data)
      } else {
        const error = await response.json()
        alert(error.error || 'レポートの取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
      alert('レポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      'APPROVED': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REJECTED': 'bg-red-100 text-red-800'
    }
    const statusText = {
      'APPROVED': '承認済',
      'PENDING': '申請中',
      'REJECTED': '却下'
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusText[status] || status}
      </span>
    )
  }

  if (loading) {
    return (
      <PageAccessGuard page="reports">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">読み込み中...</div>
        </div>
      </PageAccessGuard>
    )
  }

  if (!report) {
    return (
      <PageAccessGuard page="reports">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">レポートが見つかりませんでした</div>
        </div>
      </PageAccessGuard>
    )
  }

  return (
    <PageAccessGuard page="reports">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">経費管理表</h1>
          <button
            onClick={() => router.push(`/reports?tab=${tab}`)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            戻る
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">氏名:</p>
              <p className="font-medium">{report.user.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">ユーザーID:</p>
              <p className="font-medium">{report.user.userId || report.user.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">対象年月:</p>
              <p className="font-medium">{report.month}</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded">
            <div>
              <p className="text-sm text-gray-600">経費合計</p>
              <p className="text-lg font-bold">¥{report.summary.totalExpenses.toLocaleString()}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    日付
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                    曜日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                    種別
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    経路
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    詳細路線
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                    金額
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                    参照URL
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.expenses.map((expense, index) => (
                  <tr key={expense.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {expense.date}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                      {expense.dayOfWeek}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {expense.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={expense.route}>
                        {expense.route}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 max-w-md">
                      <div className="line-clamp-2" title={expense.detailedRoute}>
                        {expense.detailedRoute}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      ¥{expense.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {expense.referenceUrl ? (
                        <a 
                          href={expense.referenceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          リンク
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageAccessGuard>
  )
}