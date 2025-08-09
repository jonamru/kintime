import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { formatJapanDateTime } from "@/lib/dateUtils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, shifts: initialShifts } = body;
    let shifts = initialShifts;
    const originalShiftCount = shifts ? shifts.length : 0;

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 権限チェック
    const canForceRegister = await hasPermission(currentUser.id, 'shiftManagement', 'forceRegister');
    if (!canForceRegister) {
      return NextResponse.json({ error: "シフト強制登録権限が必要です" }, { status: 403 });
    }

    // 対象ユーザーの存在確認
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 404 });
    }

    if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json({ error: "シフトデータが不正です" }, { status: 400 });
    }

    // 全権限ユーザーかチェック
    const hasOverridePermission = await hasPermission(currentUser.id, 'shiftManagement', 'forceRegister');

    // 既存シフトのチェック（強制登録権限がある場合は既存シフトを削除）
    const dates = shifts.map(s => {
      const [year, month, day] = s.date.split('-').map(Number);
      return new Date(year, month - 1, day);
    });

    const existingShifts = await prisma.shift.findMany({
      where: {
        userId: userId,
        date: {
          in: dates,
        },
      },
    });

    // 強制登録権限がある場合は既存シフトを削除
    if (hasOverridePermission && existingShifts.length > 0) {
      await prisma.shift.deleteMany({
        where: {
          userId: userId,
          date: {
            in: dates,
          },
        },
      });
      console.log(`Deleted ${existingShifts.length} existing shifts for override registration`);
    } else if (existingShifts.length > 0) {
      // 強制登録権限がない場合は重複チェック
      const existingDates = existingShifts.map(shift => {
        const date = shift.date;
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      });
      const validShifts = shifts.filter(shift => 
        !existingDates.includes(shift.date)
      );

      if (validShifts.length === 0) {
        return NextResponse.json({ 
          error: "指定された日付は全て既にシフト登録済みです",
          skipped: shifts.length 
        }, { status: 400 });
      }
      
      // 有効なシフトのみに絞り込む
      shifts = validShifts;
    }

    // 一括作成用のデータ準備
    const shiftsToCreate = shifts.map(shiftData => {
      // 日付文字列から年月日を直接パース
      const [year, month, day] = shiftData.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const startDateTime = new Date(year, month - 1, day, ...shiftData.startTime.split(':').map(Number));
      const endDateTime = new Date(year, month - 1, day, ...shiftData.endTime.split(':').map(Number));

      return {
        userId: userId,
        date: localDate,
        startTime: startDateTime,
        endTime: endDateTime,
        breakTime: shiftData.breakTime ?? 60,
        shiftType: shiftData.shiftType,
        location: shiftData.location,
        note: shiftData.note || null,
        status: "APPROVED", // 管理者登録は即座に確定
      };
    });

    // トランザクションで一括作成
    const createdShifts = await prisma.$transaction(
      shiftsToCreate.map(shiftData => 
        prisma.shift.create({ 
          data: {
            date: shiftData.date,
            startTime: shiftData.startTime,
            endTime: shiftData.endTime,
            breakTime: shiftData.breakTime,
            shiftType: shiftData.shiftType,
            location: shiftData.location,
            note: shiftData.note,
            status: "APPROVED" as any,
            user: {
              connect: { id: shiftData.userId }
            }
          }
        })
      )
    );

    return NextResponse.json({
      message: `${targetUser.name}さんの${createdShifts.length}件のシフトを登録しました`,
      created: createdShifts.length,
      skipped: originalShiftCount - createdShifts.length,
    });
  } catch (error) {
    console.error("管理者シフト登録エラー:", error);
    console.error("エラー詳細:", {
      name: (error as any)?.name,
      message: (error as any)?.message,
      stack: (error as any)?.stack
    });
    return NextResponse.json(
      { error: "シフト登録に失敗しました", details: (error as any)?.message },
      { status: 500 }
    );
  }
}