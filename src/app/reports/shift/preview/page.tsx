'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PageAccessGuard from '@/components/PageAccessGuard'

interface ShiftReport {
  month: string
  scope: string
  dates: Array<{
    date: string
    day: number
    dayOfWeek: string
  }>
  data: Array<{
    user: {
      id: string
      name: string
      userId: string
      company: string
      workLocation: string
    }
    shifts: Array<{
      date: string
      day: number
      dayOfWeek: string
      shift: {
        startTime: string
        endTime: string
        location: string
        shiftType: string
      } | null
    }>
  }>
}

export default function ShiftPreviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [loading, setLoading] = useState(true)

  const month = searchParams.get('month') || ''
  const scope = searchParams.get('scope') || 'user'
  const userId = searchParams.get('userId') || ''
  const partnerId = searchParams.get('partnerId') || ''
  const showLocation = searchParams.get('showLocation') === 'true'
  const tab = searchParams.get('tab') || 'shift'
  
  // userIdsを安定した参照として記録
  const userIds = useMemo(() => searchParams.getAll('userIds'), [searchParams])

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ month, scope })
      
      console.log('Fetching report with:', { month, scope, userId, userIds, partnerId })
      
      if (scope === 'user') {
        if (userIds.length > 0) {
          userIds.forEach(id => params.append('userIds', id))
        } else if (userId) {
          params.append('userId', userId)
        }
      } else if (scope === 'company' && partnerId) {
        params.append('partnerId', partnerId)
      }
      
      if (showLocation) {
        params.append('showLocation', 'true')
      }
      
      const url = `/api/reports/shift?${params}`
      console.log('Fetching URL:', url)
      
      const response = await fetch(url)
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Report data:', data)
        setReport(data)
      } else {
        const error = await response.json()
        console.error('API Error:', error)
        alert(error.error || 'レポートの取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
      alert('レポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [month, scope, userId, userIds, partnerId, showLocation])

  useEffect(() => {
    if (month) {
      fetchReport()
    }
  }, [fetchReport])

  const getScopeText = (scope: string, reportData?: ShiftReport) => {
    switch (scope) {
      case 'user': return '選択ユーザー'
      case 'company': {
        // 会社名を取得（最初のユーザーの会社名を使用）
        if (reportData && reportData.data && reportData.data.length > 0) {
          const companyName = reportData.data[0].user.company
          return companyName
        }
        return '自社'
      }
      case 'all': return '全員'
      default: return scope
    }
  }

  const isWeekend = (dayOfWeek: string) => {
    return dayOfWeek === '土' || dayOfWeek === '日'
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
          <h1 className="text-2xl font-bold">シフト表</h1>
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
              <p className="text-sm text-gray-600">対象年月:</p>
              <p className="font-medium">{report.month}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">対象範囲:</p>
              <p className="font-medium">{getScopeText(report.scope, report)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                    氏名
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-16 bg-gray-50 z-10">
                    稼働先
                  </th>
                  {report.dates.map((dateInfo) => (
                    <th 
                      key={dateInfo.date} 
                      className={`px-1 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[60px] ${
                        isWeekend(dateInfo.dayOfWeek) 
                          ? 'bg-red-100 text-red-700 border-red-200' 
                          : 'text-gray-600 bg-gray-50'
                      }`}
                    >
                      <div>{dateInfo.day}日</div>
                      <div>({dateInfo.dayOfWeek})</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.data.map((userData, userIndex) => (
                  <tr key={userData.user.id} className={`hover:bg-gray-50 transition-colors ${userIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-inherit z-10">
                      <div>{userData.user.name}</div>
                      <div className="text-xs text-gray-500">({userData.user.userId})</div>
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-600 sticky left-16 bg-inherit z-10">
                      {userData.user.workLocation}
                    </td>
                    {userData.shifts.map((dayShift) => (
                      <td 
                        key={dayShift.date} 
                        className={`px-1 py-4 text-center text-xs min-w-[60px] ${
                          isWeekend(dayShift.dayOfWeek) 
                            ? 'bg-red-50 border-red-100' 
                            : ''
                        }`}
                      >
                        {dayShift.shift ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-blue-600">
                              {dayShift.shift.startTime}
                            </div>
                            {showLocation && (
                              <div className="text-gray-500 text-xs">
                                {dayShift.shift.location}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">公休</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-sm text-gray-600">
            <p>※ 承認済みのシフトのみ表示されています</p>
            <p>※ 時間は開始時間を表示しています</p>
          </div>
        </div>
      </div>
    </PageAccessGuard>
  )
}