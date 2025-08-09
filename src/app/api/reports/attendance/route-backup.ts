import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { formatJapanDate } from '@/lib/dateUtils'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const month = searchParams.get('month')
    const type = searchParams.get('type') || 'full'
    const format = searchParams.get('format') || 'json'
    const orientation = searchParams.get('orientation') || 'landscape'

    console.log('API Parameters:', { userId, month, type, format })

    if (!userId || !month) {
      return NextResponse.json({ error: 'ユーザーIDと月が必要です' }, { status: 400 })
    }

    const canViewAll = await hasPermission(currentUser.id, 'attendanceManagement', 'viewAll')
    const canViewCompany = await hasPermission(currentUser.id, 'attendanceManagement', 'viewCompany')
    
    // 会社内権限がある場合は同じ会社のユーザーのみ閲覧可能
    if (userId !== currentUser.id && !canViewAll && canViewCompany) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { partnerId: true }
      })
      
      // partnerId同士を比較（nullでも同じ会社として扱う）
      const currentPartnerIdCondition = currentUser.partnerId === undefined ? null : currentUser.partnerId;
      if (targetUser?.partnerId !== currentPartnerIdCondition) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
    } else if (userId !== currentUser.id && !canViewAll && !canViewCompany) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    console.log('Looking for user with ID:', userId)
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        userId: true
      }
    })

    console.log('Found user:', user)

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    const [year, monthNum] = month.split('-').map(Number)
    // 月全体をカバーするために、前月末から翌月初まで広めに検索
    const startDate = new Date(year, monthNum - 1, 1)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(year, monthNum, 1)
    endDate.setHours(23, 59, 59, 999)

    const shifts = await prisma.shift.findMany({
      where: {
        userId: userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    })

    const attendances = await prisma.attendance.findMany({
      where: {
        userId: userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: [{ date: 'asc' }, { clockTime: 'asc' }]
    })

    const expenses = await prisma.expense.findMany({
      where: {
        userId: userId,
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

          // 勤務時間計算
          if (clockOutRecord) {
            // 実労働時間 = (退勤時刻 - 出勤時刻) - 休憩時間
            const clockInTime = new Date(clockInRecord.clockTime)
            const clockOutTime = new Date(clockOutRecord.clockTime)
            const totalMinutes = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60)
            const breakMinutes = shift.breakTime || 0
            const actualWorkMinutes = totalMinutes - breakMinutes
            const workHours = actualWorkMinutes / 60
            
            totalHours += workHours
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
          } else if (date < now && formatJapanDate(now) !== dateString) {
            // 過去の日付で出勤記録がない場合も欠勤
            status = '欠勤'
            alerts.push('AB')
            absences++
            workDays-- // 欠勤の場合は出勤日数から除外
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
      if (shift) {
        // 休憩時間（分を時間:分形式に変換）
        const breakMinutes = shift.breakTime || 0
        const breakHours = Math.floor(breakMinutes / 60)
        const remainingMinutes = breakMinutes % 60
        record.breakTime = `${breakHours}:${remainingMinutes.toString().padStart(2, '0')}`
        
        // 実働時間
        if (clockOutRecord && clockInRecord) {
          const totalMinutes = (new Date(clockOutRecord.clockTime).getTime() - new Date(clockInRecord.clockTime).getTime()) / (1000 * 60)
          const actualWorkMinutes = totalMinutes - breakMinutes
          const hours = Math.floor(actualWorkMinutes / 60)
          const minutes = Math.floor(actualWorkMinutes % 60)
          record.actualWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`
        } else {
          record.actualWorkHours = '-'
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
                margin: 15mm;
              }
              body { 
                font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic Medium', 'Meiryo', sans-serif;
                font-size: 10px; 
                margin: 0; 
                padding: 0;
                color: #000;
              }
              h1 { 
                font-size: 16px; 
                margin-bottom: 10px; 
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 5px;
              }
              .info { 
                margin-bottom: 15px; 
                display: flex;
                justify-content: space-between;
                background: #f9f9f9;
                padding: 8px;
                border: 1px solid #ddd;
              }
              .summary { 
                margin-bottom: 15px; 
                background: #e8f4fd; 
                padding: 8px; 
                border: 1px solid #b0d4f1;
                font-weight: bold;
                text-align: center;
              }
              table { 
                border-collapse: collapse; 
                width: 100%; 
                font-size: 9px;
                margin-top: 10px;
              }
              th, td { 
                border: 1px solid #333; 
                padding: 3px 2px; 
                text-align: center; 
                vertical-align: middle;
              }
              th { 
                background-color: #d0d0d0; 
                font-weight: bold; 
                font-size: 8px;
              }
              td {
                font-size: 8px;
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
          margin: {
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