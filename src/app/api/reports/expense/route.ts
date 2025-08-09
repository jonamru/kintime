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

    console.log('Expense API params:', { month, scope, userId, userIds, partnerId, format, orientation })

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
    const canViewAll = await hasPermission(currentUser.id, 'expenseManagement', 'viewAll')
    
    if (scope === 'all' && !canViewAll) {
      return NextResponse.json({ error: '全員の経費を閲覧する権限がありません' }, { status: 403 })
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
      if (hasOtherUsers && !canViewAll) {
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
      if (!canViewAll) {
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

    console.log(`Found ${users.length} users for expense report`)
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 複数ユーザーの場合の処理
    if (users.length > 1) {
      // 複数ユーザーのExcel出力
      if (format === 'excel') {
        const workbook = XLSX.utils.book_new()
        
        // 各ユーザーごとにシートを作成
        for (const user of users) {
          const expenses = await prisma.expense.findMany({
            where: {
              userId: user.id,
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            orderBy: { date: 'asc' }
          })

          const getDayOfWeek = (date: Date) => {
            const days = ['日', '月', '火', '水', '木', '金', '土']
            return days[date.getDay()]
          }

          const getTypeText = (type: string) => {
            switch (type) {
              case 'TRANSPORT': return '交通費'
              case 'LODGING': return '宿泊費'
              case 'COMMUTE_PASS': return '定期券'
              default: return type
            }
          }

          const worksheetData = [
            [`${user.name}(${user.userId || user.id}) - 経費管理表`],
            [`対象年月: ${month}`],
            [],
            ['日付', '曜日', '種別', '経路', '詳細路線', '金額', '参照URL'],
            ...expenses.map(expense => [
              formatJapanDate(expense.date),
              getDayOfWeek(new Date(expense.date)),
              getTypeText(expense.type),
              `${expense.departure || ''} → ${expense.arrival || ''}`,
              expense.route || '',
              expense.amount,
              expense.referenceUrl || ''
            ])
          ]
          
          const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
          worksheetData.push([])
          worksheetData.push(['合計', '', '', '', '', totalExpenses, ''])

          const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
          const sheetName = `${user.name.substring(0, 10)}` // Excel制限に対応
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
        }
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
        // ファイル名を選択範囲に応じて決定
        let fileName = ''
        if (scope === 'user') {
          fileName = `経費管理表_選択ユーザー_${month}.xlsx`
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
          fileName = `経費管理表_${companyName}_${month}.xlsx`
        } else if (scope === 'all') {
          fileName = `経費管理表_全員_${month}.xlsx`
        } else {
          fileName = `経費管理表_複数ユーザー_${month}.xlsx`
        }
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
          }
        })
      }

      // 複数ユーザーのCSV出力
      if (format === 'csv') {
        const csvData = [
          ['氏名', 'ユーザーID', '日付', '曜日', '種別', '経路', '詳細路線', '金額', '参照URL']
        ]
        
        for (const user of users) {
          const expenses = await prisma.expense.findMany({
            where: {
              userId: user.id,
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            orderBy: { date: 'asc' }
          })

          const getDayOfWeek = (date: Date) => {
            const days = ['日', '月', '火', '水', '木', '金', '土']
            return days[date.getDay()]
          }

          const getTypeText = (type: string) => {
            switch (type) {
              case 'TRANSPORT': return '交通費'
              case 'LODGING': return '宿泊費'
              case 'COMMUTE_PASS': return '定期券'
              default: return type
            }
          }
          
          expenses.forEach(expense => {
            csvData.push([
              user.name,
              user.userId || user.id,
              formatJapanDate(expense.date),
              getDayOfWeek(new Date(expense.date)),
              getTypeText(expense.type),
              `${expense.departure || ''} → ${expense.arrival || ''}`,
              expense.route || '',
              expense.amount,
              expense.referenceUrl || ''
            ])
          })
        }
        
        const csvContent = csvData.map(row => 
          row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n')
        
        const bom = '\uFEFF'
        const csvBuffer = Buffer.from(bom + csvContent, 'utf8')
        // ファイル名を選択範囲に応じて決定
        let fileName = ''
        if (scope === 'user') {
          fileName = `経費管理表_選択ユーザー_${month}.csv`
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
          fileName = `経費管理表_${companyName}_${month}.csv`
        } else if (scope === 'all') {
          fileName = `経費管理表_全員_${month}.csv`
        } else {
          fileName = `経費管理表_複数ユーザー_${month}.csv`
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
          
          let combinedHtmlContent = ''
          
          // 各ユーザーのPDFページを生成
          for (let userIndex = 0; userIndex < users.length; userIndex++) {
            const user = users[userIndex]
            const expenses = await prisma.expense.findMany({
              where: {
                userId: user.id,
                date: {
                  gte: startDate,
                  lte: endDate
                }
              },
              orderBy: { date: 'asc' }
            })

            const getDayOfWeek = (date: Date) => {
              const days = ['日', '月', '火', '水', '木', '金', '土']
              return days[date.getDay()]
            }

            const getTypeText = (type: string) => {
              switch (type) {
                case 'TRANSPORT': return '交通費'
                case 'LODGING': return '宿泊費'
                case 'COMMUTE_PASS': return '定期券'
                default: return type
              }
            }

            const expenseRecords = expenses.map(expense => {
              const date = new Date(expense.date)
              return {
                id: expense.id,
                date: formatJapanDate(date),
                dayOfWeek: getDayOfWeek(date),
                type: getTypeText(expense.type),
                route: `${expense.departure || ''} → ${expense.arrival || ''}`.replace(' → ', ' → '),
                detailedRoute: expense.route || '',
                amount: expense.amount,
                referenceUrl: expense.referenceUrl || '',
                status: expense.status,
                description: expense.description || ''
              }
            })

            const summary = {
              totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
              approvedExpenses: expenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + e.amount, 0),
              pendingExpenses: expenses.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + e.amount, 0),
              rejectedExpenses: expenses.filter(e => e.status === 'REJECTED').reduce((sum, e) => sum + e.amount, 0)
            }

            const pageBreak = userIndex > 0 ? 'page-break-before: always;' : ''
            
            combinedHtmlContent += `
              <div style="${pageBreak}">
                <h1>経費管理表</h1>
                
                <div class="info">
                  <div class="info-item">
                    <span class="info-label">氏名</span>
                    <span class="info-value">${user.name}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">ユーザーID</span>
                    <span class="info-value">${user.userId || user.id}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">対象年月</span>
                    <span class="info-value">${month}</span>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th class="date-col">日付</th>
                      <th class="day-col">曜日</th>
                      <th class="type-col">種別</th>
                      <th class="route-col">経路</th>
                      <th class="detail-col">詳細路線</th>
                      <th class="amount-col right">金額</th>
                      <th class="url-col">参照URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${expenseRecords.map(expense => `
                      <tr>
                        <td class="center">${expense.date}</td>
                        <td class="center">${expense.dayOfWeek}</td>
                        <td class="center">${expense.type}</td>
                        <td>${expense.route}</td>
                        <td>${expense.detailedRoute}</td>
                        <td class="right">¥${expense.amount.toLocaleString()}</td>
                        <td style="word-break: break-all; font-size: 7px;">${expense.referenceUrl || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <div class="summary">
                  合計: ¥${summary.totalExpenses.toLocaleString()}
                </div>
              </div>
            `
          }

          const fullHtmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>経費管理表（複数ユーザー）</title>
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
                .info-item {
                  display: flex;
                  flex-direction: column;
                }
                .info-label {
                  font-weight: bold;
                  margin-bottom: 2px;
                  font-size: 9px;
                  color: #666;
                }
                .info-value {
                  font-size: 11px;
                }
                table { 
                  width: 100%; 
                  border-collapse: collapse; 
                  margin-bottom: 10px;
                  font-size: 8px;
                }
                th, td { 
                  border: 1px solid #333; 
                  padding: 4px; 
                  text-align: left;
                  vertical-align: top;
                }
                th { 
                  background-color: #f0f0f0; 
                  font-weight: bold;
                  text-align: center;
                  font-size: 9px;
                }
                .center { text-align: center; }
                .right { text-align: right; }
                .summary {
                  margin-top: 10px;
                  padding: 8px;
                  background: #f9f9f9;
                  border: 1px solid #ddd;
                  text-align: right;
                  font-weight: bold;
                }
                .date-col { width: 80px; }
                .day-col { width: 30px; }
                .type-col { width: 60px; }
                .route-col { width: 120px; }
                .detail-col { width: 200px; }
                .amount-col { width: 70px; }
                .url-col { width: 120px; }
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
            margin: {
              top: '15mm',
              right: '15mm',
              bottom: '15mm',
              left: '15mm'
            },
            printBackground: true
          })
          
          await browser.close()
          
          // ファイル名を選択範囲に応じて決定
          let fileName = ''
          if (scope === 'user') {
            fileName = `経費管理表_選択ユーザー_${month}.pdf`
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
            fileName = `経費管理表_${companyName}_${month}.pdf`
          } else if (scope === 'all') {
            fileName = `経費管理表_全員_${month}.pdf`
          } else {
            fileName = `経費管理表_複数ユーザー_${month}.pdf`
          }
          
          return new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
            }
          })
          
        } catch (error) {
          console.error('Multiple user PDF generation error:', error)
          return NextResponse.json({ error: 'PDF生成に失敗しました' }, { status: 500 })
        }
      }
    }
    
    // 単一ユーザーの場合は既存のロジックを使用
    const user = users[0]

    const expenses = await prisma.expense.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    })

    const getDayOfWeek = (date: Date) => {
      const days = ['日', '月', '火', '水', '木', '金', '土']
      return days[date.getDay()]
    }

    const getTypeText = (type: string) => {
      switch (type) {
        case 'TRANSPORT': return '交通費'
        case 'LODGING': return '宿泊費'
        case 'COMMUTE_PASS': return '定期券'
        default: return type
      }
    }

    const expenseRecords = expenses.map(expense => {
      const date = new Date(expense.date)
      return {
        id: expense.id,
        date: formatJapanDate(date),
        dayOfWeek: getDayOfWeek(date),
        type: getTypeText(expense.type),
        route: `${expense.departure || ''} → ${expense.arrival || ''}`.replace(' → ', ' → '),
        detailedRoute: expense.route || '',
        amount: expense.amount,
        referenceUrl: expense.referenceUrl || '',
        status: expense.status,
        description: expense.description || ''
      }
    })

    const summary = {
      totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
      approvedExpenses: expenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + e.amount, 0),
      pendingExpenses: expenses.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + e.amount, 0),
      rejectedExpenses: expenses.filter(e => e.status === 'REJECTED').reduce((sum, e) => sum + e.amount, 0)
    }

    const report = {
      user,
      month,
      summary,
      expenses: expenseRecords
    }

    if (format === 'json') {
      return NextResponse.json(report)
    }

    // Excel出力
    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()
      
      const worksheetData = [
        ['経費管理表'],
        ['氏名', user.name],
        ['ユーザーID', user.userId || user.id],
        ['対象年月', month],
        [],
        ['日付', '曜日', '種別', '経路', '詳細路線', '金額', '参照URL']
      ]
      
      expenseRecords.forEach(expense => {
        worksheetData.push([
          expense.date,
          expense.dayOfWeek,
          expense.type,
          expense.route,
          expense.detailedRoute,
          expense.amount,
          expense.referenceUrl
        ])
      })
      
      worksheetData.push([])
      worksheetData.push(['合計', '', '', '', '', summary.totalExpenses, ''])

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      XLSX.utils.book_append_sheet(workbook, worksheet, '経費管理表')
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`経費管理表_${user.name}(${user.userId || user.id})_${month}.xlsx`)}`
        }
      })
    }

    // CSV出力
    if (format === 'csv') {
      const csvData = [
        ['日付', '曜日', '種別', '経路', '詳細路線', '金額', '参照URL'],
        ...expenseRecords.map(expense => [
          expense.date,
          expense.dayOfWeek,
          expense.type,
          expense.route,
          expense.detailedRoute,
          expense.amount,
          expense.referenceUrl
        ])
      ]
      
      const csvContent = csvData.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
      ).join('\n')
      
      const bom = '\uFEFF'
      const csvBuffer = Buffer.from(bom + csvContent, 'utf8')
      
      return new NextResponse(csvBuffer, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`経費管理表_${user.name}(${user.userId || user.id})_${month}.csv`)}`
        }
      })
    }

    // PDF出力（Puppeteerを使用してサーバーサイドで生成）
    if (format === 'pdf') {
      try {
        const puppeteer = await import('puppeteer')
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>経費管理表</title>
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
              .info-item {
                display: flex;
                flex-direction: column;
              }
              .info-label {
                font-weight: bold;
                margin-bottom: 2px;
                font-size: 9px;
                color: #666;
              }
              .info-value {
                font-size: 11px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 10px;
                font-size: 8px;
              }
              th, td { 
                border: 1px solid #333; 
                padding: 4px; 
                text-align: left;
                vertical-align: top;
              }
              th { 
                background-color: #f0f0f0; 
                font-weight: bold;
                text-align: center;
                font-size: 9px;
              }
              .center { text-align: center; }
              .right { text-align: right; }
              .summary {
                margin-top: 10px;
                padding: 8px;
                background: #f9f9f9;
                border: 1px solid #ddd;
                text-align: right;
                font-weight: bold;
              }
              .date-col { width: 80px; }
              .day-col { width: 30px; }
              .type-col { width: 60px; }
              .route-col { width: 120px; }
              .detail-col { width: 200px; }
              .amount-col { width: 70px; }
              .url-col { width: 120px; }
            </style>
          </head>
          <body>
            <h1>経費管理表</h1>
            
            <div class="info">
              <div class="info-item">
                <span class="info-label">氏名</span>
                <span class="info-value">${user.name}</span>
              </div>
              <div class="info-item">
                <span class="info-label">ユーザーID</span>
                <span class="info-value">${user.userId || user.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">対象年月</span>
                <span class="info-value">${month}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="date-col">日付</th>
                  <th class="day-col">曜日</th>
                  <th class="type-col">種別</th>
                  <th class="route-col">経路</th>
                  <th class="detail-col">詳細路線</th>
                  <th class="amount-col right">金額</th>
                  <th class="url-col">参照URL</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRecords.map(expense => `
                  <tr>
                    <td class="center">${expense.date}</td>
                    <td class="center">${expense.dayOfWeek}</td>
                    <td class="center">${expense.type}</td>
                    <td>${expense.route}</td>
                    <td>${expense.detailedRoute}</td>
                    <td class="right">¥${expense.amount.toLocaleString()}</td>
                    <td style="word-break: break-all; font-size: 7px;">${expense.referenceUrl || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="summary">
              合計: ¥${summary.totalExpenses.toLocaleString()}
            </div>
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
            top: '15mm',
            right: '15mm',
            bottom: '15mm',
            left: '15mm'
          },
          printBackground: true
        })
        
        await browser.close()
        
        const fileName = `経費管理表_${user.name}(${user.userId || user.id})_${month}.pdf`
        
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
    console.error('Expense report error:', error)
    return NextResponse.json({ error: 'レポートの生成に失敗しました' }, { status: 500 })
  }
}