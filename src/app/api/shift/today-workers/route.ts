import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, getAccessibleUserIds } from "@/lib/permissions";
import { formatJapanDate, formatJapanDateTime } from "@/lib/dateUtils";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // シフト閲覧権限をチェック
    // シフト閲覧権限または勤怠閲覧権限をチェック
    const canViewAllShifts = await hasPermission(currentUser.id, "shiftManagement", "viewAll");
    const canViewAllAttendance = await hasPermission(currentUser.id, "attendanceManagement", "viewAll");

    // どちらかの権限で全閲覧可能ならOK
    const canViewAll = canViewAllShifts || canViewAllAttendance;

    const canViewCompany = await hasPermission(currentUser.id, "shiftManagement", "viewCompany");
    const canViewAssigned = await hasPermission(currentUser.id, "shiftManagement", "viewAssigned");

    const accessibleUserIds = await getAccessibleUserIds(currentUser.id, "shiftManagement", "viewAll");

    if (!canViewAll && !canViewCompany && !canViewAssigned && accessibleUserIds.length === 0) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // 日付パラメータの処理（YYYY-MM-DD形式）
    let startOfDay, endOfDay;
    if (dateParam) {
      // 日付文字列を分割してローカルタイムゾーンで正確な日付を作成
      const [year, month, day] = dateParam.split('-').map(Number);
      startOfDay = new Date(year, month - 1, day, 0, 0, 0);
      endOfDay = new Date(year, month - 1, day + 1, 0, 0, 0);
    } else {
      // 今日の日付
      const now = new Date();
      startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
    }

    // クエリ条件を設定
    const whereCondition: Prisma.ShiftWhereInput = {
      date: {
        gte: startOfDay,
        lt: endOfDay,
      },
      status: "APPROVED",
    };

    // 全体閲覧権限がない場合はアクセス可能なユーザーのシフトのみ取得
    if (!canViewAll) {
      whereCondition.userId = { in: [...accessibleUserIds, currentUser.id] };
    }

    // 指定日のシフトを取得
    const shifts = await prisma.shift.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            wakeUpEnabled: true,
            departureEnabled: true,
            partner: {
              select: {
                name: true,
              },
            },
            customRole: {
              select: {
                rank: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { user: { partner: { name: "asc" } } },
        { user: { userId: "asc" } },
      ],
    });

    // 各ユーザーの打刻状況を取得
    const userIds = shifts.map(shift => shift.userId);
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: { in: userIds },
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      orderBy: {
        clockTime: "asc",
      },
    });

    // ユーザーごとの打刻データをマッピング
    const attendanceMap = attendances.reduce((map, attendance) => {
      if (!map[attendance.userId]) {
        map[attendance.userId] = [];
      }
      map[attendance.userId].push(attendance);
      return map;
    }, {} as Record<string, typeof attendances>);

    // シフトと打刻情報を結合
    const workersWithAttendance = shifts.map(shift => {
      const userAttendances = attendanceMap[shift.userId] || [];

      // 打刻状況を判定
      const clockIn = userAttendances.find((a: { type: string }) => a.type === "CLOCK_IN");
      const clockOut = userAttendances.find((a: { type: string }) => a.type === "CLOCK_OUT");
      const wakeUp = userAttendances.find((a: { type: string }) => a.type === "WAKE_UP");
      const departure = userAttendances.find((a: { type: string }) => a.type === "DEPARTURE");

      let attendanceStatus = "未打刻";
      if (clockOut) {
        attendanceStatus = "退勤済み";
      } else if (clockIn) {
        attendanceStatus = "出勤中";
      } else if (departure) {
        attendanceStatus = "出発済み";
      } else if (wakeUp) {
        attendanceStatus = "起床済み";
      }

      return {
        shift: {
          ...shift,
          date: formatJapanDate(shift.date),
          startTime: formatJapanDateTime(shift.startTime),
          endTime: formatJapanDateTime(shift.endTime),
        },
        user: shift.user,
        attendances: userAttendances,
        attendanceStatus,
        clockInTime: clockIn?.clockTime ? formatJapanDateTime(clockIn.clockTime) : undefined,
        clockOutTime: clockOut?.clockTime ? formatJapanDateTime(clockOut.clockTime) : undefined,
      };
    });

    // ローカル日付をYYYY-MM-DD形式で返す
    const year = startOfDay.getFullYear();
    const month = String(startOfDay.getMonth() + 1).padStart(2, '0');
    const day = String(startOfDay.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    return NextResponse.json({
      date: dateString,
      totalWorkers: workersWithAttendance.length,
      workers: workersWithAttendance,
    });
  } catch (error: unknown) {
    console.error("出勤者取得エラー:", error);
    return NextResponse.json(
      { error: "出勤者情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}