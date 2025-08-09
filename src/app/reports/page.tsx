'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageAccessGuard from '@/components/PageAccessGuard'
import TimeBaseHeader from '@/components/TimeBaseHeader'

export default function ReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'attendance' | 'expense' | 'shift'>('attendance')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [users, setUsers] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [reportType, setReportType] = useState<'full' | 'submission' | 'submission_with_expenses'>('full')
  const [pdfOrientation, setPdfOrientation] = useState<'landscape' | 'portrait'>('portrait')
  const [shiftScope, setShiftScope] = useState<'user' | 'company' | 'all'>('user')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showShiftLocation, setShowShiftLocation] = useState<boolean>(false)
  const [userSearchQuery, setUserSearchQuery] = useState<string>('')
  const [attendanceUserSearchQuery, setAttendanceUserSearchQuery] = useState<string>('')
  const [expenseUserSearchQuery, setExpenseUserSearchQuery] = useState<string>('')
  const [attendanceScope, setAttendanceScope] = useState<'user' | 'company' | 'all'>('user')
  const [expenseScope, setExpenseScope] = useState<'user' | 'company' | 'all'>('user')
  const [selectedAttendanceUserIds, setSelectedAttendanceUserIds] = useState<string[]>([])
  const [selectedExpenseUserIds, setSelectedExpenseUserIds] = useState<string[]>([])
  const [selectedAttendancePartnerId, setSelectedAttendancePartnerId] = useState<string>('')
  const [selectedExpensePartnerId, setSelectedExpensePartnerId] = useState<string>('')

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${year}-${month}`)
    
    // URLパラメータからタブ情報を読み取る
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && ['attendance', 'expense', 'shift'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl as 'attendance' | 'expense' | 'shift')
    }
    
    fetchCurrentUser()
    fetchUsers()
    fetchPartners()
  }, [searchParams]) // searchParamsを依存配列に追加

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data)
        if (data?.id) {
          setSelectedUserId(data.id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        const userList = data.users || []
        setUsers(userList)
        
        // selectedUserIdが未設定の場合、最初のユーザーを選択
        if (!selectedUserId && userList.length > 0) {
          setSelectedUserId(userList[0].id)
        }
      } else {
        setUsers([])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      setUsers([])
    }
  }

  const fetchPartners = async () => {
    try {
      const response = await fetch('/api/admin/partners/all')
      if (response.ok) {
        const data = await response.json()
        setPartners(data || [])
      } else {
        setPartners([])
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error)
      setPartners([])
    }
  }

  // フィルタリング機能（useMemoで最適化）
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const searchLower = userSearchQuery.toLowerCase()
      return user.name.toLowerCase().includes(searchLower) ||
             (user.userId && user.userId.toLowerCase().includes(searchLower)) ||
             (user.partner && user.partner.name && user.partner.name.toLowerCase().includes(searchLower))
    })
  }, [users, userSearchQuery])

  // 勤務管理表用フィルタリング
  const filteredAttendanceUsers = useMemo(() => {
    return users.filter(user => {
      const searchLower = attendanceUserSearchQuery.toLowerCase()
      return user.name.toLowerCase().includes(searchLower) ||
             (user.userId && user.userId.toLowerCase().includes(searchLower)) ||
             (user.partner && user.partner.name && user.partner.name.toLowerCase().includes(searchLower))
    })
  }, [users, attendanceUserSearchQuery])

  // 経費管理表用フィルタリング
  const filteredExpenseUsers = useMemo(() => {
    return users.filter(user => {
      const searchLower = expenseUserSearchQuery.toLowerCase()
      return user.name.toLowerCase().includes(searchLower) ||
             (user.userId && user.userId.toLowerCase().includes(searchLower)) ||
             (user.partner && user.partner.name && user.partner.name.toLowerCase().includes(searchLower))
    })
  }, [users, expenseUserSearchQuery])

  // エクスポート処理
  const handleExport = useCallback(async (format: 'excel' | 'csv' | 'pdf') => {
    try {
      let endpoint = ''
      if (activeTab === 'attendance') {
        const params = new URLSearchParams()
        params.append('month', selectedMonth)
        params.append('scope', attendanceScope)
        params.append('type', reportType)
        params.append('format', format)
        
        if (attendanceScope === 'user') {
          selectedAttendanceUserIds.forEach(id => params.append('userIds', id))
        } else if (attendanceScope === 'company' && selectedAttendancePartnerId) {
          params.append('partnerId', selectedAttendancePartnerId)
        }
        
        if (format === 'pdf') {
          params.append('orientation', pdfOrientation)
        }
        
        endpoint = `/api/reports/attendance?${params.toString()}`
      } else if (activeTab === 'expense') {
        const params = new URLSearchParams()
        params.append('month', selectedMonth)
        params.append('scope', expenseScope)
        params.append('format', format)
        
        if (expenseScope === 'user') {
          selectedExpenseUserIds.forEach(id => params.append('userIds', id))
        } else if (expenseScope === 'company' && selectedExpensePartnerId) {
          params.append('partnerId', selectedExpensePartnerId)
        }
        
        if (format === 'pdf') {
          params.append('orientation', pdfOrientation)
        }
        
        endpoint = `/api/reports/expense?${params.toString()}`
      } else if (activeTab === 'shift') {
        const params = new URLSearchParams()
        params.append('month', selectedMonth)
        params.append('scope', shiftScope)
        params.append('format', format)
        
        if (shiftScope === 'user') {
          selectedUserIds.forEach(id => params.append('userIds', id))
        } else if (shiftScope === 'company' && selectedPartnerId) {
          params.append('partnerId', selectedPartnerId)
        }
        
        if (format === 'pdf') {
          params.append('orientation', pdfOrientation)
        }
        
        if (showShiftLocation) {
          params.append('showLocation', 'true')
        }
        
        endpoint = `/api/reports/shift?${params.toString()}`
      }
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // ファイル名を取得
        const contentDisposition = response.headers.get('content-disposition')
        let filename = `${activeTab}_${selectedMonth}.${format}`
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
          if (filenameMatch) {
            filename = decodeURIComponent(filenameMatch[1])
          }
        }
        
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        try {
          const error = await response.json()
          console.error('Export API Error:', error)
          alert(`エクスポートに失敗しました: ${error.error || response.statusText}`)
        } catch (jsonError) {
          console.error('Export Response Error:', response.status, response.statusText)
          alert(`エクスポートに失敗しました: ${response.status} ${response.statusText}`)
        }
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert(`エクスポートに失敗しました: ${error}`)
    }
  }, [activeTab, selectedMonth, attendanceScope, expenseScope, shiftScope, reportType, pdfOrientation, 
      selectedAttendanceUserIds, selectedExpenseUserIds, selectedUserIds, selectedAttendancePartnerId, 
      selectedExpensePartnerId, selectedPartnerId, showShiftLocation])

  // プレビュー処理
  const handlePreview = useCallback(() => {
    // バリデーション
    if (activeTab === 'attendance') {
      
      if (attendanceScope === 'user') {
        if (selectedAttendanceUserIds.length === 0) {
          alert('ユーザーを選択してください')
          return
        }
        if (selectedAttendanceUserIds.length > 1) {
          alert('プレビューは1人のユーザーのみ選択してください。複数ユーザーの場合は直接ファイル出力をご利用ください。')
          return
        }
      }
      if (attendanceScope !== 'user') {
        alert('プレビューは「選択したユーザー」で1人のみ選択時のみ利用できます')
        return
      }
    } else if (activeTab === 'expense') {
      if (expenseScope === 'user') {
        if (selectedExpenseUserIds.length === 0) {
          alert('ユーザーを選択してください')
          return
        }
        if (selectedExpenseUserIds.length > 1) {
          alert('プレビューは1人のユーザーのみ選択してください。複数ユーザーの場合は直接ファイル出力をご利用ください。')
          return
        }
      }
      if (expenseScope !== 'user') {
        alert('プレビューは「選択したユーザー」で1人のみ選択時のみ利用できます')
        return
      }
    } else if (activeTab === 'shift') {
      if (shiftScope === 'user' && selectedUserIds.length === 0) {
        alert('ユーザーを選択してください')
        return
      }
      if (shiftScope === 'company' && !selectedPartnerId) {
        alert('会社を選択してください')
        return
      }
    }
    
    if (!selectedMonth) {
      alert('対象年月を選択してください')
      return
    }
    
    let params = new URLSearchParams()
    
    if (activeTab === 'attendance') {
      // 単一ユーザーのみ
      params = new URLSearchParams({
        userId: selectedAttendanceUserIds[0],
        month: selectedMonth,
        type: reportType
      })
      router.push(`/reports/attendance/preview?${params}&tab=attendance`)
    } else if (activeTab === 'expense') {
      // 単一ユーザーのみ
      params = new URLSearchParams({
        userId: selectedExpenseUserIds[0],
        month: selectedMonth
      })
      router.push(`/reports/expense/preview?${params}&tab=expense`)
    } else if (activeTab === 'shift') {
      params = new URLSearchParams({
        month: selectedMonth,
        scope: shiftScope
      })
      if (shiftScope === 'user') {
        selectedUserIds.forEach(id => params.append('userIds', id))
      } else if (shiftScope === 'company' && selectedPartnerId) {
        params.append('partnerId', selectedPartnerId)
      }
      if (showShiftLocation) {
        params.append('showLocation', 'true')
      }
      router.push(`/reports/shift/preview?${params}&tab=shift`)
    }
  }, [activeTab, selectedMonth, attendanceScope, expenseScope, shiftScope, reportType, 
      selectedAttendanceUserIds, selectedExpenseUserIds, selectedUserIds, selectedAttendancePartnerId, 
      selectedExpensePartnerId, selectedPartnerId, showShiftLocation, router])

  return (
    <PageAccessGuard page="reports">
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
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">レポート管理</h1>
        </div>

        <div className="mb-6">
          <div className="flex border-b">
            <button
              onClick={() => {
                setActiveTab('attendance')
                setAttendanceUserSearchQuery('')
              }}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'attendance'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              勤務管理表
            </button>
            <button
              onClick={() => {
                setActiveTab('expense')
                setExpenseUserSearchQuery('')
              }}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'expense'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              経費管理表
            </button>
            <button
              onClick={() => {
                setActiveTab('shift')
                setUserSearchQuery('')
              }}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'shift'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              シフト表
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              対象年月
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              対象範囲
            </label>
            {activeTab === 'attendance' ? (
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="user"
                    checked={attendanceScope === 'user'}
                    onChange={(e) => setAttendanceScope('user')}
                    className="mr-2"
                  />
                  選択したユーザー
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="company"
                    checked={attendanceScope === 'company'}
                    onChange={(e) => setAttendanceScope('company')}
                    className="mr-2"
                  />
                  所属会社
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="all"
                    checked={attendanceScope === 'all'}
                    onChange={(e) => setAttendanceScope('all')}
                    className="mr-2"
                  />
                  全員
                </label>
              </div>
            ) : activeTab === 'expense' ? (
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="user"
                    checked={expenseScope === 'user'}
                    onChange={(e) => setExpenseScope('user')}
                    className="mr-2"
                  />
                  選択したユーザー
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="company"
                    checked={expenseScope === 'company'}
                    onChange={(e) => setExpenseScope('company')}
                    className="mr-2"
                  />
                  所属会社
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="all"
                    checked={expenseScope === 'all'}
                    onChange={(e) => setExpenseScope('all')}
                    className="mr-2"
                  />
                  全員
                </label>
              </div>
            ) : activeTab === 'shift' ? (
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="user"
                    checked={shiftScope === 'user'}
                    onChange={(e) => setShiftScope('user')}
                    className="mr-2"
                  />
                  選択したユーザー（複数選択可）
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="company"
                    checked={shiftScope === 'company'}
                    onChange={(e) => setShiftScope('company')}
                    className="mr-2"
                  />
                  所属会社
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="all"
                    checked={shiftScope === 'all'}
                    onChange={(e) => setShiftScope('all')}
                    className="mr-2"
                  />
                  全員
                </label>
              </div>
            ) : null}
          </div>
        </div>

        {/* 勤務管理表用会社選択セクション */}
        {activeTab === 'attendance' && attendanceScope === 'company' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              所属会社を選択
            </label>
            <select
              value={selectedAttendancePartnerId}
              onChange={(e) => setSelectedAttendancePartnerId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">会社を選択してください</option>
              <option value="self">自社</option>
              {Array.isArray(partners) && partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 勤務管理表用ユーザー選択セクション */}
        {activeTab === 'attendance' && attendanceScope === 'user' && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                ユーザー選択 ({selectedAttendanceUserIds.length}名選択中)
              </h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const filteredUserIds = filteredAttendanceUsers.map(user => user.id)
                    setSelectedAttendanceUserIds(filteredUserIds)
                  }}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAttendanceUserIds([])}
                  className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  全解除
                </button>
              </div>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="名前、ユーザーID、または会社名で検索..."
                value={attendanceUserSearchQuery}
                onChange={(e) => setAttendanceUserSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredAttendanceUsers.length > 0 ? (
                filteredAttendanceUsers.map((user) => (
                  <label key={user.id} className="flex items-center p-2 hover:bg-gray-100 rounded">
                    <input
                      type="checkbox"
                      checked={selectedAttendanceUserIds.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAttendanceUserIds([...selectedAttendanceUserIds, user.id])
                        } else {
                          setSelectedAttendanceUserIds(selectedAttendanceUserIds.filter(id => id !== user.id))
                        }
                      }}
                      className="mr-3 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-gray-500">
                        ID: {user.userId || user.id}
                        {user.partner?.name && ` - ${user.partner.name}`}
                      </div>
                    </div>
                  </label>
                ))
              ) : (
                <div className="text-center text-sm text-gray-500 py-4">
                  {attendanceUserSearchQuery ? '検索条件に一致するユーザーがいません' : 'ユーザーがいません'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 経費管理表用会社選択セクション */}
        {activeTab === 'expense' && expenseScope === 'company' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              所属会社を選択
            </label>
            <select
              value={selectedExpensePartnerId}
              onChange={(e) => setSelectedExpensePartnerId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">会社を選択してください</option>
              <option value="self">自社</option>
              {Array.isArray(partners) && partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 経費管理表用ユーザー選択セクション */}
        {activeTab === 'expense' && expenseScope === 'user' && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                ユーザー選択 ({selectedExpenseUserIds.length}名選択中)
              </h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const filteredUserIds = filteredExpenseUsers.map(user => user.id)
                    setSelectedExpenseUserIds(filteredUserIds)
                  }}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedExpenseUserIds([])}
                  className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  全解除
                </button>
              </div>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="名前、ユーザーID、または会社名で検索..."
                value={expenseUserSearchQuery}
                onChange={(e) => setExpenseUserSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredExpenseUsers.length > 0 ? (
                filteredExpenseUsers.map((user) => (
                  <label key={user.id} className="flex items-center p-2 hover:bg-gray-100 rounded">
                    <input
                      type="checkbox"
                      checked={selectedExpenseUserIds.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExpenseUserIds([...selectedExpenseUserIds, user.id])
                        } else {
                          setSelectedExpenseUserIds(selectedExpenseUserIds.filter(id => id !== user.id))
                        }
                      }}
                      className="mr-3 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-gray-500">
                        ID: {user.userId || user.id}
                        {user.partner?.name && ` - ${user.partner.name}`}
                      </div>
                    </div>
                  </label>
                ))
              ) : (
                <div className="text-center text-sm text-gray-500 py-4">
                  {expenseUserSearchQuery ? '検索条件に一致するユーザーがいません' : 'ユーザーがいません'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* シフト表用会社選択セクション */}
        {activeTab === 'shift' && shiftScope === 'company' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              所属会社を選択
            </label>
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">会社を選択してください</option>
              <option value="self">自社</option>
              {Array.isArray(partners) && partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* シフト表用ユーザー選択セクション */}
        {activeTab === 'shift' && shiftScope === 'user' && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                ユーザー選択 ({selectedUserIds.length}名選択中)
              </h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const filteredUserIds = filteredUsers.map(user => user.id)
                    setSelectedUserIds(filteredUserIds)
                  }}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  全解除
                </button>
              </div>
            </div>

            {/* 検索ボックス */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="名前、ユーザーID、または会社名で検索..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <label key={user.id} className="flex items-center p-2 hover:bg-gray-100 rounded">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds([...selectedUserIds, user.id])
                        } else {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== user.id))
                        }
                      }}
                      className="mr-3 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-gray-500">
                        ID: {user.userId || user.id}
                        {user.partner?.name && ` - ${user.partner.name}`}
                      </div>
                    </div>
                  </label>
                ))
              ) : (
                <div className="text-center text-sm text-gray-500 py-4">
                  {userSearchQuery ? '検索条件に一致するユーザーがいません' : 'ユーザーがいません'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* レポートタイプ設定（勤務管理表のみ） */}
        {activeTab === 'attendance' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              レポートタイプ
            </label>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="full"
                  checked={reportType === 'full'}
                  onChange={(e) => setReportType('full')}
                  className="mr-2"
                />
                全情報表示版
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="submission"
                  checked={reportType === 'submission'}
                  onChange={(e) => setReportType('submission')}
                  className="mr-2"
                />
                提出用（基本）
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="submission_with_expenses"
                  checked={reportType === 'submission_with_expenses'}
                  onChange={(e) => setReportType('submission_with_expenses')}
                  className="mr-2"
                />
                提出用（交通費含む）
              </label>
            </div>
          </div>
        )}

        {/* シフト表オプション */}
        {activeTab === 'shift' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              表示オプション
            </label>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showShiftLocation"
                checked={showShiftLocation}
                onChange={(e) => setShowShiftLocation(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="showShiftLocation" className="text-sm">
                シフトの稼働店舗も表示する
              </label>
            </div>
          </div>
        )}

        {/* PDF向き設定 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PDF向き（PDF出力時のみ）
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="portrait"
                checked={pdfOrientation === 'portrait'}
                onChange={(e) => setPdfOrientation('portrait')}
                className="mr-2"
              />
              縦向き
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="landscape"
                checked={pdfOrientation === 'landscape'}
                onChange={(e) => setPdfOrientation('landscape')}
                className="mr-2"
              />
              横向き
            </label>
          </div>
        </div>

        {/* 出力ボタン */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePreview}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            プレビュー
          </button>
          
          <button
            onClick={() => handleExport('excel')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Excel出力
          </button>
          
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            CSV出力
          </button>
          
          <button
            onClick={() => handleExport('pdf')}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            PDF出力
          </button>
        </div>
      </div>
    </PageAccessGuard>
  )
}