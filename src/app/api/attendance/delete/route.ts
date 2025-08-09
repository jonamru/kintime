import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// Undo機能用のPOSTメソッド（タイムアウト制限付き）
export async function POST(request: Request) {
  try {
    const { attendanceId, isUndo } = await request.json();
    
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!attendanceId) {
      return NextResponse.json({ error: "打刻IDが指定されていません" }, { status: 400 });
    }

    // 対象の打刻記録を取得
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    if (!attendance) {
      return NextResponse.json({ error: "打刻記録が見つかりません" }, { status: 404 });
    }

    // Undo操作の場合、時間制限と本人確認をチェック
    if (isUndo) {
      // 本人の操作のみ許可
      if (attendance.userId !== currentUser.id) {
        return NextResponse.json({ error: "自分の打刻のみ取り消すことができます" }, { status: 403 });
      }

      // 打刻から5分以内のみ許可（Undoのタイムアウト）
      const clockTime = new Date(attendance.clockTime);
      const now = new Date();
      const diffMs = now.getTime() - clockTime.getTime();
      const maxUndoTimeMs = 5 * 60 * 1000; // 5分

      if (diffMs > maxUndoTimeMs) {
        return NextResponse.json({ error: "打刻から時間が経過しているため、取り消しできません" }, { status: 400 });
      }
    } else {
      // 通常の削除は管理者権限が必要
      const hasEditOthersPermission = await hasPermission(currentUser.id, "attendanceManagement", "editOthers");
      if (!hasEditOthersPermission) {
        return NextResponse.json({ error: "勤怠記録の削除権限がありません" }, { status: 403 });
      }
    }

    // 関連する修正記録も削除
    await prisma.correction.deleteMany({
      where: { attendanceId }
    });

    // 打刻記録を削除
    await prisma.attendance.delete({
      where: { id: attendanceId }
    });

    return NextResponse.json({
      message: isUndo 
        ? "打刻を取り消しました" 
        : `${attendance.user.name}さんの打刻記録を削除しました`,
    });
  } catch (error) {
    console.error("打刻削除エラー:", error);
    return NextResponse.json(
      { error: "打刻削除に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // リクエストボディからIDを取得
    let attendanceId: string;
    try {
      const body = await request.json();
      attendanceId = body.id;
    } catch {
      // フォールバック：クエリパラメータから取得
      const { searchParams } = new URL(request.url);
      attendanceId = searchParams.get('id') || '';
    }

    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 他人の勤怠編集権限をチェック
    const hasEditOthersPermission = await hasPermission(currentUser.id, "attendanceManagement", "editOthers");
    if (!hasEditOthersPermission) {
      return NextResponse.json({ error: "勤怠記録の削除権限がありません" }, { status: 403 });
    }

    if (!attendanceId) {
      return NextResponse.json({ error: "打刻IDが指定されていません" }, { status: 400 });
    }

    // 仮想レコード（daily-で始まる）の場合は、該当する実際の記録を検索
    if (attendanceId.startsWith('daily-')) {
      const parts = attendanceId.split('-');
      if (parts.length >= 5) {
        const dateStr = `${parts[1]}-${parts[2]}-${parts[3]}`;
        const userId = parts[4];
        
        const targetDate = new Date(dateStr);
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        
        // その日の全ての打刻記録を削除
        const attendanceRecords = await prisma.attendance.findMany({
          where: {
            userId: userId,
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
          include: {
            user: {
              select: { name: true }
            }
          }
        });

        if (attendanceRecords.length === 0) {
          return NextResponse.json({ error: "削除対象の打刻記録が見つかりません" }, { status: 404 });
        }

        // 関連する修正記録を削除
        const attendanceIds = attendanceRecords.map(record => record.id);
        await prisma.correction.deleteMany({
          where: { attendanceId: { in: attendanceIds } }
        });

        // 打刻記録を削除
        await prisma.attendance.deleteMany({
          where: { id: { in: attendanceIds } }
        });

        return NextResponse.json({
          message: `${attendanceRecords[0].user.name}さんの${attendanceRecords.length}件の打刻記録を削除しました`,
        });
      } else {
        return NextResponse.json({ error: "無効なレコードID形式です" }, { status: 400 });
      }
    }

    // 対象の打刻記録を取得
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    if (!attendance) {
      return NextResponse.json({ error: "打刻記録が見つかりません" }, { status: 404 });
    }

    // 関連する修正記録も削除
    await prisma.correction.deleteMany({
      where: { attendanceId }
    });

    // 打刻記録を削除
    await prisma.attendance.delete({
      where: { id: attendanceId }
    });

    return NextResponse.json({
      message: `${attendance.user.name}さんの打刻記録を削除しました`,
    });
  } catch (error) {
    console.error("打刻削除エラー:", error);
    return NextResponse.json(
      { error: "打刻削除に失敗しました" },
      { status: 500 }
    );
  }
}