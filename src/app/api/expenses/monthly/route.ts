import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, hasPermissionForUser, getAccessibleUserIds } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    console.log("=== 月次経費取得API開始 ===");
    
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '');
    const month = parseInt(searchParams.get('month') || '');
    const userId = searchParams.get('userId');

    console.log("パラメータ:", { year, month, userId });

    if (!year || !month) {
      return NextResponse.json({ error: "年月が指定されていません" }, { status: 400 });
    }

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 経費閲覧権限をチェック
    const canViewAll = await hasPermission(currentUser.id, "expenseManagement", "viewAll");
    const canViewCompany = await hasPermission(currentUser.id, "expenseManagement", "viewCompany");
    const accessibleUserIds = await getAccessibleUserIds(currentUser.id, "expenseManagement", "viewAll");
    console.log("全経費閲覧権限:", canViewAll, "会社内閲覧権限:", canViewCompany, "担当ユーザー数:", accessibleUserIds.length);

    // 権限チェック
    let targetUserId = userId;
    if (userId) {
      // 特定ユーザーが指定された場合
      if (!canViewAll) {
        const canViewUser = await hasPermissionForUser(currentUser.id, userId, "expenseManagement", "viewAll");
        
        // 会社内権限がある場合は同じ会社のユーザーかチェック
        let canViewCompanyUser = false;
        if (canViewCompany) {
          const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true }
          });
          canViewCompanyUser = targetUser?.partnerId === currentUser.partnerId;
        }
        
        if (!canViewUser && !canViewCompanyUser && userId !== currentUser.id) {
          return NextResponse.json({ error: "このユーザーの経費を閲覧する権限がありません" }, { status: 403 });
        }
      }
    } else {
      // ユーザー指定がない場合
      if (!canViewAll && !canViewCompany) {
        if (accessibleUserIds.length === 0) {
          // 担当権限もない場合は自分のみ
          targetUserId = currentUser.id;
        }
        // 担当権限がある場合は後でフィルタリング
      }
    }

    // 月の開始日と終了日を計算
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    console.log("検索期間:", { startDate, endDate, targetUserId });

    // 基本のクエリ条件
    const whereCondition: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // ユーザーフィルタリング
    if (targetUserId) {
      whereCondition.userId = targetUserId;
    } else if (!canViewAll) {
      if (canViewCompany) {
        // 会社内権限がある場合は同じ会社のユーザーの経費を取得
        const partnerIdCondition = currentUser.partnerId === undefined ? null : currentUser.partnerId;
        const companyUsers = await prisma.user.findMany({
          where: { partnerId: partnerIdCondition }, // nullでも自社として扱う
          select: { id: true },
        });
        const companyUserIds = companyUsers.map(user => user.id);
        whereCondition.userId = { in: companyUserIds };
        console.log("会社内権限による経費取得対象ユーザー (partnerId=" + partnerIdCondition + "):", companyUserIds);
      } else if (accessibleUserIds.length > 0) {
        // 担当権限がある場合は担当ユーザーと自分の経費を取得
        whereCondition.userId = { in: [...accessibleUserIds, currentUser.id] };
      }
    }

    const expenses = await prisma.expense.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            userId: true,
          },
        },
        locker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    console.log(`取得した経費件数: ${expenses.length}`);

    // 合計金額を計算（全ての種別を含める）
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    console.log("月次合計:", total);
    console.log("=== 月次経費取得API完了 ===");

    return NextResponse.json({
      expenses,
      total,
      year,
      month,
      userId: targetUserId,
    });
  } catch (error) {
    console.error("月次経費取得エラー:", error);
    console.error("エラー詳細:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "月次経費の取得に失敗しました", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}