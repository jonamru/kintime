import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { formatJapanDateTime } from "@/lib/dateUtils";

// シフト登録可能かどうかのチェック関数
async function canRegisterShift(userId: string, shiftDate: Date): Promise<{ canRegister: boolean; reason?: string }> {
  try {
    console.log(`シフト登録可能性チェック: userId=${userId}, shiftDate=${formatJapanDateTime(shiftDate)}`);
    
    // システム設定を取得（まずは既存レコードがあるかチェック）
    let settings = await prisma.systemSetting.findFirst();
    console.log("既存のSystemSetting:", settings);
    
    if (!settings) {
      // レコードが存在しない場合のみ作成（フィールド名を指定しない）
      settings = await prisma.systemSetting.create({
        data: {}
      });
      console.log("新規作成したSystemSetting:", settings);
    }
    
    // デフォルト値として3を使用
    const registrationDeadline = settings.shiftApprovalDeadlineDays || 3;

    const targetMonth = shiftDate.getMonth();
    const targetYear = shiftDate.getFullYear();
    const now = new Date();
    
    console.log(`登録期限チェック: targetMonth=${targetMonth + 1}, targetYear=${targetYear}, now=${formatJapanDateTime(now)}`);
    
    // 該当月の登録期限を計算（月初から設定日数まで）
    const deadline = new Date(targetYear, targetMonth, registrationDeadline, 23, 59, 59);
    
    console.log(`期限: ${formatJapanDateTime(deadline)}, 期限内: ${now <= deadline}`);
    
    // 期限内かチェック
    if (now <= deadline) {
      return { canRegister: true };
    }

    // 期限を過ぎている場合、管理者による一時的なロック解除をチェック
    const unlockRecord = await prisma.shiftRegistrationLock.findUnique({
      where: {
        userId_year_month: {
          userId,
          year: targetYear,
          month: targetMonth + 1, // Dateオブジェクトの月は0-indexedなので+1
        }
      }
    });

    console.log(`ロック解除記録: ${unlockRecord ? 'あり' : 'なし'}`, unlockRecord);
    
    if (unlockRecord && unlockRecord.isUnlocked && unlockRecord.unlockedAt) {
      // 1時間経過チェック
      const unlockTime = new Date(unlockRecord.unlockedAt);
      const lockTime = new Date(unlockTime.getTime() + 60 * 60 * 1000); // 1時間後
      
      console.log(`ロック解除時刻: ${formatJapanDateTime(unlockTime)}, 自動ロック時刻: ${formatJapanDateTime(lockTime)}, 現在時刻: ${formatJapanDateTime(now)}`);
      
      if (now >= lockTime) {
        // 1時間経過している場合は自動でロック
        await prisma.shiftRegistrationLock.update({
          where: { id: unlockRecord.id },
          data: { isUnlocked: false }
        });
        console.log("1時間経過により自動ロック");
        return { 
          canRegister: false, 
          reason: "ロック解除の有効期限（1時間）が過ぎました" 
        };
      }
      
      // 解除時は当月分のみで、過去の日付も含めて登録可能
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      console.log(`当月チェック: targetMonth=${targetMonth}, currentMonth=${currentMonth}, targetYear=${targetYear}, currentYear=${currentYear}`);
      
      if (targetMonth === currentMonth && targetYear === currentYear) {
        console.log("ロック解除により登録可能");
        return { canRegister: true };
      } else {
        console.log("当月以外のため登録不可");
        return { 
          canRegister: false, 
          reason: "ロック解除は当月分のみ有効です" 
        };
      }
    }

    return { 
      canRegister: false, 
      reason: `${targetYear}年${targetMonth + 1}月のシフト登録期限（${registrationDeadline}日）を過ぎています` 
    };
  } catch (error) {
    console.error("登録可能性チェックエラー:", error);
    return { canRegister: false, reason: "システムエラーが発生しました" };
  }
}

