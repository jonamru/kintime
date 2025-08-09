import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const { userId, type, clockTime } = await request.json();

    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 強制打刻権限をチェック
    const hasForceClockPermission = await hasPermission(currentUser.id, "attendanceManagement", "forceClockInOut");
    if (!hasForceClockPermission) {
      return NextResponse.json({ error: "強制打刻権限がありません" }, { status: 403 });
    }

    // タイプの検証
    const validTypes = ['CLOCK_IN', 'CLOCK_OUT', 'WAKE_UP', 'DEPARTURE'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "無効な打刻タイプです" }, { status: 400 });
    }

    // 対象ユーザーの存在確認
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    // ユーザーの設定確認（WAKE_UP、DEPARTUREの場合）
    if (type === 'WAKE_UP' && !targetUser.wakeUpEnabled) {
      return NextResponse.json({ error: "このユーザーは起床報告が無効になっています" }, { status: 400 });
    }
    
    if (type === 'DEPARTURE' && !targetUser.departureEnabled) {
      return NextResponse.json({ error: "このユーザーは出発報告が無効になっています" }, { status: 400 });
    }

    // 打刻時刻の処理（指定されない場合は現在時刻）
    const clockDateTime = clockTime ? new Date(clockTime) : new Date();
    
    // 打刻日の範囲を計算（日本時間で処理）
    const clockDate = new Date(clockDateTime.getFullYear(), clockDateTime.getMonth(), clockDateTime.getDate());
    const nextDay = new Date(clockDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // その日のシフトがあるかチェック
    const shift = await prisma.shift.findFirst({
      where: {
        userId: userId,
        date: {
          gte: clockDate,
          lt: nextDay,
        },
        status: "APPROVED",
      },
    });

    if (!shift) {
      return NextResponse.json(
        { error: "この日はシフトが登録されていないため打刻できません" },
        { status: 400 }
      );
    }

    // 同じタイプの打刻があるかチェック
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId: userId,
        type,
        date: {
          gte: clockDate,
          lt: nextDay,
        },
      },
    });

    if (existingAttendance) {
      return NextResponse.json(
        { error: "すでに打刻済みです" },
        { status: 400 }
      );
    }

    // 新しい打刻を作成
    const attendance = await prisma.attendance.create({
      data: {
        userId: userId,
        date: clockDateTime,
        type,
        clockTime: clockDateTime,
        latitude: null,
        longitude: null,
      },
    });

    // 管理者による強制打刻として修正記録を作成
    await prisma.correction.create({
      data: {
        attendanceId: attendance.id,
        oldTime: clockDateTime, // 強制打刻の場合は同じ時刻
        newTime: clockDateTime,
        reason: `管理者による強制打刻（${currentUser.name}）`,
        status: "APPROVED",
        comment: `管理者 ${currentUser.name} による強制${type === 'CLOCK_IN' ? '出勤' : type === 'CLOCK_OUT' ? '退勤' : type === 'WAKE_UP' ? '起床' : '出発'}打刻`,
        approvedBy: currentUser.id,
      },
    });

    // 管理者による強制打刻のログを出力
    console.log("管理者による強制打刻:", {
      adminId: currentUser.id,
      adminEmail: currentUser.email,
      targetUserId: userId,
      targetUserEmail: targetUser.email,
      type,
      clockTime: clockDateTime.toISOString()
    });

    return NextResponse.json({
      ...attendance,
      forcedBy: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      }
    });
  } catch (error) {
    console.error("管理者打刻エラー:", error);
    return NextResponse.json(
      { error: "打刻に失敗しました" },
      { status: 500 }
    );
  }
}