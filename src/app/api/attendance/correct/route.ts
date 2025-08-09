import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const { attendanceId, newTime, reason, comment } = await request.json();

    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 他人の勤怠編集権限をチェック
    const hasEditOthersPermission = await hasPermission(currentUser.id, "attendanceManagement", "editOthers");
    if (!hasEditOthersPermission) {
      return NextResponse.json({ error: "勤怠記録の修正権限がありません" }, { status: 403 });
    }

    if (!attendanceId || !newTime || !reason) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // 対象の打刻記録を取得
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId }
    });

    if (!attendance) {
      return NextResponse.json({ error: "打刻記録が見つかりません" }, { status: 404 });
    }

    const oldTime = attendance.clockTime;
    const newDateTime = new Date(newTime);

    // 修正記録を作成
    const correction = await prisma.correction.create({
      data: {
        attendanceId,
        oldTime,
        newTime: newDateTime,
        reason,
        comment: comment || null,
        status: "APPROVED", // 管理者による修正は即座に承認
        approvedBy: currentUser.id,
      },
    });

    // 打刻記録を更新
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        clockTime: newDateTime,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "打刻時刻を修正しました",
      correction,
    });
  } catch (error) {
    console.error("打刻修正エラー:", error);
    return NextResponse.json(
      { error: "打刻修正に失敗しました" },
      { status: 500 }
    );
  }
}