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
    const month = searchParams.get('month')
    const scope = searchParams.get('scope') || 'user'
    const userId = searchParams.get('userId')
    const userIds = searchParams.getAll('userIds')
    const partnerId = searchParams.get('partnerId')
    const format = searchParams.get('format') || 'json'
    const orientation = searchParams.get('orientation') || 'landscape'
    const showLocation = searchParams.get('showLocation') === 'true'

    console.log('Shift API params:', { month, scope, userId, userIds, partnerId, format, orientation, showLocation })

    if (!month) {
      return NextResponse.json({ error: '対象年月が必要です' }, { status: 400 })
    }

    if (scope === 'user' && (!userId && userIds.length === 0)) {
      return NextResponse.json({ error: 'ユーザー選択時はユーザーIDが必要です' }, { status: 400 })
    }

    if (scope === 'company' && !partnerId) {
      return NextResponse.json({ error: '会社選択時は会社IDが必要です' }, { status: 400 })
    }

    // 権限チェック
    const canViewAll = await hasPermission(currentUser.id, 'shiftManagement', 'viewAll')
    const canViewCompany = await hasPermission(currentUser.id, 'shiftManagement', 'view')
    
    if (scope === 'all' && !canViewAll) {
      return NextResponse.json({ error: '全員のシフトを閲覧する権限がありません' }, { status: 403 })
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
          defaultLocation: true,
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
          defaultLocation: true,
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
          defaultLocation: true,
          partner: {
            select: { name: true }
          }
        },
        orderBy: [{ partnerId: 'asc' }, { name: 'asc' }]
      })
    }

    // シフトデータを取得
    const targetUserIds = users.map(u => u.id)
    const shifts = await prisma.shift.findMany({
      where: {
        userId: { in: targetUserIds },
        date: {
          gte: startDate,
          lte: endDate
        },
        status: 'APPROVED'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      }
    })

    // 月の全日付を生成
    const daysInMonth = endDate.getDate()
    const dates = []
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day)
      dates.push({
        date: formatJapanDate(date),
        day: day,
        dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
      })
    }

    // シフトデータを整理
    const shiftData = users.map(user => {
      const userShifts = shifts.filter(s => s.userId === user.id)
      const dailyShifts = dates.map(dateInfo => {
        const dayShift = userShifts.find(s => formatJapanDate(s.date) === dateInfo.date)
        return {
          ...dateInfo,
          shift: dayShift ? {
            startTime: new Date(dayShift.startTime).toLocaleTimeString('ja-JP', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Asia/Tokyo' 
            }),
            endTime: new Date(dayShift.endTime).toLocaleTimeString('ja-JP', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Asia/Tokyo' 
            }),
            location: dayShift.location,
            shiftType: dayShift.shiftType
          } : null
        }
      })

      return {
        user: {
          id: user.id,
          name: user.name,
          userId: user.userId || user.id,
          company: user.partner?.name || '自社',
          workLocation: user.defaultLocation || '未設定'
        },
        shifts: dailyShifts
      }
    })

    // スコープ表示用のテキストを生成
    const getScopeDisplayText = () => {
      switch (scope) {
        case 'user': return '選択ユーザー'
        case 'company': {
          const companyName = users.length > 0 ? users[0].partner?.name : null
          return companyName || '自社'
        }
        case 'all': return '全員'
        default: return scope
      }
    }

    const report = {
      month,
      scope,
      scopeDisplayText: getScopeDisplayText(),
      dates,
      data: shiftData
    }

    if (format === 'json') {
      return NextResponse.json(report)
    }

    // 土日判定関数
    const isWeekend = (dayOfWeek: string) => {
      return dayOfWeek === '土' || dayOfWeek === '日'
    }

    // Excel出力
    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()
      
      // ヘッダー行を作成
      const headerRow = ['氏名', '稼働先', ...dates.map(d => `${d.day}日(${d.dayOfWeek})`)]
      
      const worksheetData = [
        [`シフト表 - ${month}`],
        [`対象: ${getScopeDisplayText()}`],
        [],
        headerRow,
        ...shiftData.map(userData => [
          `${userData.user.name}(${userData.user.userId})`,
          userData.user.workLocation,
          ...userData.shifts.map(dayShift => {
            if (dayShift.shift) {
              return showLocation ? `${dayShift.shift.startTime}\n${dayShift.shift.location}` : dayShift.shift.startTime
            }
            return '公休'
          })
        ])
      ]

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      
      // 土日のセルに色を付ける
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      
      // ヘッダー行の土日セルに色付け（4行目がヘッダー）
      dates.forEach((dateInfo, index) => {
        if (isWeekend(dateInfo.dayOfWeek)) {
          const col = index + 2 // 氏名、稼働先の次から
          const headerCell = XLSX.utils.encode_cell({ r: 3, c: col }) // 4行目（0ベース）
          if (worksheet[headerCell]) {
            worksheet[headerCell].s = {
              fill: { fgColor: { rgb: "FFCCCC" } },
              font: { color: { rgb: "CC0000" } }
            }
          }
        }
      })
      
      // データ行の土日セルに色付け
      shiftData.forEach((userData, userIndex) => {
        userData.shifts.forEach((dayShift, dayIndex) => {
          if (isWeekend(dayShift.dayOfWeek)) {
            const row = userIndex + 4 // ヘッダー行の次から
            const col = dayIndex + 2
            const cell = XLSX.utils.encode_cell({ r: row, c: col })
            if (worksheet[cell]) {
              worksheet[cell].s = {
                fill: { fgColor: { rgb: "FFF0F0" } }
              }
            }
          }
        })
      })
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'シフト表')
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      
      const fileName = `シフト表_${getScopeDisplayText()}_${month}.xlsx`
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        }
      })
    }

    // CSV出力
    if (format === 'csv') {
      const headerRow = ['氏名', '稼働先', ...dates.map(d => `${d.day}日(${d.dayOfWeek})`)]
      
      const csvData = [
        headerRow,
        ...shiftData.map(userData => [
          `${userData.user.name}(${userData.user.userId})`,
          userData.user.workLocation,
          ...userData.shifts.map(dayShift => {
            if (dayShift.shift) {
              return showLocation ? `${dayShift.shift.startTime}\n${dayShift.shift.location}` : dayShift.shift.startTime
            }
            return '公休'
          })
        ])
      ]
      
      const csvContent = csvData.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
      ).join('\n')
      
      const bom = '\uFEFF'
      const csvBuffer = Buffer.from(bom + csvContent, 'utf8')
      
      const fileName = `シフト表_${getScopeDisplayText()}_${month}.csv`
      
      return new NextResponse(csvBuffer, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        }
      })
    }

    // PDF出力（Puppeteerを使用）
    if (format === 'pdf') {
      try {
        const puppeteer = await import('puppeteer')
        
        // 縦向きの場合、ユーザー列幅を計算（A4縦向き: 約560px有効幅）
        const userColumnCount = shiftData.length
        const availableWidthPortrait = 560 - 80 // 80px for date column
        const userColumnWidth = userColumnCount > 0 ? Math.max(40, Math.floor(availableWidthPortrait / userColumnCount)) : 40
        
        // 横向きの場合、日付列幅を計算（A4横向き: 約1120px有効幅）
        const dateColumnCount = dates.length
        const availableWidthLandscape = 1120 - 120 - 80 // 120px for name, 80px for company
        const dateColumnWidth = dateColumnCount > 0 ? Math.max(20, Math.floor(availableWidthLandscape / dateColumnCount)) : 20

        const htmlContent = orientation === 'portrait' ? `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>シフト表</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 5mm;
              }
              body { 
                font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic Medium', 'Meiryo', sans-serif;
                font-size: 12px; 
                margin: 0; 
                padding: 0;
                color: #000;
                line-height: 1.4;
                height: 100vh;
                display: flex;
                flex-direction: column;
              }
              h1 { 
                font-size: 18px; 
                margin-bottom: 8px; 
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 5px;
              }
              .info { 
                margin-bottom: 10px; 
                text-align: center;
                font-size: 14px;
              }
              table { 
                border-collapse: collapse; 
                width: 560px; 
                font-size: 10px;
                margin-top: 5px;
                flex-grow: 1;
                table-layout: fixed;
              }
              th, td { 
                border: 1px solid #333; 
                padding: 5px 3px; 
                text-align: center; 
                vertical-align: middle;
                line-height: 1.3;
              }
              th { 
                background-color: #f0f0f0; 
                font-weight: bold; 
                font-size: 10px;
                height: 50px;
              }
              th.weekend { 
                background-color: #ffcccc; 
                color: #cc0000;
              }
              td {
                font-size: 9px;
                min-height: 25px;
                writing-mode: horizontal-tb;
                height: auto;
              }
              td.weekend {
                background-color: #fff0f0;
              }
              .date-col { 
                width: 80px !important; 
                writing-mode: horizontal-tb;
                font-weight: bold;
                font-size: 10px;
              }
              .user-col { 
                writing-mode: horizontal-tb;
                font-size: 11px;
                font-weight: bold;
                width: ${userColumnWidth}px !important;
                max-width: ${userColumnWidth}px !important;
                min-width: ${userColumnWidth}px !important;
              }
            </style>
          </head>
          <body>
            <h1>シフト表</h1>
            
            <div class="info">
              対象年月: ${month} | 対象: ${getScopeDisplayText()}
            </div>

            <table>
              <thead>
                <tr>
                  <th class="date-col">日付</th>
                  ${shiftData.map(userData => `<th class="user-col" style="font-size: 12px;"><div style="font-weight: bold; font-size: 13px;">${userData.user.name}</div><div style="font-size: 10px;">(${userData.user.userId})</div><div style="font-size: 9px;">${userData.user.workLocation}</div></th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${dates.map(dateInfo => `
                  <tr>
                    <td class="date-col ${isWeekend(dateInfo.dayOfWeek) ? 'weekend' : ''}">${dateInfo.day}日(${dateInfo.dayOfWeek})</td>
                    ${shiftData.map(userData => {
                      const dayShift = userData.shifts.find(s => s.day === dateInfo.day)
                      let content = ''
                      if (dayShift && dayShift.shift) {
                        content = showLocation ? 
                          `${dayShift.shift.startTime}<br/><span style="font-size: 9px; color: #666;">${dayShift.shift.location}</span>` : 
                          dayShift.shift.startTime
                      } else {
                        content = '<span style="font-size: 10px; color: #999;">公休</span>'
                      }
                      return `<td class="user-col ${isWeekend(dateInfo.dayOfWeek) ? 'weekend' : ''}" style="font-size: 12px; font-weight: bold;">${content}</td>`
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
          </html>
        ` : `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>シフト表</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 10mm;
              }
              body { 
                font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic Medium', 'Meiryo', sans-serif;
                font-size: 10px; 
                margin: 0; 
                padding: 0;
                color: #000;
                line-height: 1.3;
              }
              h1 { 
                font-size: 16px; 
                margin-bottom: 8px; 
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 5px;
              }
              .info { 
                margin-bottom: 10px; 
                text-align: center;
                font-size: 12px;
              }
              table { 
                border-collapse: collapse; 
                width: 1120px; 
                font-size: 8px;
                margin-top: 5px;
                table-layout: fixed;
              }
              th, td { 
                border: 1px solid #333; 
                padding: 4px 2px; 
                text-align: center; 
                vertical-align: middle;
                line-height: 1.2;
              }
              th { 
                background-color: #f0f0f0; 
                font-weight: bold; 
                font-size: 8px;
                writing-mode: horizontal-tb;
              }
              td {
                font-size: 7px;
                min-height: 18px;
              }
              th.weekend { 
                background-color: #ffcccc; 
                color: #cc0000;
              }
              td.weekend {
                background-color: #fff0f0;
              }
              .name-col { 
                width: 120px !important; 
                max-width: 120px !important;
                min-width: 120px !important;
                writing-mode: horizontal-tb;
                font-weight: bold;
                font-size: 9px;
                line-height: 1.3;
              }
              .company-col { 
                width: 80px !important; 
                max-width: 80px !important;
                min-width: 80px !important;
                writing-mode: horizontal-tb;
                font-size: 8px;
                line-height: 1.2;
              }
              .day-col { 
                width: ${dateColumnWidth}px !important; 
                max-width: ${dateColumnWidth}px !important;
                min-width: ${dateColumnWidth}px !important;
                font-size: 9px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <h1>シフト表</h1>
            
            <div class="info">
              対象年月: ${month} | 対象: ${getScopeDisplayText()}
            </div>

            <table>
              <thead>
                <tr>
                  <th class="name-col">氏名</th>
                  <th class="company-col">稼働先</th>
                  ${dates.map(d => `<th class="day-col ${isWeekend(d.dayOfWeek) ? 'weekend' : ''}">${d.day}<br/>${d.dayOfWeek}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${shiftData.map(userData => `
                  <tr>
                    <td class="name-col">${userData.user.name}<br/>(${userData.user.userId})<br/>${userData.user.company}</td>
                    <td class="company-col">${userData.user.workLocation}</td>
                    ${userData.shifts.map(dayShift => {
                      let content = ''
                      if (dayShift.shift) {
                        content = showLocation ? 
                          `${dayShift.shift.startTime}<br/><span style="font-size: 7px; color: #666;">${dayShift.shift.location}</span>` : 
                          dayShift.shift.startTime
                      } else {
                        content = '<span style="font-size: 8px; color: #999;">公休</span>'
                      }
                      return `<td class="day-col ${isWeekend(dayShift.dayOfWeek) ? 'weekend' : ''}">${content}</td>`
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
          </html>
        `

        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        })
        
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
        
        const pdf = await page.pdf({
          format: 'A4',
          landscape: orientation === 'landscape',
          margin: {
            top: '10mm',
            right: '10mm',
            bottom: '10mm',
            left: '10mm'
          },
          printBackground: true
        })
        
        await browser.close()
        
        const fileName = `シフト表_${getScopeDisplayText()}_${month}.pdf`
        
        return new NextResponse(pdf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
          }
        })
      } catch (error) {
        console.error('PDF generation error:', error)
        return NextResponse.json({ error: 'PDF生成に失敗しました' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'サポートされていない形式です' }, { status: 400 })

  } catch (error) {
    console.error('Shift report error:', error)
    return NextResponse.json({ error: 'シフト表の生成に失敗しました' }, { status: 500 })
  }
}