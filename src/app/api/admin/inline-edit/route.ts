import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { type, recordId, field, value } = body;

    console.log('インライン編集API:', { type, recordId, field, value });

    // 権限チェック
    let hasEditPermission = false;
    switch (type) {
      case 'attendance':
        hasEditPermission = await hasPermission(currentUser.id, "attendanceManagement", "editOthers");
        break;
      case 'shift':
        hasEditPermission = await hasPermission(currentUser.id, "shiftManagement", "edit");
        break;
      case 'expense':
        hasEditPermission = await hasPermission(currentUser.id, "expenseManagement", "viewAll");
        break;
    }

    if (!hasEditPermission) {
      return NextResponse.json({ error: "編集権限がありません" }, { status: 403 });
    }

    // 値の処理
    let processedValue = value;
    if (field === 'date' && typeof value === 'string') {
      const [year, month, day] = value.split('-').map(Number);
      processedValue = new Date(year, month - 1, day);
    } else if ((field === 'startTime' || field === 'endTime') && typeof value === 'string') {
      const [hours, minutes] = value.split(':').map(Number);
      // 元のレコードの日付を使用
      let originalDate = new Date();
      if (type === 'shift') {
        const originalRecord = await prisma.shift.findUnique({ where: { id: recordId } });
        if (originalRecord) {
          originalDate = originalRecord.date;
        }
      }
      processedValue = new Date(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate(), hours, minutes);
    } else if ((field === 'clockIn' || field === 'clockOut' || field === 'wakeUp' || field === 'departure') && typeof value === 'string') {
      const [hours, minutes] = value.split(':').map(Number);
      // 仮想レコードIDから日付を取得
      let targetDate = new Date();
      if (recordId.startsWith('daily-')) {
        const parts = recordId.split('-');
        if (parts.length >= 5) {
          const dateStr = `${parts[1]}-${parts[2]}-${parts[3]}`;
          targetDate = new Date(dateStr);
        }
      }
      processedValue = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes);
    }

    // データベース更新
    let result;
    switch (type) {
      case 'attendance':
        if (field === 'clockIn' || field === 'clockOut' || field === 'wakeUp' || field === 'departure') {
          // 勤怠データの場合、実際のAttendanceレコードIDを取得する必要がある
          let actualAttendanceId = recordId;
          
          // 仮想レコードID（daily-で始まる）の場合は、該当する打刻記録を検索
          if (recordId.startsWith('daily-')) {
            console.log('仮想レコードから実際の打刻記録を検索:', { recordId, field });
            
            // recordIdから日付とユーザーIDを抽出 (daily-YYYY-MM-DD-userId形式)
            const parts = recordId.split('-');
            if (parts.length >= 5) {
              const dateStr = `${parts[1]}-${parts[2]}-${parts[3]}`;
              const userId = parts[4];
              
              // その日の該当する打刻記録を検索
              const targetDate = new Date(dateStr);
              const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
              const endOfDay = new Date(startOfDay);
              endOfDay.setDate(endOfDay.getDate() + 1);
              
              let targetType;
              switch (field) {
                case 'clockIn':
                  targetType = 'CLOCK_IN';
                  break;
                case 'clockOut':
                  targetType = 'CLOCK_OUT';
                  break;
                case 'wakeUp':
                  targetType = 'WAKE_UP';
                  break;
                case 'departure':
                  targetType = 'DEPARTURE';
                  break;
                default:
                  return NextResponse.json({ error: "無効なフィールド" }, { status: 400 });
              }
              
              const existingRecord = await prisma.attendance.findFirst({
                where: {
                  userId: userId,
                  type: targetType,
                  date: {
                    gte: startOfDay,
                    lt: endOfDay,
                  },
                },
              });
              
              if (existingRecord) {
                actualAttendanceId = existingRecord.id;
                console.log('既存の打刻記録を発見:', actualAttendanceId);
              } else {
                // 該当する打刻記録がない場合は新規作成
                console.log('新規打刻記録を作成');
                const newRecord = await prisma.attendance.create({
                  data: {
                    userId: userId,
                    type: targetType,
                    date: startOfDay,
                    clockTime: processedValue,
                  },
                });
                
                return NextResponse.json({ 
                  success: true, 
                  message: "新規打刻記録を作成しました",
                  result: newRecord
                });
              }
            } else {
              return NextResponse.json({ error: "無効なレコードID形式です" }, { status: 400 });
            }
          }
          
          // 既存の打刻記録を更新
          const originalRecord = await prisma.attendance.findUnique({ where: { id: actualAttendanceId } });
          if (!originalRecord) {
            return NextResponse.json({ error: "打刻記録が見つかりません" }, { status: 404 });
          }

          // 修正記録を作成
          await prisma.correction.create({
            data: {
              attendanceId: actualAttendanceId,
              oldTime: originalRecord.clockTime,
              newTime: processedValue,
              reason: "一括修正管理による編集",
              status: "APPROVED",
              approvedBy: currentUser.id,
            },
          });

          // 打刻記録を更新
          result = await prisma.attendance.update({
            where: { id: actualAttendanceId },
            data: { clockTime: processedValue },
          });
        } else {
          result = await prisma.attendance.update({
            where: { id: recordId },
            data: { [field]: processedValue },
          });
        }
        break;

      case 'shift':
        result = await prisma.shift.update({
          where: { id: recordId },
          data: { [field]: processedValue },
        });
        break;

      case 'expense':
        // expenseの場合、フィールド名をマッピング
        const expenseFieldMapping = {
          'category': 'type',
          'amount': 'amount',
          'description': 'description',
          'date': 'date'
        };
        const dbField = expenseFieldMapping[field as keyof typeof expenseFieldMapping] || field;
        
        result = await prisma.expense.update({
          where: { id: recordId },
          data: { [dbField]: processedValue },
        });
        break;

      default:
        return NextResponse.json({ error: "不正なタイプ" }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "更新しました",
      result 
    });

  } catch (error) {
    console.error("インライン編集エラー:", error);
    return NextResponse.json(
      { 
        error: "更新に失敗しました", 
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}