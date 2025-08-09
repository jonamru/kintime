'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PageAccessGuard from '@/components/PageAccessGuard'

interface AttendanceReport {
  user: {
    id: string
    name: string
    employeeId: string
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

export default function AttendancePreviewPage() {
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
          console.log('All records with expenses field:', data.records?.map((r: any) => ({
            date: r.date,
            expenses: r.expenses,
            expenseType: typeof r.expenses
          })))
          const recordsWithExpenses = data.records?.filter((r: any) => r.expenses > 0) || []
          console.log('Records with expenses > 0:', recordsWithExpenses)
        }
        
        setReport(data)
      } else {
        const error = await response.json()
        const errorMessage = error.details ? `${error.error}: ${error.details}` : error.error || 'レポートの取得に失敗しました'
        alert(errorMessage)
        console.error('Report fetch error:', error)
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
      alert('レポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold">
            勤務管理表{type === 'full' ? '（全情報表示版）' : type === 'submission_with_expenses' ? '（提出用・交通費含む）' : '（提出用）'}
          </h1>
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

          <div className={`mb-6 grid gap-4 p-4 bg-gray-50 rounded ${
            type === 'submission' ? 'grid-cols-2 md:grid-cols-3' : type === 'submission_with_expenses' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'
          }`}>
            <div>
              <p className="text-sm text-gray-600">稼働日数</p>
              <p className="text-lg font-bold">{report.summary.workDays}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">実働時間</p>
              <p className="text-lg font-bold">{report.summary.totalHours}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">欠勤</p>
              <p className="text-lg font-bold">{report.summary.absences}</p>
            </div>
            {(type === 'full' || type === 'submission_with_expenses') && (
              <>
                {type === 'full' && (
                  <div>
                    <p className="text-sm text-gray-600">遅刻</p>
                    <p className="text-lg font-bold">{report.summary.lateCount}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">{type === 'submission_with_expenses' ? '交通費' : '経費'}</p>
                  <p className="text-lg font-bold">¥{report.summary.totalExpenses.toLocaleString()}</p>
                </div>
              </>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1 text-sm">日付</th>
                  <th className="border px-2 py-1 text-sm">曜日</th>
                  <th className="border px-2 py-1 text-sm">勤怠</th>
                  <th className="border px-2 py-1 text-sm">勤務地</th>
                  <th className="border px-2 py-1 text-sm">開始時間</th>
                  <th className="border px-2 py-1 text-sm">終了時間</th>
                  {(type === 'submission' || type === 'submission_with_expenses') && (
                    <>
                      <th className="border px-2 py-1 text-sm">休憩時間</th>
                      <th className="border px-2 py-1 text-sm">実働時間</th>
                    </>
                  )}
                  {type === 'submission_with_expenses' && (
                    <th className="border px-2 py-1 text-sm">交通費</th>
                  )}
                  {type === 'full' && (
                    <>
                      <th className="border px-2 py-1 text-sm">起床報告</th>
                      <th className="border px-2 py-1 text-sm">出発報告</th>
                      <th className="border px-2 py-1 text-sm">出勤</th>
                      <th className="border px-2 py-1 text-sm">退勤</th>
                      <th className="border px-2 py-1 text-sm">勤務時間</th>
                      <th className="border px-2 py-1 text-sm">アラート</th>
                      <th className="border px-2 py-1 text-sm">経費合計</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {report.records.map((record, index) => (
                  <tr key={index} className={record.status === '欠勤' ? 'bg-yellow-50' : ''}>
                    <td className="border px-2 py-1 text-sm">{record.date}</td>
                    <td className="border px-2 py-1 text-sm text-center">{record.dayOfWeek}</td>
                    <td className="border px-2 py-1 text-sm">{record.status}</td>
                    <td className="border px-2 py-1 text-sm">{record.workplace}</td>
                    <td className="border px-2 py-1 text-sm text-center">{record.startTime}</td>
                    <td className="border px-2 py-1 text-sm text-center">{record.endTime}</td>
                    {(type === 'submission' || type === 'submission_with_expenses') && (
                      <>
                        <td className="border px-2 py-1 text-sm text-center">{record.breakTime || '-'}</td>
                        <td className="border px-2 py-1 text-sm text-center">{record.actualWorkHours || '-'}</td>
                      </>
                    )}
                    {type === 'submission_with_expenses' && (
                      <td className="border px-2 py-1 text-sm text-right">
                        {record.expenses && record.expenses > 0 ? `¥${record.expenses.toLocaleString()}` : '-'}
                      </td>
                    )}
                    {type === 'full' && (
                      <>
                        <td className="border px-2 py-1 text-sm text-center">{record.wakeupReport || '-'}</td>
                        <td className="border px-2 py-1 text-sm text-center">{record.departureReport || '-'}</td>
                        <td className="border px-2 py-1 text-sm text-center">{record.clockIn || '-'}</td>
                        <td className="border px-2 py-1 text-sm text-center">{record.clockOut || '-'}</td>
                        <td className="border px-2 py-1 text-sm text-center">
                          {record.workHours || '-'}
                        </td>
                        <td className="border px-2 py-1 text-sm text-center">
                          {record.alerts?.join(', ') || '-'}
                        </td>
                        <td className="border px-2 py-1 text-sm text-right">
                          {record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'}
                        </td>
                      </>
                    )}
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