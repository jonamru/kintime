import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { formatJapanDate, formatJapanDateTime } from "@/lib/dateUtils";
import { createRequestCache } from "@/lib/requestCache";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // リクエストレベルキャッシュを初期化
    const cache = createRequestCache();

    // 一括編集権限チェック（複数の権限の組み合わせで判定）
    const canEditAttendance = await hasPermission(currentUser.id, "attendanceManagement", "editOthers", cache);
    const canEditShift = await hasPermission(currentUser.id, "shiftManagement", "edit", cache);
    const canEditExpense = await hasPermission(currentUser.id, "expenseManagement", "viewAll", cache);

    if (!canEditAttendance && !canEditShift && !canEditExpense) {
      return NextResponse.json({ error: "一括編集権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const { action, type, records } = body;

    if (!action || !type || !Array.isArray(records)) {
      return NextResponse.json({ error: "リクエストパラメータが不正です" }, { status: 400 });
    }

    let results = [];

    // 事前権限チェックオブジェクト
    const permissions = {
      canEditAttendance,
      canEditShift,
      canEditExpense,
      canApproveShift: await hasPermission(currentUser.id, "shiftManagement", "approve", cache),
      canApproveExpense: await hasPermission(currentUser.id, "expenseManagement", "approve", cache),
      canDeleteExpense: await hasPermission(currentUser.id, "expenseManagement", "delete", cache)
    };

    switch (action) {
      case 'delete':
        results = await handleBulkDelete(type, records, currentUser.id, permissions);
        break;
      case 'update':
        results = await handleBulkUpdate(type, records, currentUser.id, permissions);
        break;
      case 'approve':
        results = await handleBulkApprove(type, records, currentUser.id, permissions);
        break;
      default:
        return NextResponse.json({ error: "不正なアクション" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${results.success}件の処理が完了しました`,
      results
    });

  } catch (error) {
    console.error("一括編集エラー:", error);
    return NextResponse.json(
      { error: "一括編集に失敗しました" },
      { status: 500 }
    );
  }
}

async function handleBulkDelete(type: string, recordIds: string[], userId: string, permissions: any) {
  const results = { success: 0, failed: 0, errors: [] };

  // 事前権限チェック（ループ外）
  let hasPermissionForType = false;
  switch (type) {
    case 'attendance':
      hasPermissionForType = permissions.canEditAttendance;
      break;
    case 'shift':
      hasPermissionForType = permissions.canEditShift;
      break;
    case 'expense':
      hasPermissionForType = permissions.canDeleteExpense;
      break;
    default:
      results.failed += recordIds.length;
      results.errors.push(`不正なタイプ: ${type}`);
      return results;
  }

  if (!hasPermissionForType) {
    results.failed += recordIds.length;
    results.errors.push(`${type}削除権限がありません`);
    return results;
  }

  // 一括削除処理（トランザクション使用）
  try {
    await prisma.$transaction(async (tx) => {
      for (const recordId of recordIds) {
        try {
          switch (type) {
            case 'attendance':
              await tx.attendance.delete({
                where: { id: recordId }
              });
              break;
            case 'shift':
              await tx.shift.delete({
                where: { id: recordId }
              });
              break;
            case 'expense':
              await tx.expense.delete({
                where: { id: recordId }
              });
              break;
          }
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`削除失敗 ${recordId}: ${(error as Error).message}`);
        }
      }
    });
  } catch (error) {
    console.error('一括削除トランザクションエラー:', error);
    results.failed += recordIds.length - results.success;
    results.errors.push(`トランザクションエラー: ${(error as Error).message}`);
  }

  return results;
}

async function handleBulkUpdate(type: string, records: any[], userId: string, permissions: any) {
  const results = { success: 0, failed: 0, errors: [] };

  // 事前権限チェック（ループ外）
  let hasPermissionForType = false;
  switch (type) {
    case 'attendance':
      hasPermissionForType = permissions.canEditAttendance;
      break;
    case 'shift':
      hasPermissionForType = permissions.canEditShift;
      break;
    case 'expense':
      hasPermissionForType = permissions.canEditExpense;
      break;
    default:
      results.failed += records.length;
      results.errors.push(`不正なタイプ: ${type}`);
      return results;
  }

  if (!hasPermissionForType) {
    results.failed += records.length;
    results.errors.push(`${type}更新権限がありません`);
    return results;
  }

  // 一括更新処理（トランザクション使用）
  try {
    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        try {
          switch (type) {
            case 'attendance':
              await tx.attendance.update({
                where: { id: record.id },
                data: {
                  clockTime: record.clockTime ? new Date(record.clockTime) : undefined,
                  type: record.type,
                  // 必要に応じて他のフィールドも追加
                }
              });
              break;

            case 'shift':
              await tx.shift.update({
                where: { id: record.id },
                data: {
                  startTime: record.startTime ? new Date(record.startTime) : undefined,
                  endTime: record.endTime ? new Date(record.endTime) : undefined,
                  location: record.location,
                  breakTime: record.breakTime,
                  note: record.note,
                  // 必要に応じて他のフィールドも追加
                }
              });
              break;

            case 'expense':
              await tx.expense.update({
                where: { id: record.id },
                data: {
                  amount: record.amount,
                  category: record.category,
                  description: record.description,
                  // 必要に応じて他のフィールドも追加
                }
              });
              break;
          }
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`更新失敗 ${record.id}: ${(error as Error).message}`);
        }
      }
    });
  } catch (error) {
    console.error('一括更新トランザクションエラー:', error);
    results.failed += records.length - results.success;
    results.errors.push(`トランザクションエラー: ${(error as Error).message}`);
  }

  return results;
}

async function handleBulkApprove(type: string, recordIds: string[], userId: string, permissions: any) {
  const results = { success: 0, failed: 0, errors: [] };

  // 事前権限チェック（ループ外）
  let hasPermissionForType = false;
  switch (type) {
    case 'shift':
      hasPermissionForType = permissions.canApproveShift;
      break;
    case 'expense':
      hasPermissionForType = permissions.canApproveExpense;
      break;
    default:
      results.failed += recordIds.length;
      results.errors.push(`承認対象外のタイプ: ${type}`);
      return results;
  }

  if (!hasPermissionForType) {
    results.failed += recordIds.length;
    results.errors.push(`${type}承認権限がありません`);
    return results;
  }

  // 一括承認処理（トランザクション使用）
  try {
    await prisma.$transaction(async (tx) => {
      for (const recordId of recordIds) {
        try {
          switch (type) {
            case 'shift':
              await tx.shift.update({
                where: { id: recordId },
                data: { status: "APPROVED" }
              });
              break;

            case 'expense':
              await tx.expense.update({
                where: { id: recordId },
                data: { status: "APPROVED" }
              });
              break;
          }
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`承認失敗 ${recordId}: ${(error as Error).message}`);
        }
      }
    });
  } catch (error) {
    console.error('一括承認トランザクションエラー:', error);
    results.failed += recordIds.length - results.success;
    results.errors.push(`トランザクションエラー: ${(error as Error).message}`);
  }

  return results;
}

// データ取得用のGETメソッド
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // リクエストレベルキャッシュを初期化
    const cache = createRequestCache();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!userId || !type || !year || !month) {
      return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
    }

    // 権限チェック（キャッシュ使用）
    let hasAccess = false;
    switch (type) {
      case 'attendance':
        hasAccess = await hasPermission(currentUser.id, "attendanceManagement", "viewAll", cache) ||
                   await hasPermission(currentUser.id, "attendanceManagement", "editOthers", cache);
        break;
      case 'shift':
        hasAccess = await hasPermission(currentUser.id, "shiftManagement", "viewAll", cache) ||
                   await hasPermission(currentUser.id, "shiftManagement", "edit", cache);
        break;
      case 'expense':
        hasAccess = await hasPermission(currentUser.id, "expenseManagement", "viewAll", cache);
        break;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "データ閲覧権限がありません" }, { status: 403 });
    }

    // 日付範囲を設定
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    let data = [];

    switch (type) {
      case 'attendance':
        data = await prisma.attendance.findMany({
          where: {
            userId: userId,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                userId: true,
                email: true
              }
            }
          },
          orderBy: { date: 'desc' }
        });

        // 日付フォーマット
        data = data.map(record => ({
          ...record,
          date: formatJapanDate(record.date),
          clockTime: record.clockTime ? formatJapanDateTime(record.clockTime) : null
        }));
        break;

      case 'shift':
        data = await prisma.shift.findMany({
          where: {
            userId: userId,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                userId: true,
                email: true
              }
            }
          },
          orderBy: { date: 'desc' }
        });

        // 日付フォーマット
        data = data.map(record => ({
          ...record,
          date: formatJapanDate(record.date),
          startTime: formatJapanDateTime(record.startTime),
          endTime: formatJapanDateTime(record.endTime)
        }));
        break;

      case 'expense':
        data = await prisma.expense.findMany({
          where: {
            userId: userId,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                userId: true,
                email: true
              }
            }
          },
          orderBy: { date: 'desc' }
        });

        // 日付フォーマット
        data = data.map(record => ({
          ...record,
          date: formatJapanDate(record.date)
        }));
        break;
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("一括編集データ取得エラー:", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}