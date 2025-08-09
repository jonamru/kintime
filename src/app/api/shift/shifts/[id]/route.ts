import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// 自動承認の期限チェック関数
async function shouldAutoApprove(shiftDate: Date): Promise<boolean> {
  try {
    // システム設定を取得（存在しない場合はデフォルト3日を使用）
    let settings = await prisma.systemSetting.findFirst();
    if (!settings) {
      // 初期設定がない場合は作成
      settings = await prisma.systemSetting.create({
        data: { shiftApprovalDeadlineDays: 3 }
      });
    }

    const deadlineDays = settings.shiftApprovalDeadlineDays;
    const targetMonth = shiftDate.getMonth();
    const targetYear = shiftDate.getFullYear();
    
    // 該当月の締切日を計算（月初からdeadlineDays日まで）
    const deadline = new Date(targetYear, targetMonth, deadlineDays, 23, 59, 59);
    const now = new Date();
    
    return now <= deadline;
  } catch (error) {
    console.error("期限チェックエラー:", error);
    // エラー時は安全側に倒して承認必要とする
    return false;
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestBody = await request.json();
    const { date, startTime, endTime, shiftType, location, breakTime, note } = requestBody;
    
    console.log("シフト更新API - 受信データ:", requestBody);
    console.log("breakTime の値:", breakTime, "型:", typeof breakTime);

    // 認証
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // シフトが存在するかチェック
    const existingShift = await prisma.shift.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!existingShift) {
      return NextResponse.json({ error: "シフトが見つかりません" }, { status: 404 });
    }

    // 権限チェック：自分のシフトまたはシフト編集権限があるか
    const canEditShift = existingShift.userId === currentUser.id || 
                        await hasPermission(currentUser.id, "shiftManagement", "edit");
    
    if (!canEditShift) {
      return NextResponse.json({ error: "このシフトを編集する権限がありません" }, { status: 403 });
    }

    // 過去日付編集権限チェック（権限がない場合は当日を含む過去分は編集不可）
    const originalShiftDate = new Date(existingShift.date);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const hasEditPermission = await hasPermission(currentUser.id, "shiftManagement", "edit");
    if (!hasEditPermission && originalShiftDate < todayStart) {
      return NextResponse.json({ error: "当日を含む過去のシフトは編集できません" }, { status: 403 });
    }

    const [year, month, day] = date.split('-').map(Number);
    const shiftDate = new Date(year, month - 1, day);
    const startDateTime = new Date(year, month - 1, day, ...startTime.split(':').map(Number));
    const endDateTime = new Date(year, month - 1, day, ...endTime.split(':').map(Number));

    // 自動承認の判定
    const isAutoApproved = await shouldAutoApprove(shiftDate);

    // 日付が変更された場合、重複チェック
    if (shiftDate.toDateString() !== existingShift.date.toDateString()) {
      const duplicateShift = await prisma.shift.findFirst({
        where: {
          userId: existingShift.userId,
          date: {
            gte: shiftDate,
            lt: new Date(year, month - 1, day + 1),
          },
          id: { not: id },
        },
      });

      if (duplicateShift) {
        return NextResponse.json(
          { error: "この日は既に他のシフト申請があります" },
          { status: 400 }
        );
      }
    }

    const finalBreakTime = breakTime ?? 60;
    console.log("最終的な breakTime:", finalBreakTime);
    
    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        date: shiftDate,
        startTime: startDateTime,
        endTime: endDateTime,
        breakTime: finalBreakTime,
        shiftType,
        location,
        note: note || null,
        status: "APPROVED", // 登録制なので常に承認済み
      },
    });

    console.log("更新後のデータベースの値:", updatedShift.breakTime);
    
    // 念のため、データベースから再取得して確認
    const verifyShift = await prisma.shift.findUnique({
      where: { id },
      select: { breakTime: true }
    });
    console.log("データベース再取得での breakTime:", verifyShift?.breakTime);

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error("シフト更新エラー:", error);
    return NextResponse.json(
      { error: "シフトの更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 認証
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // シフトが存在するかチェック
    const existingShift = await prisma.shift.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!existingShift) {
      return NextResponse.json({ error: "シフトが見つかりません" }, { status: 404 });
    }

    // 権限チェック：自分のシフトまたはシフト削除権限があるか
    const canDeleteShift = existingShift.userId === currentUser.id || 
                          await hasPermission(currentUser.id, "shiftManagement", "delete");
    
    if (!canDeleteShift) {
      return NextResponse.json({ error: "このシフトを削除する権限がありません" }, { status: 403 });
    }

    // 過去日付削除権限チェック
    const shiftDate = new Date(existingShift.date);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // 削除権限がない場合は当日を含む過去分は削除不可
    const hasDeletePermission = await hasPermission(currentUser.id, "shiftManagement", "delete");
    if (!hasDeletePermission && shiftDate < todayStart) {
      return NextResponse.json({ error: "当日を含む過去のシフトは削除できません" }, { status: 403 });
    }

    // 削除権限がある場合、打刻済みかチェック
    if (hasDeletePermission) {
      const startOfDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const attendance = await prisma.attendance.findFirst({
        where: {
          userId: existingShift.userId,
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      });

      if (attendance) {
        return NextResponse.json({ error: "このシフトは打刻済みのため削除できません" }, { status: 403 });
      }
    }

    await prisma.shift.delete({
      where: { id },
    });

    return NextResponse.json({ message: "シフトを削除しました" });
  } catch (error) {
    console.error("シフト削除エラー:", error);
    return NextResponse.json(
      { error: "シフトの削除に失敗しました" },
      { status: 500 }
    );
  }
}