'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PageAccessGuard from '@/components/PageAccessGuard'

// 動的レンダリングを強制
export const dynamic = 'force-dynamic'

interface AttendanceReport {
  user: {
    id: string
    name: string
    employeeId: string
    userId?: string
  }
  month: string
  summary: {
    workDays: number
    totalHours: number
    absences: number
    lateCount: number
    totalExpenses: number
  }
  records: Array<{
    date: string
    dayOfWeek: string
    status: string
    workplace: string
    startTime: string
    endTime: string
    breakTime?: string
    actualWorkHours?: string
    wakeupReport?: string
    departureReport?: string
    clockIn?: string
    clockOut?: string
    workHours?: number
    alerts?: string[]
    expenses?: number
  }>
}

function AttendancePreviewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = searchParams.get('userId') || ''
  const month = searchParams.get('month') || ''
  const type = searchParams.get('type') || 'full'
  const tab = searchParams.get('tab') || 'attendance'

  useEffect(() => {
    if (userId && month) {
      fetchReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, month, type])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/reports/attendance?userId=${userId}&month=${month}&type=${type}`)
      if (response.ok) {
        const data = await response.json()

        // デバッグログ: 経費データがあるレコードをチェック
        console.log('Report data:', data)
        if (type === 'submission_with_expenses') {
          const records = data.records as AttendanceReport['records']
          console.log('All records with expenses field:', records?.map((r) => ({
            date: r.date,
            expenses: r.expenses,
            expenseType: typeof r.expenses
          })))
          const recordsWithExpenses = records?.filter((r) => r.expenses && r.expenses > 0) || []
          console.log('Records with expenses > 0:', recordsWithExpenses)
        }

        setReport(data)
      } else {
        const error = await response.json()
        const errorMessage = error.details ? `${error.error}: ${error.details}` : error.error || 'レポートの取得に失敗しました'
        alert(errorMessage)
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
      alert('レポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const getReportTitle = () => {
    switch (type) {
      case 'submission':
        return '勤務管理表（提出用）'
      case 'submission_with_expenses':
        return '勤務管理表（提出用・交通費含む）'
      default:
        return '勤務管理表（全情報表示版）'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">読み込み中...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">レポートが見つかりませんでした</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{getReportTitle()}</h1>
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
            <p className="text-sm text-gray-600">社員番号:</p>
            <p className="font-medium">{report.user.employeeId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">対象年月:</p>
            <p className="font-medium">{report.month}</p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">勤務日数</p>
              <p className="text-lg font-bold">{report.summary.workDays}日</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">総勤務時間</p>
              <p className="text-lg font-bold">{report.summary.totalHours}時間</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">欠勤日数</p>
              <p className="text-lg font-bold">{report.summary.absences}日</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">遅刻回数</p>
              <p className="text-lg font-bold">{report.summary.lateCount}回</p>
            </div>
          </div>
          {type === 'submission_with_expenses' && (
            <div className="mt-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">経費合計</p>
                <p className="text-lg font-bold">¥{report.summary.totalExpenses.toLocaleString()}</p>
              </div>
            </div>
          )}
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
                  状態
                </th>
                {type === 'full' && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      勤務地
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                      起床
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                      出発
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                  出勤
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                  退勤
                </th>
                {(type === 'full' || type === 'submission') && (
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                    休憩
                  </th>
                )}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                  実働時間
                </th>
                {type === 'submission_with_expenses' && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                    経費
                  </th>
                )}
                {type === 'full' && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    備考
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.records.map((record, index) => (
                <tr key={index} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.date}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm text-center ${record.dayOfWeek === '土' ? 'text-blue-600 font-semibold' :
                      record.dayOfWeek === '日' ? 'text-red-600 font-semibold' :
                        'text-gray-600'
                    }`}>
                    {record.dayOfWeek}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${record.status === '出勤' ? 'bg-green-100 text-green-800' :
                        record.status === '休日' ? 'bg-gray-100 text-gray-800' :
                          record.status === '欠勤' ? 'bg-red-100 text-red-800' :
                            record.status === '有給' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                      }`}>
                      {record.status}
                    </span>
                  </td>
                  {type === 'full' && (
                    <>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.workplace || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                        {record.wakeupReport || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                        {record.departureReport || '-'}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-medium text-gray-900">
                    {record.clockIn || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-medium text-gray-900">
                    {record.clockOut || '-'}
                  </td>
                  {(type === 'full' || type === 'submission') && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                      {record.breakTime || '-'}
                    </td>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {record.actualWorkHours || '-'}
                  </td>
                  {type === 'submission_with_expenses' && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'}
                    </td>
                  )}
                  {type === 'full' && (
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {record.alerts && Array.isArray(record.alerts) && record.alerts.length > 0 ? (
                        <div className="space-y-1">
                          {record.alerts.map((alert, i) => (
                            <div key={i} className="text-xs text-red-600">
                              {alert}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function AttendancePreviewPage() {
  return (
    <PageAccessGuard page="reports">
      <Suspense fallback={
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">読み込み中...</div>
        </div>
      }>
        <AttendancePreviewContent />
      </Suspense>
    </PageAccessGuard>
  )
}