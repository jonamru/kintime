import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { formatJapanDate } from '@/lib/dateUtils'
import { createRequestCache } from '@/lib/requestCache'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // リクエストレベルキャッシュを初期化
    const cache = createRequestCache()

    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month')
    const scope = searchParams.get('scope') || 'user'
    const userId = searchParams.get('userId')
    const userIds = searchParams.getAll('userIds')
    const partnerId = searchParams.get('partnerId')
    const type = searchParams.get('type') || 'full'
    const format = searchParams.get('format') || 'json'
    const orientation = searchParams.get('orientation') || 'landscape'
    
    // ページネーションパラメータを追加
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = (page - 1) * limit
    
    console.log('Attendance レポート API params:', { month, scope, userId, userIds, partnerId, type, format, orientation, page, limit })

    if (!month) {
      return NextResponse.json({ error: '対象年月が必要です' }, { status: 400 })
    }

    if (scope === 'user' && (!userId && userIds.length === 0)) {
      return NextResponse.json({ error: 'ユーザー選択時はユーザーIDが必要です' }, { status: 400 })
    }

    if (scope === 'company' && !partnerId) {
      return NextResponse.json({ error: '会社選択時は会社IDが必要です' }, { status: 400 })
    }

    // 権限チェック（キャッシュ使用）
    const canViewAll = await hasPermission(currentUser.id, 'attendanceManagement', 'viewAll', cache)
    const canViewCompany = await hasPermission(currentUser.id, 'attendanceManagement', 'viewCompany', cache)
    
    if (scope === 'all' && !canViewAll) {
      return NextResponse.json({ error: '全員の勤怠を閲覧する権限がありません' }, { status: 403 })
    }

    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0)

    // 対象ユーザーを取得
    let users: any[] = []
    if (scope === 'user') {
      const targetUserIds = userIds.length > 0 ? userIds : (userId ? [userId] : [])
      
      // 権限チェック - 自分以外のユーザーが含まれている場合
      const hasOtherUsers = targetUserIds.some(id => id !== currentUser.id)
      if (hasOtherUsers && !canViewAll && !canViewCompany) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      
      users = await prisma.user.findMany({
        where: { 
          id: { in: targetUserIds }
        },
        select: {
          id: true,
          name: true,
          userId: true,
          partner: {
            select: { name: true }
          }
        },
        orderBy: { name: 'asc' }
      })
      
      if (users.length === 0) {
        return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
      }
      
    } else if (scope === 'company') {
      if (!canViewAll && !canViewCompany) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      
      users = await prisma.user.findMany({
        where: {
          partnerId: partnerId === 'self' ? null : partnerId
        },
        select: {
          id: true,
          name: true,
          userId: true,
          partner: {
            select: { name: true }
          }
        },
        orderBy: { name: 'asc' }
      })
      
    } else if (scope === 'all') {
      users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          userId: true,
          partner: {
            select: { name: true }
          }
        },
        orderBy: [{ partnerId: 'asc' }, { name: 'asc' }]
      })
    }

    console.log(`Found ${users.length} users for attendance report`)
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 複数ユーザー対応 - 全ユーザーのシフトデータを取得
    startDate.setHours(0, 0, 0, 0)
    const shiftEndDate = new Date(year, monthNum, 1)
    shiftEndDate.setHours(23, 59, 59, 999)

    const userIds_for_shifts = users.map(u => u.id)
    const shifts = await prisma.shift.findMany({
      where: {
        userId: { in: userIds_for_shifts },
        date: {
          gte: startDate,
          lte: shiftEndDate
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      },
      orderBy: [{ userId: 'asc' }, { date: 'asc' }]
    })

    // 複数ユーザーの場合のレスポンス形式
    if (users.length > 1) {
      const multiUserReport = {
        users,
        month,
        summary: {
          totalUsers: users.length,
          totalShifts: shifts.length
        },
        shifts
      }
      
      if (format === 'json') {
        return NextResponse.json(multiUserReport)
      }
      
      // 複数ユーザーのExcel出力
      if (format === 'excel') {
        const workbook = XLSX.utils.book_new()
        
        // 全ユーザーの勤怠・経費データを一括取得（N+1問題を回避）
        const allUserIds = users.map(u => u.id)
        
        const [allAttendances, allExpenses] = await Promise.all([
          prisma.attendance.findMany({
            where: {
              userId: { in: allUserIds },
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            orderBy: [{ date: 'asc' }, { clockTime: 'asc' }]
          }),
          prisma.expense.findMany({
            where: {
              userId: { in: allUserIds },
              date: {
                gte: startDate,
                lte: endDate
              },
              status: 'APPROVED'
            },
            select: {
              userId: true,
              date: true,
              amount: true
            }
          })
        ])
        
        // ユーザーIDごとにデータをグループ化
        const attendancesByUser = new Map()
        const expensesByUser = new Map()
        
        allAttendances.forEach(attendance => {
          if (!attendancesByUser.has(attendance.userId)) {
            attendancesByUser.set(attendance.userId, [])
          }
          attendancesByUser.get(attendance.userId).push(attendance)
        })
        
        allExpenses.forEach(expense => {
          if (!expensesByUser.has(expense.userId)) {
            expensesByUser.set(expense.userId, [])
          }
          expensesByUser.get(expense.userId).push(expense)
        })
        
        // 各ユーザーごとにシートを作成
        for (const user of users) {
          const userShifts = shifts.filter(s => s.userId === user.id)
          const userAttendances = attendancesByUser.get(user.id) || []
          const userExpenses = expensesByUser.get(user.id) || []

          // 単一ユーザー処理と同じロジックを適用
          const dayNames = ['日', '月', '火', '水', '木', '金', '土']
          const records = []
          let workDays = 0
          let totalHours = 0
          let absences = 0
          let lateCount = 0
          const lastDayOfMonth = new Date(year, monthNum, 0).getDate()
          
          for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, monthNum - 1, day)
            const dateString = formatJapanDate(date)
            const dayOfWeek = dayNames[date.getDay()]

            const shift = userShifts.find(s => formatJapanDate(s.date) === dateString)
            const dayAttendances = userAttendances.filter(a => formatJapanDate(a.date) === dateString)
            
            const wakeupRecord = dayAttendances.find(a => a.type === 'WAKE_UP')
            const departureRecord = dayAttendances.find(a => a.type === 'DEPARTURE')
            const clockInRecord = dayAttendances.find(a => a.type === 'CLOCK_IN')
            const clockOutRecord = dayAttendances.find(a => a.type === 'CLOCK_OUT')
            
            const dayExpenses = userExpenses
              .filter(e => formatJapanDate(e.date) === dateString)
              .reduce((sum, e) => sum + e.amount, 0)

            let status = '公休'
            let workplace = '-'
            let startTime = ''
            let endTime = ''
            let alerts: string[] = []

            if (shift && status !== '欠勤') {
              status = '出勤'
              workplace = shift.location
              startTime = new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              endTime = new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              workDays++

              if (clockInRecord) {
                const clockInTime = new Date(clockInRecord.clockTime)
                const shiftStartTime = new Date(shift.startTime)
                if (clockInTime > shiftStartTime) {
                  alerts.push('BT')
                  lateCount++
                }
                if (type === 'submission' || type === 'submission_with_expenses') {
                  // 提出用は予定時間ベースで計算
                  const shiftStartTime = new Date(shift.startTime)
                  const shiftEndTime = new Date(shift.endTime)
                  const totalShiftMinutes = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
                  const breakMinutes = shift.breakTime || 0
                  const plannedWorkMinutes = totalShiftMinutes - breakMinutes
                  totalHours += plannedWorkMinutes / 60
                } else {
                  // 全情報表示版は実打刻ベースで計算
                  if (clockOutRecord) {
                    const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - clockInTime.getTime()) / (1000 * 60)
                    const breakMinutes = shift.breakTime || 0
                    const actualWorkMinutes = totalMinutes - breakMinutes
                    totalHours += actualWorkMinutes / 60
                  }
                }
              } else {
                const now = new Date()
                const shiftEndTime = new Date(shift.endTime)
                if ((formatJapanDate(now) === dateString && now > shiftEndTime) || (date < now && formatJapanDate(now) !== dateString)) {
                  status = '欠勤'
                  alerts.push('AB')
                  absences++
                  workDays--
                  // 提出用では欠勤時に時間欄を「-」にする
                  if (type === 'submission' || type === 'submission_with_expenses') {
                    startTime = '-'
                    endTime = '-'
                  }
                }
              }
            }

            const record: any = {
              date: `${year}/${monthNum}/${day}`,
              dayOfWeek,
              status,
              workplace,
              startTime,
              endTime
            }

            if (shift && status !== '欠勤') {
              const breakMinutes = shift.breakTime || 0
              const breakHours = Math.floor(breakMinutes / 60)
              const remainingMinutes = breakMinutes % 60
              record.breakTime = `${breakHours}:${remainingMinutes.toString().padStart(2, '0')}`
              
              // 実働時間（提出用は予定時間ベースで計算）
              if (type === 'submission' || type === 'submission_with_expenses') {
                // シフトの開始時間と終了時間から計算
                const shiftStartTime = new Date(shift.startTime)
                const shiftEndTime = new Date(shift.endTime)
                const totalShiftMinutes = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
                const plannedWorkMinutes = totalShiftMinutes - breakMinutes
                const hours = Math.floor(plannedWorkMinutes / 60)
                const minutes = Math.floor(plannedWorkMinutes % 60)
                record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
              } else {
                // 全情報表示版は実際の打刻時間ベースで計算
                if (clockOutRecord && clockInRecord) {
                  const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
                  const actualWorkMinutes = totalMinutes - breakMinutes
                  const hours = Math.floor(actualWorkMinutes / 60)
                  const minutes = Math.floor(actualWorkMinutes % 60)
                  record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
                } else {
                  record.actualWorkHours = '-'
                }
              }
            } else {
              record.breakTime = '-'
              record.actualWorkHours = '-'
            }

            if (type === 'full' || type === 'submission_with_expenses') {
              record.expenses = dayExpenses
              
              if (type === 'full') {
                record.wakeupReport = wakeupRecord ? new Date(wakeupRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
                record.departureReport = departureRecord ? new Date(departureRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
                record.clockIn = clockInRecord ? new Date(clockInRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
                record.clockOut = clockOutRecord ? new Date(clockOutRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
                if (clockOutRecord && clockInRecord && shift) {
                  const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
                  const actualWorkMinutes = totalMinutes - (shift.breakTime || 0)
                  const hours = Math.floor(actualWorkMinutes / 60)
                  const minutes = Math.floor(actualWorkMinutes % 60)
                  record.workHours = `${hours}:${minutes.toString().padStart(2, '0')}`
                } else {
                  record.workHours = null
                }
                record.alerts = alerts
              }
            }

            records.push(record)
          }

          // ワークシートデータを作成（レポートタイプに応じて）
          const worksheetData = [
            [`${user.name}(${user.userId || user.id}) - 勤務管理表`],
            [`対象年月: ${month}`],
            [],
            // ヘッダー行
            ...(type === 'submission' 
              ? [['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間']]
              : type === 'submission_with_expenses'
              ? [['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間', '交通費']]
              : [['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '起床報告', '出発報告', '出勤', '退勤', '勤務時間', 'アラート', '経費合計']]
            ),
            // データ行
            ...records.map(record => {
              if (type === 'submission') {
                return [
                  record.date,
                  record.dayOfWeek,
                  record.status,
                  record.workplace,
                  record.startTime,
                  record.endTime,
                  record.breakTime || '-',
                  record.actualWorkHours || '-'
                ]
              } else if (type === 'submission_with_expenses') {
                return [
                  record.date,
                  record.dayOfWeek,
                  record.status,
                  record.workplace,
                  record.startTime,
                  record.endTime,
                  record.breakTime || '-',
                  record.actualWorkHours || '-',
                  record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
                ]
              } else {
                return [
                  record.date,
                  record.dayOfWeek,
                  record.status,
                  record.workplace,
                  record.startTime,
                  record.endTime,
                  record.wakeupReport || '-',
                  record.departureReport || '-',
                  record.clockIn || '-',
                  record.clockOut || '-',
                  record.workHours || '-',
                  record.alerts?.join(', ') || '-',
                  record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
                ]
              }
            })
          ]

          const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
          const sheetName = `${user.name.substring(0, 10)}` // Excel制限に対応
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
        }
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
        // ファイル名を選択範囲に応じて決定
        let fileName = ''
        if (scope === 'user') {
          fileName = `勤務管理表_選択ユーザー_${type}_${month}.xlsx`
        } else if (scope === 'company') {
          let companyName = '所属会社'
          if (partnerId === 'self') {
            companyName = '自社'
          } else if (partnerId) {
            const partner = await prisma.partner.findUnique({
              where: { id: partnerId },
              select: { name: true }
            })
            companyName = partner?.name || '所属会社'
          }
          fileName = `勤務管理表_${companyName}_${type}_${month}.xlsx`
        } else if (scope === 'all') {
          fileName = `勤務管理表_全員_${type}_${month}.xlsx`
        } else {
          fileName = `勤務管理表_複数ユーザー_${type}_${month}.xlsx`
        }
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
          }
        })
      }
      
      // 複数ユーザーのCSV出力（統合形式）
      if (format === 'csv') {
        // レポートタイプに応じたヘッダー
        const csvData = [
          type === 'submission' 
            ? ['氏名', 'ユーザーID', '日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間']
            : type === 'submission_with_expenses'
            ? ['氏名', 'ユーザーID', '日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間', '交通費']
            : ['氏名', 'ユーザーID', '日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '起床報告', '出発報告', '出勤', '退勤', '勤務時間', 'アラート', '経費合計']
        ]
        
        // 全ユーザーの勤怠・経費データを一括取得（N+1問題を回避）
        const allUserIds = users.map(u => u.id)
        
        const [allAttendances, allExpenses] = await Promise.all([
          prisma.attendance.findMany({
            where: {
              userId: { in: allUserIds },
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            orderBy: [{ date: 'asc' }, { clockTime: 'asc' }]
          }),
          prisma.expense.findMany({
            where: {
              userId: { in: allUserIds },
              date: {
                gte: startDate,
                lte: endDate
              },
              status: 'APPROVED'
            },
            select: {
              userId: true,
              date: true,
              amount: true
            }
          })
        ])
        
        // ユーザーIDごとにデータをグループ化
        const attendancesByUser = new Map()
        const expensesByUser = new Map()
        
        allAttendances.forEach(attendance => {
          if (!attendancesByUser.has(attendance.userId)) {
            attendancesByUser.set(attendance.userId, [])
          }
          attendancesByUser.get(attendance.userId).push(attendance)
        })
        
        allExpenses.forEach(expense => {
          if (!expensesByUser.has(expense.userId)) {
            expensesByUser.set(expense.userId, [])
          }
          expensesByUser.get(expense.userId).push(expense)
        })
        
        for (const user of users) {
          const userShifts = shifts.filter(s => s.userId === user.id)
          const userAttendances = attendancesByUser.get(user.id) || []
          const userExpenses = expensesByUser.get(user.id) || []

          // 単一ユーザー処理と同じロジックを適用
          const dayNames = ['日', '月', '火', '水', '木', '金', '土']
          const lastDayOfMonth = new Date(year, monthNum, 0).getDate()
          
          for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, monthNum - 1, day)
            const dateString = formatJapanDate(date)
            const dayOfWeek = dayNames[date.getDay()]

            const shift = userShifts.find(s => formatJapanDate(s.date) === dateString)
            const dayAttendances = userAttendances.filter(a => formatJapanDate(a.date) === dateString)
            
            const wakeupRecord = dayAttendances.find(a => a.type === 'WAKE_UP')
            const departureRecord = dayAttendances.find(a => a.type === 'DEPARTURE')
            const clockInRecord = dayAttendances.find(a => a.type === 'CLOCK_IN')
            const clockOutRecord = dayAttendances.find(a => a.type === 'CLOCK_OUT')
            
            const dayExpenses = userExpenses
              .filter(e => formatJapanDate(e.date) === dateString)
              .reduce((sum, e) => sum + e.amount, 0)

            let status = '公休'
            let workplace = '-'
            let startTime = ''
            let endTime = ''
            let alerts: string[] = []

            if (shift && status !== '欠勤') {
              status = '出勤'
              workplace = shift.location
              startTime = new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              endTime = new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

              if (clockInRecord) {
                const clockInTime = new Date(clockInRecord.clockTime)
                const shiftStartTime = new Date(shift.startTime)
                if (clockInTime > shiftStartTime) {
                  alerts.push('BT')
                }
              } else {
                const now = new Date()
                const shiftEndTime = new Date(shift.endTime)
                if ((formatJapanDate(now) === dateString && now > shiftEndTime) || (date < now && formatJapanDate(now) !== dateString)) {
                  status = '欠勤'
                  alerts.push('AB')
                  // 提出用では欠勤時に時間欄を「-」にする
                  if (type === 'submission' || type === 'submission_with_expenses') {
                    startTime = '-'
                    endTime = '-'
                  }
                }
              }
            }

            const record: any = {
              date: `${year}/${monthNum}/${day}`,
              dayOfWeek,
              status,
              workplace,
              startTime,
              endTime
            }

            if (shift && status !== '欠勤') {
              const breakMinutes = shift.breakTime || 0
              const breakHours = Math.floor(breakMinutes / 60)
              const remainingMinutes = breakMinutes % 60
              record.breakTime = `${breakHours}:${remainingMinutes.toString().padStart(2, '0')}`
              
              // 実働時間（提出用は予定時間ベースで計算）
              if (type === 'submission' || type === 'submission_with_expenses') {
                // シフトの開始時間と終了時間から計算
                const shiftStartTime = new Date(shift.startTime)
                const shiftEndTime = new Date(shift.endTime)
                const totalShiftMinutes = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
                const plannedWorkMinutes = totalShiftMinutes - breakMinutes
                const hours = Math.floor(plannedWorkMinutes / 60)
                const minutes = Math.floor(plannedWorkMinutes % 60)
                record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
              } else {
                // 全情報表示版は実際の打刻時間ベースで計算
                if (clockOutRecord && clockInRecord) {
                  const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
                  const actualWorkMinutes = totalMinutes - breakMinutes
                  const hours = Math.floor(actualWorkMinutes / 60)
                  const minutes = Math.floor(actualWorkMinutes % 60)
                  record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
                } else {
                  record.actualWorkHours = '-'
                }
              }
            } else {
              record.breakTime = '-'
              record.actualWorkHours = '-'
            }

            if (type === 'full' || type === 'submission_with_expenses') {
              record.expenses = dayExpenses
              
              if (type === 'full') {
                record.wakeupReport = wakeupRecord ? new Date(wakeupRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
                record.departureReport = departureRecord ? new Date(departureRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
                record.clockIn = clockInRecord ? new Date(clockInRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
                record.clockOut = clockOutRecord ? new Date(clockOutRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
                if (clockOutRecord && clockInRecord && shift) {
                  const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
                  const actualWorkMinutes = totalMinutes - (shift.breakTime || 0)
                  const hours = Math.floor(actualWorkMinutes / 60)
                  const minutes = Math.floor(actualWorkMinutes % 60)
                  record.workHours = `${hours}:${minutes.toString().padStart(2, '0')}`
                } else {
                  record.workHours = null
                }
                record.alerts = alerts
              }
            }

            // CSVデータに追加（レポートタイプに応じて）
            if (type === 'submission') {
              csvData.push([
                user.name,
                user.userId || user.id,
                record.date,
                record.dayOfWeek,
                record.status,
                record.workplace,
                record.startTime,
                record.endTime,
                record.breakTime || '-',
                record.actualWorkHours || '-'
              ])
            } else if (type === 'submission_with_expenses') {
              csvData.push([
                user.name,
                user.userId || user.id,
                record.date,
                record.dayOfWeek,
                record.status,
                record.workplace,
                record.startTime,
                record.endTime,
                record.breakTime || '-',
                record.actualWorkHours || '-',
                record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
              ])
            } else {
              csvData.push([
                user.name,
                user.userId || user.id,
                record.date,
                record.dayOfWeek,
                record.status,
                record.workplace,
                record.startTime,
                record.endTime,
                record.wakeupReport || '-',
                record.departureReport || '-',
                record.clockIn || '-',
                record.clockOut || '-',
                record.workHours || '-',
                record.alerts?.join(', ') || '-',
                record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
              ])
            }
          }
        }
        
        const csvContent = csvData.map(row => 
          row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n')
        
        const bom = '\uFEFF'
        const csvBuffer = Buffer.from(bom + csvContent, 'utf8')
        // ファイル名を選択範囲に応じて決定
        let fileName = ''
        if (scope === 'user') {
          fileName = `勤務管理表_選択ユーザー_${type}_${month}.csv`
        } else if (scope === 'company') {
          let companyName = '所属会社'
          if (partnerId === 'self') {
            companyName = '自社'
          } else if (partnerId) {
            const partner = await prisma.partner.findUnique({
              where: { id: partnerId },
              select: { name: true }
            })
            companyName = partner?.name || '所属会社'
          }
          fileName = `勤務管理表_${companyName}_${type}_${month}.csv`
        } else if (scope === 'all') {
          fileName = `勤務管理表_全員_${type}_${month}.csv`
        } else {
          fileName = `勤務管理表_複数ユーザー_${type}_${month}.csv`
        }
        
        return new NextResponse(csvBuffer, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
          }
        })
      }
      
      // 複数ユーザーのPDF出力
      if (format === 'pdf') {
        try {
          const puppeteer = await import('puppeteer')
          
          // 全ユーザーの勤怠・経費データを一括取得（N+1問題を回避）
          const allUserIds = users.map(u => u.id)
          
          const [allAttendances, allExpenses] = await Promise.all([
            prisma.attendance.findMany({
              where: {
                userId: { in: allUserIds },
                date: {
                  gte: startDate,
                  lte: endDate
                }
              },
              orderBy: [{ date: 'asc' }, { clockTime: 'asc' }]
            }),
            prisma.expense.findMany({
              where: {
                userId: { in: allUserIds },
                date: {
                  gte: startDate,
                  lte: endDate
                },
                status: 'APPROVED'
              },
              select: {
                userId: true,
                date: true,
                amount: true
              }
            })
          ])
          
          // ユーザーIDごとにデータをグループ化
          const attendancesByUser = new Map()
          const expensesByUser = new Map()
          
          allAttendances.forEach(attendance => {
            if (!attendancesByUser.has(attendance.userId)) {
              attendancesByUser.set(attendance.userId, [])
            }
            attendancesByUser.get(attendance.userId).push(attendance)
          })
          
          allExpenses.forEach(expense => {
            if (!expensesByUser.has(expense.userId)) {
              expensesByUser.set(expense.userId, [])
            }
            expensesByUser.get(expense.userId).push(expense)
          })
          
          let combinedHtmlContent = ''
          
          // 各ユーザーのPDFページを生成
          for (let userIndex = 0; userIndex < users.length; userIndex++) {
            const user = users[userIndex]
            const userShifts = shifts.filter(s => s.userId === user.id)
            const userAttendances = attendancesByUser.get(user.id) || []
            const userExpenses = expensesByUser.get(user.id) || []

            // ユーザーごとの統計計算
            const dayNames = ['日', '月', '火', '水', '木', '金', '土']
            let workDays = 0
            let totalHours = 0
            let absences = 0
            let lateCount = 0
            const lastDayOfMonth = new Date(year, monthNum, 0).getDate()
            const records = []
            
            for (let day = 1; day <= lastDayOfMonth; day++) {
              const date = new Date(year, monthNum - 1, day)
              const dateString = formatJapanDate(date)
              const dayOfWeek = dayNames[date.getDay()]

              const shift = userShifts.find(s => formatJapanDate(s.date) === dateString)
              const dayAttendances = userAttendances.filter(a => formatJapanDate(a.date) === dateString)
              
              const wakeupRecord = dayAttendances.find(a => a.type === 'WAKE_UP')
              const departureRecord = dayAttendances.find(a => a.type === 'DEPARTURE')
              const clockInRecord = dayAttendances.find(a => a.type === 'CLOCK_IN')
              const clockOutRecord = dayAttendances.find(a => a.type === 'CLOCK_OUT')
              
              const dayExpenses = userExpenses
                .filter(e => formatJapanDate(e.date) === dateString)
                .reduce((sum, e) => sum + e.amount, 0)

              let status = '公休'
              let workplace = '-'
              let startTime = ''
              let endTime = ''
              let alerts: string[] = []

              if (shift && status !== '欠勤') {
                status = '出勤'
                workplace = shift.location
                startTime = new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                endTime = new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                workDays++

                if (clockInRecord) {
                  const clockInTime = new Date(clockInRecord.clockTime)
                  const shiftStartTime = new Date(shift.startTime)
                  if (clockInTime > shiftStartTime) {
                    alerts.push('BT')
                    lateCount++
                  }
                  if (type === 'submission' || type === 'submission_with_expenses') {
                    // 提出用は予定時間ベースで計算
                    const shiftStartTime = new Date(shift.startTime)
                    const shiftEndTime = new Date(shift.endTime)
                    const totalShiftMinutes = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
                    const breakMinutes = shift.breakTime || 0
                    const plannedWorkMinutes = totalShiftMinutes - breakMinutes
                    totalHours += plannedWorkMinutes / 60
                  } else {
                    // 全情報表示版は実打刻ベースで計算
                    if (clockOutRecord) {
                      const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - clockInTime.getTime()) / (1000 * 60)
                      const breakMinutes = shift.breakTime || 0
                      const actualWorkMinutes = totalMinutes - breakMinutes
                      totalHours += actualWorkMinutes / 60
                    }
                  }
                } else {
                  const now = new Date()
                  const shiftEndTime = new Date(shift.endTime)
                  if ((formatJapanDate(now) === dateString && now > shiftEndTime) || (date < now && formatJapanDate(now) !== dateString)) {
                    status = '欠勤'
                    alerts.push('AB')
                    absences++
                    workDays--
                    // 提出用では欠勤時に時間欄を「-」にする
                    if (type === 'submission' || type === 'submission_with_expenses') {
                      startTime = '-'
                      endTime = '-'
                    }
                  }
                }
              }

              const record: any = {
                date: `${year}/${monthNum}/${day}`,
                dayOfWeek,
                status,
                workplace,
                startTime,
                endTime
              }

              if (shift && status !== '欠勤') {
                const breakMinutes = shift.breakTime || 0
                const breakHours = Math.floor(breakMinutes / 60)
                const remainingMinutes = breakMinutes % 60
                record.breakTime = `${breakHours}:${remainingMinutes.toString().padStart(2, '0')}`
                
                // 実働時間（提出用は予定時間ベースで計算）
                if (type === 'submission' || type === 'submission_with_expenses') {
                  // シフトの開始時間と終了時間から計算
                  const shiftStartTime = new Date(shift.startTime)
                  const shiftEndTime = new Date(shift.endTime)
                  const totalShiftMinutes = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
                  const plannedWorkMinutes = totalShiftMinutes - breakMinutes
                  const hours = Math.floor(plannedWorkMinutes / 60)
                  const minutes = Math.floor(plannedWorkMinutes % 60)
                  record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
                } else {
                  // 全情報表示版は実際の打刻時間ベースで計算
                  if (clockOutRecord && clockInRecord) {
                    const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
                    const actualWorkMinutes = totalMinutes - breakMinutes
                    const hours = Math.floor(actualWorkMinutes / 60)
                    const minutes = Math.floor(actualWorkMinutes % 60)
                    record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
                  } else {
                    record.actualWorkHours = '-'
                  }
                }
              } else {
                record.breakTime = '-'
                record.actualWorkHours = '-'
              }

              if (type === 'full' || type === 'submission_with_expenses') {
                record.expenses = dayExpenses
                
                if (type === 'full') {
                  record.wakeupReport = wakeupRecord ? new Date(wakeupRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
                  record.departureReport = departureRecord ? new Date(departureRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
                  record.clockIn = clockInRecord ? new Date(clockInRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
                  record.clockOut = clockOutRecord ? new Date(clockOutRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
                  if (clockOutRecord && clockInRecord && shift) {
                    const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
                    const actualWorkMinutes = totalMinutes - (shift.breakTime || 0)
                    const hours = Math.floor(actualWorkMinutes / 60)
                    const minutes = Math.floor(actualWorkMinutes % 60)
                    record.workHours = `${hours}:${minutes.toString().padStart(2, '0')}`
                  } else {
                    record.workHours = null
                  }
                  record.alerts = alerts
                }
              }

              records.push(record)
            }

            const totalExpenses = userExpenses.reduce((sum, e) => sum + e.amount, 0)
            const totalMinutes = Math.floor(totalHours * 60)
            const totalHoursFormatted = `${Math.floor(totalMinutes / 60)}:${(totalMinutes % 60).toString().padStart(2, '0')}`

            // HTMLコンテンツを生成
            const headers = type === 'submission' 
              ? ['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間']
              : type === 'submission_with_expenses'
              ? ['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間', '交通費']
              : ['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '起床報告', '出発報告', '出勤', '退勤', '勤務時間', 'アラート', '経費合計']
            
            const pageBreak = userIndex > 0 ? 'page-break-before: always;' : ''
            
            combinedHtmlContent += `
              <div style="${pageBreak}">
                <h1>勤務管理表${type === 'full' ? '（全情報表示版）' : type === 'submission_with_expenses' ? '（提出用・交通費含む）' : '（提出用）'}</h1>
                <div class="info">
                  <div>氏名: ${user.name}</div>
                  <div>ユーザーID: ${user.userId || user.id}</div>
                  <div>対象年月: ${month}</div>
                </div>
                <div class="summary">
                  ${type === 'submission' 
                    ? `稼働日数: ${workDays}日　|　実働時間: ${totalHoursFormatted}　|　欠勤: ${absences}日`
                    : type === 'submission_with_expenses'
                    ? `稼働日数: ${workDays}日　|　実働時間: ${totalHoursFormatted}　|　欠勤: ${absences}日　|　交通費: ¥${totalExpenses.toLocaleString()}`
                    : `稼働日数: ${workDays}日　|　実働時間: ${totalHoursFormatted}　|　欠勤: ${absences}日　|　遅刻: ${lateCount}回　|　経費: ¥${totalExpenses.toLocaleString()}`
                  }
                </div>
                <table>
                  <thead>
                    <tr>
                      ${headers.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
            `
            
            records.forEach(record => {
              const statusClass = record.status === '欠勤' ? 'absent' : record.status === '出勤' ? 'work' : 'off'
              const rowData = type === 'submission' 
                ? [
                    record.date,
                    record.dayOfWeek,
                    record.status,
                    record.workplace,
                    record.startTime,
                    record.endTime,
                    record.breakTime || '-',
                    record.actualWorkHours || '-'
                  ]
                : type === 'submission_with_expenses'
                ? [
                    record.date,
                    record.dayOfWeek,
                    record.status,
                    record.workplace,
                    record.startTime,
                    record.endTime,
                    record.breakTime || '-',
                    record.actualWorkHours || '-',
                    record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
                  ]
                : [
                    record.date,
                    record.dayOfWeek,
                    record.status,
                    record.workplace,
                    record.startTime,
                    record.endTime,
                    record.wakeupReport || '-',
                    record.departureReport || '-',
                    record.clockIn || '-',
                    record.clockOut || '-',
                    record.workHours || '-',
                    (record.alerts || []).join(', ') || '-',
                    record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
                  ]
              
              combinedHtmlContent += `<tr class="${statusClass}">` + rowData.map(data => `<td>${data}</td>`).join('') + '</tr>'
            })
            
            combinedHtmlContent += `
                  </tbody>
                </table>
                ${orientation === 'portrait' ? `
                ` : ''}
              </div>
            `
          }

          const fullHtmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>勤務管理表（複数ユーザー）</title>
              <style>
                @page {
                  size: A4 ${orientation};
                  margin: ${orientation === 'portrait' ? '6mm 12mm 4mm 12mm' : '15mm'};
                }
                body { 
                  font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic Medium', 'Meiryo', sans-serif;
                  font-size: ${orientation === 'portrait' ? '11px' : '10px'}; 
                  margin: 0; 
                  padding: 0;
                  color: #000;
                  line-height: ${orientation === 'portrait' ? '1.3' : '1.3'};
                }
                h1 { 
                  font-size: ${orientation === 'portrait' ? '18px' : '16px'}; 
                  margin-bottom: ${orientation === 'portrait' ? '8px' : '10px'}; 
                  text-align: center;
                  border-bottom: 2px solid #333;
                  padding-bottom: ${orientation === 'portrait' ? '4px' : '3px'};
                }
                .info { 
                  margin-bottom: ${orientation === 'portrait' ? '8px' : '15px'}; 
                  display: flex;
                  justify-content: space-between;
                  background: #f9f9f9;
                  padding: ${orientation === 'portrait' ? '6px 8px' : '8px'};
                  border: 1px solid #ddd;
                  border-radius: 3px;
                  font-size: ${orientation === 'portrait' ? '10px' : '10px'};
                }
                .summary { 
                  margin-bottom: ${orientation === 'portrait' ? '8px' : '15px'}; 
                  background: #e8f4fd; 
                  padding: ${orientation === 'portrait' ? '6px 8px' : '8px'}; 
                  border: 1px solid #b0d4f1;
                  border-radius: 3px;
                  font-weight: bold;
                  text-align: center;
                  font-size: ${orientation === 'portrait' ? '10px' : '10px'};
                }
                table { 
                  border-collapse: collapse; 
                  width: 100%; 
                  font-size: ${orientation === 'portrait' ? '10px' : '9px'};
                  margin-top: ${orientation === 'portrait' ? '6px' : '10px'};
                  margin-bottom: ${orientation === 'portrait' ? '8px' : '20px'};
                }
                th, td { 
                  border: 1px solid #333; 
                  padding: ${orientation === 'portrait' ? '6px 5px' : '3px 2px'}; 
                  text-align: center; 
                  vertical-align: middle;
                  line-height: ${orientation === 'portrait' ? '1.4' : '1.2'};
                }
                th { 
                  background-color: #d0d0d0; 
                  font-weight: bold; 
                  font-size: ${orientation === 'portrait' ? '10px' : '8px'};
                  padding: ${orientation === 'portrait' ? '7px 5px' : '3px 2px'};
                }
                td {
                  font-size: ${orientation === 'portrait' ? '9px' : '8px'};
                }
                ${orientation === 'portrait' ? `
                .footer-info {
                  margin-top: 12px;
                  padding: 6px 8px;
                  background: #f5f5f5;
                  border: 1px solid #ddd;
                  border-radius: 3px;
                  font-size: 9px;
                  text-align: center;
                  color: #666;
                }
                ` : ''}
                .absent { background-color: #ffe6e6; }
                .work { background-color: #e6f3ff; }
                .off { background-color: #f0f0f0; }
              </style>
            </head>
            <body>
              ${combinedHtmlContent}
            </body>
            </html>
          `

          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          })
          
          const page = await browser.newPage()
          await page.setContent(fullHtmlContent, { waitUntil: 'networkidle0' })
          
          const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: orientation === 'landscape',
            printBackground: true,
            margin: orientation === 'portrait' ? {
              top: '8mm',
              bottom: '6mm',
              left: '14mm',
              right: '14mm'
            } : {
              top: '15mm',
              bottom: '15mm',
              left: '15mm',
              right: '15mm'
            }
          })
          
          await browser.close()
          
          // ファイル名を選択範囲に応じて決定
          let fileName = ''
          if (scope === 'user') {
            fileName = `勤務管理表_選択ユーザー_${type}_${month}.pdf`
          } else if (scope === 'company') {
            let companyName = '所属会社'
            if (partnerId === 'self') {
              companyName = '自社'
            } else if (partnerId) {
              // 会社名を取得
              const partner = await prisma.partner.findUnique({
                where: { id: partnerId },
                select: { name: true }
              })
              companyName = partner?.name || '所属会社'
            }
            fileName = `勤務管理表_${companyName}_${type}_${month}.pdf`
          } else if (scope === 'all') {
            fileName = `勤務管理表_全員_${type}_${month}.pdf`
          } else {
            fileName = `勤務管理表_複数ユーザー_${type}_${month}.pdf`
          }
          
          return new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
            }
          })
          
        } catch (pdfError) {
          console.error('Multiple user PDF generation error:', pdfError)
          return NextResponse.json({ 
            error: 'PDF生成に失敗しました',
            details: pdfError instanceof Error ? pdfError.message : String(pdfError)
          }, { status: 500 })
        }
      }
    }
    
    // 単一ユーザーの場合は既存のロジックを使用
    const user = users[0]
    const userShifts = shifts.filter(s => s.userId === user.id)

    const attendances = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: [{ date: 'asc' }, { clockTime: 'asc' }]
    })

    const expenses = await prisma.expense.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startDate,
          lte: endDate
        },
        status: 'APPROVED'
      },
      select: {
        date: true,
        amount: true
      }
    })

    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    const records = []
    let workDays = 0
    let totalHours = 0
    let absences = 0
    let lateCount = 0

    // 対象月の最終日を取得
    const lastDayOfMonth = new Date(year, monthNum, 0).getDate()
    
    for (let day = 1; day <= lastDayOfMonth; day++) {
      const date = new Date(year, monthNum - 1, day)
      const dateString = formatJapanDate(date)
      const dayOfWeek = dayNames[date.getDay()]

      const shift = shifts.find(s => formatJapanDate(s.date) === dateString)
      
      // その日の全ての勤怠記録を取得（日本時間基準で比較）
      const dayAttendances = attendances.filter(a => formatJapanDate(a.date) === dateString)
      
      // 各種打刻時刻を取得
      const wakeupRecord = dayAttendances.find(a => a.type === 'WAKE_UP')
      const departureRecord = dayAttendances.find(a => a.type === 'DEPARTURE')
      const clockInRecord = dayAttendances.find(a => a.type === 'CLOCK_IN')
      const clockOutRecord = dayAttendances.find(a => a.type === 'CLOCK_OUT')
      
      const dayExpenses = expenses
        .filter(e => formatJapanDate(e.date) === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      
      // デバッグログ（経費データを常に出力）
      console.log(`日付: ${dateString}, 経費: ¥${dayExpenses}, 経費件数: ${expenses.filter(e => formatJapanDate(e.date) === dateString).length}`)

      let status = '公休'
      let workplace = '-'
      let startTime = ''
      let endTime = ''
      let alerts: string[] = []

      if (shift) {
        // シフトがある場合は基本的に出勤
        status = '出勤'
        workplace = shift.location
        startTime = new Date(shift.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        endTime = new Date(shift.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        workDays++

        if (clockInRecord) {
          // 遅刻チェック
          const clockInTime = new Date(clockInRecord.clockTime)
          const shiftStartTime = new Date(shift.startTime)

          if (clockInTime > shiftStartTime) {
            alerts.push('BT')
            lateCount++
          }

          // 勤務時間計算（提出用は予定時間ベースで計算）
          if (type === 'submission' || type === 'submission_with_expenses') {
            // シフトの開始時間と終了時間から計算
            const shiftStartTime = new Date(shift.startTime)
            const shiftEndTime = new Date(shift.endTime)
            const totalShiftMinutes = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
            const breakMinutes = shift.breakTime || 0
            const plannedWorkMinutes = totalShiftMinutes - breakMinutes
            totalHours += plannedWorkMinutes / 60
          } else {
            // 全情報表示版は実際の打刻時間ベースで計算
            if (clockOutRecord) {
              const clockInTime = new Date(clockInRecord.clockTime)
              const clockOutTime = new Date(clockOutRecord.clockTime)
              const totalMinutes = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60)
              const breakMinutes = shift.breakTime || 0
              const actualWorkMinutes = totalMinutes - breakMinutes
              const workHours = actualWorkMinutes / 60
              
              totalHours += workHours
            }
          }
        } else {
          // 出勤記録がない場合の欠勤判定
          const now = new Date()
          const shiftEndTime = new Date(shift.endTime)
          
          // 当日かつ退勤時刻を過ぎている場合は欠勤
          if (formatJapanDate(now) === dateString && now > shiftEndTime) {
            status = '欠勤'
            alerts.push('AB')
            absences++
            workDays-- // 欠勤の場合は出勤日数から除外
            // 提出用では欠勤時に時間欄を「-」にする
            if (type === 'submission' || type === 'submission_with_expenses') {
              startTime = '-'
              endTime = '-'
            }
          } else if (date < now && formatJapanDate(now) !== dateString) {
            // 過去の日付で出勤記録がない場合も欠勤
            status = '欠勤'
            alerts.push('AB')
            absences++
            workDays-- // 欠勤の場合は出勤日数から除外
            // 提出用では欠勤時に時間欄を「-」にする
            if (type === 'submission' || type === 'submission_with_expenses') {
              startTime = '-'
              endTime = '-'
            }
          }
        }
      }

      const record: any = {
        date: `${year}/${monthNum}/${day}`,
        dayOfWeek,
        status,
        workplace,
        startTime,
        endTime
      }

      // 休憩時間と実働時間は提出用でも含める
      if (shift && status !== '欠勤') {
        // 休憩時間（分を時間:分形式に変換）
        const breakMinutes = shift.breakTime || 0
        const breakHours = Math.floor(breakMinutes / 60)
        const remainingMinutes = breakMinutes % 60
        record.breakTime = `${breakHours}:${remainingMinutes.toString().padStart(2, '0')}`
        
        // 実働時間（提出用は予定時間ベースで計算）
        if (type === 'submission' || type === 'submission_with_expenses') {
          // シフトの開始時間と終了時間から計算
          const shiftStartTime = new Date(shift.startTime)
          const shiftEndTime = new Date(shift.endTime)
          const totalShiftMinutes = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
          const plannedWorkMinutes = totalShiftMinutes - breakMinutes
          const hours = Math.floor(plannedWorkMinutes / 60)
          const minutes = Math.floor(plannedWorkMinutes % 60)
          record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
        } else {
          // 全情報表示版は実際の打刻時間ベースで計算
          if (clockOutRecord && clockInRecord) {
            const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
            const actualWorkMinutes = totalMinutes - breakMinutes
            const hours = Math.floor(actualWorkMinutes / 60)
            const minutes = Math.floor(actualWorkMinutes % 60)
            record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
          } else {
            record.actualWorkHours = '-'
          }
        }
      } else {
        record.breakTime = '-'
        record.actualWorkHours = '-'
      }

      if (type === 'full' || type === 'submission_with_expenses') {
        // 経費データは常に追加（提出用で交通費含む場合も必要）
        record.expenses = dayExpenses
        
        if (type === 'full') {
          record.wakeupReport = wakeupRecord ? 
            new Date(wakeupRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
          record.departureReport = departureRecord ?
            new Date(departureRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
          record.clockIn = clockInRecord ?
            new Date(clockInRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
          record.clockOut = clockOutRecord ?
            new Date(clockOutRecord.clockTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
          if (clockOutRecord && clockInRecord && shift) {
            const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
            const actualWorkMinutes = totalMinutes - (shift.breakTime || 0)
            const hours = Math.floor(actualWorkMinutes / 60)
            const minutes = Math.floor(actualWorkMinutes % 60)
            record.workHours = `${hours}:${minutes.toString().padStart(2, '0')}`
          } else {
            record.workHours = null
          }
          record.alerts = alerts
        }
      }

      records.push(record)
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

    // 合計時間を時間:分形式に変換
    const totalMinutes = Math.floor(totalHours * 60)
    const totalHoursFormatted = `${Math.floor(totalMinutes / 60)}:${(totalMinutes % 60).toString().padStart(2, '0')}`

    const report = {
      user,
      month,
      summary: {
        workDays,
        totalHours: totalHoursFormatted,
        absences,
        lateCount,
        totalExpenses
      },
      records
    }

    if (format === 'json') {
      return NextResponse.json(report)
    }

    // Excel出力
    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()
      
      // データを準備
      const worksheetData = [
        // ヘッダー行
        ...(type === 'submission' 
          ? [['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間']]
          : type === 'submission_with_expenses'
          ? [['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間', '交通費']]
          : [['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '起床報告', '出発報告', '出勤', '退勤', '勤務時間', 'アラート', '経費合計']]
        ),
        // データ行
        ...records.map(record => {
          if (type === 'submission') {
            return [
              record.date,
              record.dayOfWeek,
              record.status,
              record.workplace,
              record.startTime,
              record.endTime,
              record.breakTime || '-',
              record.actualWorkHours || '-'
            ]
          } else if (type === 'submission_with_expenses') {
            return [
              record.date,
              record.dayOfWeek,
              record.status,
              record.workplace,
              record.startTime,
              record.endTime,
              record.breakTime || '-',
              record.actualWorkHours || '-',
              record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
            ]
          } else {
            return [
              record.date,
              record.dayOfWeek,
              record.status,
              record.workplace,
              record.startTime,
              record.endTime,
              record.wakeupReport || '-',
              record.departureReport || '-',
              record.clockIn || '-',
              record.clockOut || '-',
              record.workHours || '-',
              record.alerts?.join(', ') || '-',
              record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
            ]
          }
        })
      ]
      
      // ワークシートを作成
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      XLSX.utils.book_append_sheet(workbook, worksheet, '勤務管理表')
      
      // Excelファイルを生成
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      
      const fileName = `勤務管理表_${user.name}(${user.userId || user.id})_${month}.xlsx`
      
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        }
      })
    }

    // CSV出力
    if (format === 'csv') {
      let csvContent = ''
      
      // ヘッダー行
      if (type === 'submission') {
        csvContent += '日付,曜日,勤怠,勤務地,開始時間,終了時間,休憩時間,実働時間\n'
      } else if (type === 'submission_with_expenses') {
        csvContent += '日付,曜日,勤怠,勤務地,開始時間,終了時間,休憩時間,実働時間,交通費\n'
      } else {
        csvContent += '日付,曜日,勤怠,勤務地,開始時間,終了時間,起床報告,出発報告,出勤,退勤,勤務時間,アラート,経費合計\n'
      }
      
      // データ行
      records.forEach(record => {
        if (type === 'submission') {
          const row = [
            record.date,
            record.dayOfWeek,
            record.status,
            record.workplace,
            record.startTime,
            record.endTime,
            record.breakTime || '-',
            record.actualWorkHours || '-'
          ]
          csvContent += row.map(field => `"${field}"`).join(',') + '\n'
        } else if (type === 'submission_with_expenses') {
          const row = [
            record.date,
            record.dayOfWeek,
            record.status,
            record.workplace,
            record.startTime,
            record.endTime,
            record.breakTime || '-',
            record.actualWorkHours || '-',
            record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
          ]
          csvContent += row.map(field => `"${field}"`).join(',') + '\n'
        } else {
          const row = [
            record.date,
            record.dayOfWeek,
            record.status,
            record.workplace,
            record.startTime,
            record.endTime,
            record.wakeupReport || '-',
            record.departureReport || '-',
            record.clockIn || '-',
            record.clockOut || '-',
            record.workHours || '-',
            record.alerts?.join(', ') || '-',
            record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
          ]
          csvContent += row.map(field => `"${field}"`).join(',') + '\n'
        }
      })
      
      const fileName = `勤務管理表_${user.name}(${user.userId || user.id})_${month}.csv`
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        }
      })
    }

    // PDF出力（Puppeteerを使用してサーバーサイドで生成）
    if (format === 'pdf') {
      try {
        const puppeteer = await import('puppeteer')
        
        // HTMLコンテンツを生成
        const headers = type === 'submission' 
          ? ['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間']
          : type === 'submission_with_expenses'
          ? ['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '休憩時間', '実働時間', '交通費']
          : ['日付', '曜日', '勤怠', '勤務地', '開始時間', '終了時間', '起床報告', '出発報告', '出勤', '退勤', '勤務時間', 'アラート', '経費合計']
        
        let htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>勤務管理表${type === 'full' ? '（全情報表示版）' : type === 'submission_with_expenses' ? '（提出用・交通費含む）' : '（提出用）'}</title>
            <style>
              @page {
                size: A4 ${orientation};
                margin: ${orientation === 'portrait' ? '8mm 14mm 6mm 14mm' : '15mm'};
              }
              body { 
                font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic Medium', 'Meiryo', sans-serif;
                font-size: ${orientation === 'portrait' ? '10px' : '10px'}; 
                margin: 0; 
                padding: 0;
                color: #000;
                line-height: ${orientation === 'portrait' ? '1.2' : '1.3'};
              }
              h1 { 
                font-size: ${orientation === 'portrait' ? '16px' : '16px'}; 
                margin-bottom: ${orientation === 'portrait' ? '6px' : '10px'}; 
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 3px;
              }
              .info { 
                margin-bottom: ${orientation === 'portrait' ? '6px' : '15px'}; 
                display: flex;
                justify-content: space-between;
                background: #f9f9f9;
                padding: ${orientation === 'portrait' ? '4px 6px' : '8px'};
                border: 1px solid #ddd;
                font-size: ${orientation === 'portrait' ? '9px' : '10px'};
              }
              .summary { 
                margin-bottom: ${orientation === 'portrait' ? '6px' : '15px'}; 
                background: #e8f4fd; 
                padding: ${orientation === 'portrait' ? '4px 6px' : '8px'}; 
                border: 1px solid #b0d4f1;
                font-weight: bold;
                text-align: center;
                font-size: ${orientation === 'portrait' ? '9px' : '10px'};
              }
              table { 
                border-collapse: collapse; 
                width: 100%; 
                font-size: ${orientation === 'portrait' ? '9px' : '9px'};
                margin-top: ${orientation === 'portrait' ? '4px' : '10px'};
                margin-bottom: ${orientation === 'portrait' ? '4px' : '0'};
              }
              th, td { 
                border: 1px solid #333; 
                padding: ${orientation === 'portrait' ? '5px 4px' : '3px 2px'}; 
                text-align: center; 
                vertical-align: middle;
                line-height: ${orientation === 'portrait' ? '1.3' : '1.2'};
              }
              th { 
                background-color: #d0d0d0; 
                font-weight: bold; 
                font-size: ${orientation === 'portrait' ? '9px' : '8px'};
                padding: ${orientation === 'portrait' ? '6px 4px' : '3px 2px'};
              }
              td {
                font-size: ${orientation === 'portrait' ? '8.5px' : '8px'};
              }
              .absent { background-color: #ffe6e6; }
              .work { background-color: #e6f3ff; }
              .off { background-color: #f0f0f0; }
            </style>
          </head>
          <body>
            <h1>勤務管理表${type === 'full' ? '（全情報表示版）' : type === 'submission_with_expenses' ? '（提出用・交通費含む）' : '（提出用）'}</h1>
            <div class="info">
              <div>氏名: ${user.name}</div>
              <div>ユーザーID: ${user.userId || user.id}</div>
              <div>対象年月: ${month}</div>
            </div>
            <div class="summary">
              ${type === 'submission' 
                ? `稼働日数: ${workDays}日　|　実働時間: ${totalHoursFormatted}　|　欠勤: ${absences}日`
                : type === 'submission_with_expenses'
                ? `稼働日数: ${workDays}日　|　実働時間: ${totalHoursFormatted}　|　欠勤: ${absences}日　|　交通費: ¥${totalExpenses.toLocaleString()}`
                : `稼働日数: ${workDays}日　|　実働時間: ${totalHoursFormatted}　|　欠勤: ${absences}日　|　遅刻: ${lateCount}回　|　経費: ¥${totalExpenses.toLocaleString()}`
              }
            </div>
            <table>
              <thead>
                <tr>
                  ${headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
        `
        
        records.forEach(record => {
          const statusClass = record.status === '欠勤' ? 'absent' : record.status === '出勤' ? 'work' : 'off'
          const rowData = type === 'submission' 
            ? [
                record.date,
                record.dayOfWeek,
                record.status,
                record.workplace,
                record.startTime,
                record.endTime,
                record.breakTime || '-',
                record.actualWorkHours || '-'
              ]
            : type === 'submission_with_expenses'
            ? [
                record.date,
                record.dayOfWeek,
                record.status,
                record.workplace,
                record.startTime,
                record.endTime,
                record.breakTime || '-',
                record.actualWorkHours || '-',
                record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
              ]
            : [
                record.date,
                record.dayOfWeek,
                record.status,
                record.workplace,
                record.startTime,
                record.endTime,
                record.wakeupReport || '-',
                record.departureReport || '-',
                record.clockIn || '-',
                record.clockOut || '-',
                record.workHours || '-',
                (record.alerts || []).join(', ') || '-',
                record.expenses ? `¥${record.expenses.toLocaleString()}` : '-'
              ]
          
          htmlContent += `<tr class="${statusClass}">` + rowData.map(data => `<td>${data}</td>`).join('') + '</tr>'
        })
        
        htmlContent += `
              </tbody>
            </table>
            ${orientation === 'portrait' ? `
            ` : ''}
          </body>
          </html>
        `
        
        // Puppeteerでページを作成
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        })
        
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
        
        // PDFを生成
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: orientation === 'landscape',
          printBackground: true,
          margin: orientation === 'portrait' ? {
            top: '8mm',
            bottom: '6mm',
            left: '14mm',
            right: '14mm'
          } : {
            top: '15mm',
            bottom: '15mm',
            left: '15mm',
            right: '15mm'
          }
        })
        
        await browser.close()
        
        const fileName = `勤務管理表_${user.name}(${user.userId || user.id})_${month}.pdf`
        
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
          }
        })
        
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        return NextResponse.json({ 
          error: 'PDF生成に失敗しました',
          details: pdfError instanceof Error ? pdfError.message : String(pdfError)
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'サポートされていない形式です' }, { status: 400 })

  } catch (error) {
    console.error('Attendance report error:', error)
    return NextResponse.json({ 
      error: 'レポートの生成に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}