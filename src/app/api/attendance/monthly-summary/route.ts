import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getJapanTodayString, getJapanDayRange, getJapanMonthRange, getJapanNow, formatJapanDate } from "@/lib/dateUtils";

export async function GET(request: Request) {
  try {
    console.log("月次サマリーAPI開始");
    
    // URLパラメータから情報を取得
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const getBulkData = url.searchParams.get('bulk') === 'true';
    
    console.log('URLパラメータ:', { userId, year, month, getBulkData });
    
    // まずは簡単なレスポンステスト
    const testMode = request.url.includes('test=true');
    if (testMode) {
      console.log("テストモードで実行");
      return NextResponse.json({
        totalWorkHours: "40:30",
        workDays: 20,
        lateCount: 2,
        year: 2025,
        month: 7,
        testMode: true
      });
    }
    
    // 認証をテスト
    let currentUser;
    try {
      currentUser = await getCurrentUser(request as any);
      console.log("現在のユーザー:", currentUser?.id);
    } catch (authError) {
      console.error("認証エラー:", authError);
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 対象ユーザーを決定（一括修正の場合は指定ユーザー、それ以外は現在ユーザー）
    const targetUserId = userId || currentUser.id;

    // 対象期間を決定
    let targetYear, targetMonth;
    if (year && month) {
      targetYear = parseInt(year);
      targetMonth = parseInt(month);
    } else {
      const now = getJapanNow();
      targetYear = now.getFullYear();  
      targetMonth = now.getMonth() + 1;
    }
    
    // 日本時間で月の開始・終了を取得
    const { startOfMonth, endOfMonth } = getJapanMonthRange(targetYear, targetMonth);

    console.log(`月次サマリー取得: ${targetYear}年${targetMonth}月 (${startOfMonth.toISOString()} - ${endOfMonth.toISOString()})`);

    // 一括修正データが要求された場合は詳細な勤怠記録を返す
    if (getBulkData) {
      console.log('一括修正データを取得中...');
      
      try {
        const attendanceRecords = await prisma.attendance.findMany({
          where: {
            userId: targetUserId,
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                userId: true,
                email: true,
              },
            },
          },
          orderBy: {
            date: 'asc',
          },
        });

        console.log(`一括修正用勤怠記録取得完了: ${attendanceRecords.length}件`);
        console.log('最初のレコード:', attendanceRecords[0]);
        
        // シフト登録されている日を取得
        const shiftsInMonth = await prisma.shift.findMany({
          where: {
            userId: targetUserId,
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
            status: 'APPROVED'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                userId: true,
                email: true,
              },
            },
          },
        });

        console.log(`シフト登録日数: ${shiftsInMonth.length}件`);

        // 日付ごとにグループ化して出勤・退勤をペアにする
        const dailyRecordsMap = new Map();
        
        // まずシフト登録されている日をベースにレコードを作成
        for (const shift of shiftsInMonth) {
          const dateString = formatJapanDate(shift.date);
          
          if (!dailyRecordsMap.has(dateString)) {
            dailyRecordsMap.set(dateString, {
              id: `daily-${dateString}-${targetUserId}`,
              date: shift.date,
              clockIn: null,
              clockOut: null,
              wakeUp: null,
              departure: null,
              clockInId: null,
              clockOutId: null,
              wakeUpId: null,
              departureId: null,
              type: 'DAILY_RECORD',
              user: shift.user
            });
          }
        }
        
        // 既存の勤怠記録を追加
        for (const record of attendanceRecords) {
          const dateString = formatJapanDate(record.date);
          
          if (!dailyRecordsMap.has(dateString)) {
            dailyRecordsMap.set(dateString, {
              id: `daily-${dateString}-${targetUserId}`,
              date: record.date,
              clockIn: null,
              clockOut: null,
              wakeUp: null,
              departure: null,
              clockInId: null,
              clockOutId: null,
              wakeUpId: null,
              departureId: null,
              type: 'DAILY_RECORD',
              user: record.user
            });
          }
          
          const dailyRecord = dailyRecordsMap.get(dateString);
          
          if (record.type === 'CLOCK_IN') {
            dailyRecord.clockIn = record.clockTime;
            dailyRecord.clockInId = record.id; // 実際のAttendanceレコードID
          } else if (record.type === 'CLOCK_OUT') {
            dailyRecord.clockOut = record.clockTime;
            dailyRecord.clockOutId = record.id; // 実際のAttendanceレコードID
          } else if (record.type === 'WAKE_UP') {
            dailyRecord.wakeUp = record.clockTime;
            dailyRecord.wakeUpId = record.id; // 実際のAttendanceレコードID
          } else if (record.type === 'DEPARTURE') {
            dailyRecord.departure = record.clockTime;
            dailyRecord.departureId = record.id; // 実際のAttendanceレコードID
          }
        }
        
        const bulkEditData = Array.from(dailyRecordsMap.values()).sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        console.log(`一括修正用データ生成完了: ${bulkEditData.length}件`);
        
        return NextResponse.json(bulkEditData);
        
      } catch (error) {
        console.error('一括修正データ取得エラー:', error);
        return NextResponse.json({ error: '一括修正データの取得に失敗しました' }, { status: 500 });
      }
    }

    // デフォルト値を準備
    const defaultSummary = {
      totalWorkHours: "0:00",
      workDays: 0,
      lateCount: 0,
      absentDays: 0,
      scheduledWorkDays: 0,
      year: targetYear,
      month: targetMonth,
    };

    // Prismaクライアント確認
    console.log("Prismaクライアント確認:", !!prisma);
    if (!prisma) {
      console.error("Prismaクライアントが初期化されていません");
      return NextResponse.json({
        ...defaultSummary,
        error: "Prismaクライアントエラー"
      });
    }

    // データベース接続テスト
    try {
      console.log("データベース接続テスト...");
      const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
      console.log("接続テスト結果:", testQuery);
    } catch (connectionError) {
      console.error("データベース接続テストエラー:", connectionError);
      return NextResponse.json({
        ...defaultSummary,
        error: "データベース接続エラー"
      });
    }

    // 今月の勤怠記録を取得
    console.log("勤怠記録取得開始...");
    let attendanceRecords = [];
    
    try {
      attendanceRecords = await prisma.attendance.findMany({
        where: {
          userId: targetUserId,
          clockTime: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        orderBy: {
          clockTime: 'asc',
        },
      });
      console.log(`見つかった勤怠記録数: ${attendanceRecords.length}`);
    } catch (dbError) {
      console.error("勤怠記録取得エラー:", dbError);
      return NextResponse.json({
        ...defaultSummary,
        error: "勤怠記録取得エラー"
      });
    }

    let totalWorkMinutes = 0;
    let workDays = 0;
    let lateCount = 0;
    let absentDays = 0;
    let scheduledWorkDays = 0;

    console.log("勤怠記録処理開始...");
    
    // 日付ごとにグループ化して出勤・退勤をペアにする
    const dailyRecords = new Map();
    
    for (const record of attendanceRecords) {
      try {
        const dateString = formatJapanDate(record.date);
        
        if (!dailyRecords.has(dateString)) {
          dailyRecords.set(dateString, { clockIn: null, clockOut: null, date: record.date });
        }
        
        const dailyRecord = dailyRecords.get(dateString);
        
        if (record.type === 'CLOCK_IN') {
          dailyRecord.clockIn = record;
        } else if (record.type === 'CLOCK_OUT') {
          dailyRecord.clockOut = record;
        }
        
        console.log(`記録処理: 日付=${dateString}, タイプ=${record.type}, 時刻=${record.clockTime}`);
      } catch (recordError) {
        console.error("個別記録処理エラー:", recordError, record);
      }
    }
    
    console.log(`日別記録数: ${dailyRecords.size}`);
    
    // 該当月のシフト情報を一括取得（N+1問題を回避）
    const shiftsInMonth = await prisma.shift.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: 'APPROVED'
      }
    });

    // シフト情報を日付ベースでマップ化
    const shiftsByDate = new Map();
    shiftsInMonth.forEach(shift => {
      const dateKey = formatJapanDate(shift.date);
      shiftsByDate.set(dateKey, shift);
    });

    // 各日の労働時間を計算
    for (const [dateString, daily] of dailyRecords) {
      try {
        if (daily.clockIn && daily.clockOut) {
          workDays++;
          
          // 労働時間計算
          const clockInTime = new Date(daily.clockIn.clockTime);
          const clockOutTime = new Date(daily.clockOut.clockTime);
          const workMinutes = Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60));
          
          // 事前にマップ化されたシフト情報を取得
          const shift = shiftsByDate.get(dateString);
          
          // 休憩時間を取得（デフォルト60分）
          const breakMinutes = shift?.breakTime || 60;
          const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
          totalWorkMinutes += actualWorkMinutes;
          
          console.log(`日別計算: ${dateString}, 出勤=${clockInTime.toLocaleTimeString('ja-JP')}, 退勤=${clockOutTime.toLocaleTimeString('ja-JP')}, 労働分=${actualWorkMinutes}, 休憩分=${breakMinutes}`);

          // 遅刻チェック - シフト情報を使用して正確に判定
          if (shift && shift.startTime) {
            const shiftStartTime = new Date(shift.startTime);
            if (clockInTime > shiftStartTime) {
              lateCount++;
              console.log(`遅刻判定: 出勤時刻=${clockInTime.toLocaleTimeString('ja-JP')}, シフト開始=${shiftStartTime.toLocaleTimeString('ja-JP')}`);
            } else {
              console.log(`正常出勤: 出勤時刻=${clockInTime.toLocaleTimeString('ja-JP')}, シフト開始=${shiftStartTime.toLocaleTimeString('ja-JP')}`);
            }
          } else {
            console.log(`シフト情報なし: ${dateString} - 遅刻判定をスキップ`);
          }
        }
      } catch (dailyError) {
        console.error("日別計算エラー:", dailyError, daily);
      }
    }
    
    console.log("欠勤日数計算開始...");
    
    // 今月のシフト日で出勤していない日を欠勤として計算（既に取得済みのシフトを使用）
    try {
      console.log(`シフトクエリ期間: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);
      
      const approvedShifts = shiftsInMonth; // 既に取得済みのデータを再利用
      
      console.log(`今月の承認済みシフト数: ${approvedShifts.length}`);
      scheduledWorkDays = approvedShifts.length;
      
      // 欠勤判定ロジック（日本時間基準）
      const currentTime = getJapanNow();
      const todayString = getJapanTodayString();
      
      console.log(`欠勤判定開始 - 現在時刻: ${currentTime.toLocaleString('ja-JP')}, 今日: ${todayString}`);
      
      for (const shift of approvedShifts) {
        const shiftDateString = formatJapanDate(shift.date);
        const shiftDate = shift.date;
        const dailyRecord = dailyRecords.get(shiftDateString);
        
        console.log(`\n=== シフト判定 ===`);
        console.log(`シフト日: ${shiftDateString}`);
        console.log(`シフト時間: ${new Date(shift.startTime).toLocaleTimeString('ja-JP')} - ${new Date(shift.endTime).toLocaleTimeString('ja-JP')}`);
        console.log(`勤怠記録: ${dailyRecord ? '有り' : '無し'}`);
        if (dailyRecord) {
          console.log(`出勤記録: ${dailyRecord.clockIn ? dailyRecord.clockIn.clockTime : '無し'}`);
          console.log(`退勤記録: ${dailyRecord.clockOut ? dailyRecord.clockOut.clockTime : '無し'}`);
        }
        
        // 未来の日は欠勤判定しない（日本時間基準で比較）
        if (shiftDateString > todayString) {
          console.log(`➜ 判定結果: 未来日のためスキップ`);
          continue;
        }
        
        // 当日の場合は特別な判定
        if (shiftDateString === todayString) {
          // シフト終了時刻から1時間後を計算
          const shiftEndTime = new Date(shift.endTime);
          const absenceThreshold = new Date(shiftEndTime.getTime() + 60 * 60 * 1000); // 1時間後
          
          console.log(`当日判定 - シフト終了: ${shiftEndTime.toLocaleTimeString('ja-JP')}, 欠勤判定時刻: ${absenceThreshold.toLocaleTimeString('ja-JP')}`);
          
          // まだ判定時刻に達していない場合はスキップ
          if (currentTime < absenceThreshold) {
            console.log(`➜ 判定結果: 当日だが判定時刻前のためスキップ`);
            continue;
          }
          
          // 判定時刻を過ぎても出勤記録がない場合は欠勤
          if (!dailyRecord || !dailyRecord.clockIn) {
            absentDays++;
            console.log(`➜ 判定結果: 当日欠勤 (${absentDays}日目)`);
          } else {
            console.log(`➜ 判定結果: 当日出勤済み`);
          }
        } else {
          // 過去の日で出勤記録がない場合は欠勤
          if (!dailyRecord || !dailyRecord.clockIn) {
            absentDays++;
            console.log(`➜ 判定結果: 過去日欠勤 (${absentDays}日目)`);
          } else {
            console.log(`➜ 判定結果: 過去日出勤済み`);
          }
        }
      }
    } catch (shiftError) {
      console.error("欠勤日計算エラー:", shiftError);
    }
    
    console.log(`処理結果: 労働分=${totalWorkMinutes}, 出勤日=${workDays}, 遅刻=${lateCount}, 欠勤=${absentDays}`);

    // 時間をHH:MM形式に変換
    const hours = Math.floor(totalWorkMinutes / 60);
    const minutes = totalWorkMinutes % 60;
    const totalWorkHours = `${hours}:${minutes.toString().padStart(2, '0')}`;

    const summary = {
      totalWorkHours,
      workDays,
      lateCount,
      absentDays,
      scheduledWorkDays,
      year: targetYear,
      month: targetMonth,
    };

    console.log("月次サマリー結果:", summary);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("月次サマリー取得エラー:", error);
    console.error("エラーの詳細:", error instanceof Error ? error.message : error);
    console.error("エラースタック:", error instanceof Error ? error.stack : "N/A");
    
    return NextResponse.json(
      { 
        error: "月次サマリーの取得に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー"
      },
      { status: 500 }
    );
  }
}