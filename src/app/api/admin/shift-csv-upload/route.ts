import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: "CSVファイルを選択してください" }, { status: 400 });
    }

    // CSVファイルを読み取り
    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSVファイルにデータがありません" }, { status: 400 });
    }

    // ヘッダー行をスキップ
    const dataLines = lines.slice(1);
    const results = {
      success: 0,
      errors: [] as string[],
      skipped: 0,
    };

    // ユーザー情報をキャッシュ（ユーザーIDとデフォルト勤務地を取得）
    const users = await prisma.user.findMany({
      select: { 
        id: true, 
        userId: true, 
        name: true,
        defaultLocation: true
      }
    });
    const userMap = new Map(users.map(u => [u.userId, u]));

    for (let i = 0; i < dataLines.length; i++) {
      const lineNumber = i + 2; // ヘッダー行を考慮
      const line = dataLines[i].trim();
      
      if (!line) continue;

      try {
        const [userIdFromCsv, date, startTime, endTime, shiftType, location, breakTime, note] = 
          line.split(',').map(item => item.trim().replace(/^"|"$/g, ''));

        // バリデーション（locationはREGULARの場合は省略可能）
        if (!userIdFromCsv || !date || !startTime || !endTime || !shiftType) {
          results.errors.push(`行${lineNumber}: 必須項目が不足しています`);
          continue;
        }

        const user = userMap.get(userIdFromCsv);
        if (!user) {
          results.errors.push(`行${lineNumber}: ユーザー(${userIdFromCsv})が見つかりません`);
          continue;
        }

        // REGULARシフトの場合、locationが空の場合はデフォルト勤務地を使用
        let finalLocation = location;
        if (shiftType.toUpperCase() === 'REGULAR') {
          if (!location || location.trim() === '') {
            if (user.defaultLocation) {
              finalLocation = user.defaultLocation;
            } else {
              results.errors.push(`行${lineNumber}: ${user.name}さんのデフォルト勤務地が設定されていません`);
              continue;
            }
          }
        } else if (!location || location.trim() === '') {
          results.errors.push(`行${lineNumber}: スポットシフトの場合は勤務地が必須です`);
          continue;
        }

        // 日付の妥当性チェック（YYYY-MM-DD または YYYY/M/D 形式に対応）
        let year, month, day;
        
        if (date.includes('-')) {
          // YYYY-MM-DD形式
          [year, month, day] = date.split('-').map(Number);
        } else if (date.includes('/')) {
          // YYYY/M/D形式
          [year, month, day] = date.split('/').map(Number);
        } else {
          results.errors.push(`行${lineNumber}: 日付形式が認識できません(${date}) - YYYY-MM-DD または YYYY/M/D 形式で入力してください`);
          continue;
        }
        
        if (!year || !month || !day || year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
          results.errors.push(`行${lineNumber}: 無効な日付です(${date}) - 年: ${year}, 月: ${month}, 日: ${day}`);
          continue;
        }
        const shiftDate = new Date(year, month - 1, day);

        // 時間の妥当性チェック
        const startTimeMatch = startTime.match(/^(\d{1,2}):(\d{2})$/);
        const endTimeMatch = endTime.match(/^(\d{1,2}):(\d{2})$/);
        
        if (!startTimeMatch || !endTimeMatch) {
          results.errors.push(`行${lineNumber}: 無効な時間形式です`);
          continue;
        }

        // シフトタイプのチェック
        if (!['REGULAR', 'SPOT'].includes(shiftType.toUpperCase())) {
          results.errors.push(`行${lineNumber}: 無効なシフトタイプです(${shiftType})`);
          continue;
        }

        // 重複チェック
        const existingShift = await prisma.shift.findFirst({
          where: {
            userId: user.id,
            date: {
              gte: shiftDate,
              lt: new Date(year, month - 1, day + 1),
            }
          }
        });

        if (existingShift) {
          results.errors.push(`行${lineNumber}: ${user.name}さんの${date}は既に登録済みです`);
          results.skipped++;
          continue;
        }

        // シフト作成
        const startDateTime = new Date(year, month - 1, day, ...startTime.split(':').map(Number));
        const endDateTime = new Date(year, month - 1, day, ...endTime.split(':').map(Number));

        await prisma.shift.create({
          data: {
            userId: user.id,
            date: shiftDate,
            startTime: startDateTime,
            endTime: endDateTime,
            breakTime: breakTime ? parseInt(breakTime) : 60,
            shiftType: shiftType.toUpperCase() as 'REGULAR' | 'SPOT',
            location: finalLocation,
            note: note || null,
            status: "APPROVED",
          }
        });

        results.success++;
      } catch (error) {
        results.errors.push(`行${lineNumber}: 処理エラー - ${error}`);
      }
    }

    return NextResponse.json({
      message: `CSV一括登録完了: 成功${results.success}件、エラー${results.errors.length}件、スキップ${results.skipped}件`,
      success: results.success,
      errors: results.errors,
      skipped: results.skipped,
    });

  } catch (error) {
    console.error("CSV一括登録エラー:", error);
    return NextResponse.json(
      { error: "CSV一括登録に失敗しました" },
      { status: 500 }
    );
  }
}