export async function POST(request: Request) {
  try {
    const { shifts } = await request.json();

    // 認証
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json({ error: "シフトデータが不正です" }, { status: 400 });
    }

    // シフトデータからuserIdを取得（管理者が他のユーザーのシフトを作成する場合、一般ユーザーは自分のみ）
    const firstShift = shifts[0];
    let targetUserId = firstShift.userId || currentUser.id;
    
    // 他人のシフトを登録する場合は権限チェック
    const canRegisterForOthers = await hasPermission(currentUser.id, "shiftManagement", "forceRegister") ||
                                 await hasPermission(currentUser.id, "shiftManagement", "edit");
    
    if (targetUserId !== currentUser.id && !canRegisterForOthers) {
      targetUserId = currentUser.id; // 権限がない場合は自分のシフトとして扱う
    }

    // 対象ユーザーが存在するかチェック
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 400 });
    }

    // 既存シフトのチェック
    const dates = shifts.map(s => {
      const [year, month, day] = s.date.split('-').map(Number);
      return new Date(year, month - 1, day);
    });

    const existingShifts = await prisma.shift.findMany({
      where: {
        userId: targetUserId,
        date: {
          in: dates,
        },
      },
    });

    const existingDates = existingShifts.map(shift => {
      const date = shift.date;
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    });
    const validShifts = shifts.filter(shift => 
      !existingDates.includes(shift.date)
    );

    if (validShifts.length === 0) {
      return NextResponse.json({ 
        error: "指定された日付は全て既にシフト申請済みです",
        skipped: shifts.length 
      }, { status: 400 });
    }

    // 権限チェックを事前に1回だけ実行（N+1問題を回避）
    const hasForceRegisterPermission = await hasPermission(currentUser.id, "shiftManagement", "forceRegister");

    // 登録可能性チェックと一括作成用のデータ準備
    const registrationErrors: string[] = [];
    const shiftsToCreate = [];

    // 強制登録権限がない場合は全日付の登録可能性を一括チェック
    let registrationCheckResults: Map<string, any> = new Map();
    if (!hasForceRegisterPermission) {
      // 全日付について登録可能性をチェック
      for (const shiftData of validShifts) {
        const [year, month, day] = shiftData.date.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        const canRegister = await canRegisterShift(targetUserId, localDate);
        registrationCheckResults.set(shiftData.date, canRegister);
      }
    }

    for (const shiftData of validShifts) {
      // 日付文字列から年月日を直接パース
      const [year, month, day] = shiftData.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      
      // 強制登録権限がない場合は事前にチェックした結果を使用
      if (!hasForceRegisterPermission) {
        const canRegister = registrationCheckResults.get(shiftData.date);
        if (!canRegister?.canRegister) {
          registrationErrors.push(`${localDate.toLocaleDateString('ja-JP')}: ${canRegister.reason}`);
          continue;
        }
      }

      const startDateTime = new Date(year, month - 1, day, ...shiftData.startTime.split(':').map(Number));
      const endDateTime = new Date(year, month - 1, day, ...shiftData.endTime.split(':').map(Number));

      shiftsToCreate.push({
        userId: targetUserId,
        date: localDate,
        startTime: startDateTime,
        endTime: endDateTime,
        breakTime: shiftData.breakTime ?? 60,
        shiftType: shiftData.shiftType as any,
        location: shiftData.location || "",
        note: shiftData.note || null,
        status: "APPROVED" as any, // 登録制なので即座に確定
      });
    }

    // 登録不可のシフトがある場合はエラーを返す
    if (registrationErrors.length > 0 && shiftsToCreate.length === 0) {
      return NextResponse.json({
        error: "登録できないシフトがあります",
        details: registrationErrors
      }, { status: 400 });
    }

    // トランザクションで一括作成
    const createdShifts = await prisma.$transaction(
      shiftsToCreate.map(shiftData => 
        prisma.shift.create({ 
          data: shiftData
        })
      )
    );

    return NextResponse.json({
      message: `${createdShifts.length}件のシフトを登録しました`,
      created: createdShifts.length,
      skipped: shifts.length - createdShifts.length,
      errors: registrationErrors.length > 0 ? registrationErrors : undefined,
    });
  } catch (error) {
    console.error("一括シフト作成エラー:", error);
    console.error("エラー詳細:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "一括シフト登録に失敗しました", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}