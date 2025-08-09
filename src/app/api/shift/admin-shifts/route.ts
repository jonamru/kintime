import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getUserPermissions, getAccessibleUserIds } from "@/lib/permissions";
import { formatJapanDate, formatJapanDateTime } from "@/lib/dateUtils";

export async function GET(request: Request) {
  try {
    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 権限チェック
    const permissions = await getUserPermissions(currentUser.id);
    const canViewAll = permissions?.shiftManagement?.viewAll;

    const { searchParams } = new URL(request.url);  
    const year = parseInt(searchParams.get('year') || '');
    const month = parseInt(searchParams.get('month') || '');
    const userId = searchParams.get('userId');
    const getBulkData = searchParams.get('bulk') === 'true';

    if (!year || !month) {
      return NextResponse.json({ error: "年月が指定されていません" }, { status: 400 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 一括修正データが要求された場合は1ヶ月分のデータを生成
    if (getBulkData && userId) {
      console.log(`一括修正用シフトデータ生成: ${year}年${month}月, ユーザー: ${userId}`);
      
      try {
        // 指定されたユーザーの既存シフトを取得
        const existingShifts = await prisma.shift.findMany({
          where: {
            userId: userId,
            date: {
              gte: startDate,
              lte: endDate,
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
        });

        console.log(`既存シフト件数: ${existingShifts.length}`);

        // 該当月の全勤怠記録を一括取得（N+1問題を回避）
        const attendanceRecords = await prisma.attendance.findMany({
          where: {
            userId: userId,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            id: true,
            date: true,
            userId: true,
          },
        });

        // 勤怠記録を日付ベースでマップ化
        const attendanceByDate = new Map();
        attendanceRecords.forEach(record => {
          const dateKey = record.date.toDateString();
          attendanceByDate.set(dateKey, true);
        });

        // シフトデータに勤怠状況を付与
        const monthlyData = existingShifts.map(shift => ({
          ...shift,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          hasAttendance: attendanceByDate.has(shift.date.toDateString()),
        }));

        console.log(`一括修正用データ生成完了: ${monthlyData.length}件`);
        return NextResponse.json(monthlyData);

      } catch (error) {
        console.error('一括修正データ生成エラー:', error);
        return NextResponse.json({ error: '一括修正データの生成に失敗しました' }, { status: 500 });
      }
    }

    // 通常のシフト取得処理
    // クエリ条件を設定
    const whereCondition: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // ユーザー指定がある場合
    if (userId) {
      whereCondition.userId = userId;
    } else {
      // アクセス可能なユーザーIDを取得
      const accessibleUserIds = await getAccessibleUserIds(currentUser.id, "shiftManagement", "viewAll");
      
      // 全シフト閲覧権限がない場合はアクセス可能なユーザーのシフトのみ取得
      if (!canViewAll) {
        if (accessibleUserIds.length === 0) {
          // 担当権限もない場合は自分のシフトのみ
          whereCondition.userId = currentUser.id;
        } else {
          // 担当権限がある場合は担当ユーザーのシフトも含める
          whereCondition.userId = { in: [...accessibleUserIds, currentUser.id] };
        }
      }
    }

    const shifts = await prisma.shift.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            customRole: {
              select: {
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { createdAt: "asc" },
      ],
    });

    // 日付を日本時間基準で返す
    const shiftsWithJapanDates = shifts.map(shift => ({
      ...shift,
      date: formatJapanDate(shift.date),
      startTime: formatJapanDateTime(shift.startTime),
      endTime: formatJapanDateTime(shift.endTime),
    }));

    return NextResponse.json(shiftsWithJapanDates);
  } catch (error) {
    console.error("管理者シフト取得エラー:", error);
    return NextResponse.json(
      { error: "シフトの取得に失敗しました" },
      { status: 500 }
    );
  }
}