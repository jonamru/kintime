import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { formatJapanDate, formatJapanDateTime } from "@/lib/dateUtils";
import { createRequestCache } from "@/lib/requestCache";
import type { User, Attendance, Shift, Expense, CustomRole, Partner, ApiResponse, BulkEditPermissions } from "@/types/common";
import { AttendanceType, ExpenseType } from "@prisma/client";

// 型ガード関数
const isAttendanceType = (value: unknown): value is AttendanceType => {
  return typeof value === 'string' && Object.values(AttendanceType).includes(value as AttendanceType);
};

const isExpenseType = (value: unknown): value is ExpenseType => {
  return typeof value === 'string' && Object.values(ExpenseType).includes(value as ExpenseType);
};

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

    let results: { success: number; failed: number; errors: string[] } | undefined;

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

  } catch (error: unknown) {
    console.error("一括編集エラー:", error);
    return NextResponse.json(
      { error: "一括編集に失敗しました" },
      { status: 500 }
    );
  }
}

async function handleBulkDelete(type: string, recordIds: string[], userId: string, permissions: BulkEditPermissions) {
  const results = { success: 0, failed: 0, errors: [] as string[] };

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
        } catch (error: unknown) {
          results.failed++;
          results.errors.push(`削除失敗 ${recordId}: ${(error as Error).message}`);
        }
      }
    });
  } catch (error: unknown) {
    console.error('一括削除トランザクションエラー:', error);
    results.failed += recordIds.length - results.success;
    results.errors.push(`トランザクションエラー: ${(error as Error).message}`);
  }

  return results;
}

async function handleBulkUpdate(type: string, records: unknown[], userId: string, permissions: BulkEditPermissions) {
  const results = { success: 0, failed: 0, errors: [] as string[] };

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
    interface BulkEditRecord {
      id: string;
      [key: string]: unknown;
    }

    await prisma.$transaction(async (tx) => {
      for (const record of records as BulkEditRecord[]) {
        try {
          switch (type) {
            case 'attendance':
              // 型ガードでAttendanceTypeを検証
              if (record.type && !isAttendanceType(record.type)) {
                throw new Error(`無効な出勤タイプ: ${record.type}`);
              }
              
              await tx.attendance.update({
                where: { id: record.id },
                data: {
                  clockTime: record.clockTime ? new Date(record.clockTime as string) : undefined,
                  type: record.type ? record.type : undefined,
                  // 必要に応じて他のフィールドも追加
                }
              });
              break;

            case 'shift':
              await tx.shift.update({
                where: { id: record.id },
                data: {
                  startTime: record.startTime ? new Date(record.startTime as string) : undefined,
                  endTime: record.endTime ? new Date(record.endTime as string) : undefined,
                  location: record.location as string,
                  breakTime: record.breakTime as number,
                  note: record.note as string,
                  // 必要に応じて他のフィールドも追加
                }
              });
              break;

            case 'expense':
              // 型ガードでExpenseTypeを検証
              if (record.type && !isExpenseType(record.type)) {
                throw new Error(`無効な経費タイプ: ${record.type}`);
              }
              
              await tx.expense.update({
                where: { id: record.id },
                data: {
                  amount: record.amount ? Number(record.amount) : undefined,
                  type: record.type ? record.type : undefined,
                  description: record.description as string | undefined,
                  departure: record.departure as string | undefined,
                  arrival: record.arrival as string | undefined,
                  // 必要に応じて他のフィールドも追加
                }
              });
              break;
          }
          results.success++;
        } catch (error: unknown) {
          results.failed++;
          results.errors.push(`更新失敗 ${record.id}: ${(error as Error).message}`);
        }
      }
    });
  } catch (error: unknown) {
    console.error('一括更新トランザクションエラー:', error);
    results.failed += records.length - results.success;
    results.errors.push(`トランザクションエラー: ${(error as Error).message}`);
  }

  return results;
}

async function handleBulkApprove(type: string, recordIds: string[], userId: string, permissions: BulkEditPermissions) {
  const results = { success: 0, failed: 0, errors: [] as string[] };

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
        } catch (error: unknown) {
          results.failed++;
          results.errors.push(`承認失敗 ${recordId}: ${(error as Error).message}`);
        }
      }
    });
  } catch (error: unknown) {
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

    // フォーマット後のレコードの型を定義
    interface FormattedAttendanceRecord {
      id: string;
      userId: string;
      date: string;
      type: AttendanceType;
      clockTime: string | null;
      latitude: number | null;
      longitude: number | null;
      createdAt: Date;
      updatedAt: Date;
      user?: {
        id: string;
        name: string;
        userId: string;
        email: string;
      };
    }

    interface FormattedShiftRecord {
      id: string;
      userId: string;
      date: string;
      startTime: string | null;
      endTime: string | null;
      shiftType: string;
      location: string | null;
      breakTime: number;
      note: string | null;
      status: string;
      hasAttendance?: boolean;
      user?: {
        id: string;
        name: string;
        userId: string;
        email: string;
      };
    }

    interface FormattedExpenseRecord {
      id: string;
      userId: string;
      date: string;
      type: ExpenseType;
      amount: number;
      description: string | null;
      departure: string | null;
      arrival: string | null;
      route: string | null;
      referenceUrl: string | null;
      status: string;
      comment: string | null;
      user?: {
        id: string;
        name: string;
        userId: string;
        email: string;
      };
    }
    
    let data: FormattedAttendanceRecord[] | FormattedShiftRecord[] | FormattedExpenseRecord[] = [];

    switch (type) {
      case 'attendance':
        const attendanceData = await prisma.attendance.findMany({
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
        data = attendanceData.map(record => ({
          ...record,
          date: formatJapanDate(record.date),
          clockTime: record.clockTime ? formatJapanDateTime(record.clockTime) : null
        })) as FormattedAttendanceRecord[];
        break;

      case 'shift':
        const shiftData = await prisma.shift.findMany({
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
        data = shiftData.map(record => ({
          ...record,
          date: formatJapanDate(record.date),
          startTime: formatJapanDateTime(record.startTime),
          endTime: formatJapanDateTime(record.endTime)
        })) as FormattedShiftRecord[];
        break;

      case 'expense':
        const expenseData = await prisma.expense.findMany({
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
        data = expenseData.map(record => ({
          ...record,
          date: formatJapanDate(record.date)
        })) as FormattedExpenseRecord[];
        break;
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    console.error("一括編集データ取得エラー:", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}