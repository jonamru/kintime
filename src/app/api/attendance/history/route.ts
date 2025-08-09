import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, hasPermissionForUser, getAccessibleUserIds } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '');
    const month = parseInt(searchParams.get('month') || '');
    const userId = searchParams.get('userId');

    if (!year || !month) {
      return NextResponse.json({ error: "年月が指定されていません" }, { status: 400 });
    }

    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    let whereCondition: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // 権限チェック
    const canViewAll = await hasPermission(currentUser.id, "attendanceManagement", "viewAll");
    const canViewCompany = await hasPermission(currentUser.id, "attendanceManagement", "viewCompany");
    const accessibleUserIds = await getAccessibleUserIds(currentUser.id, "attendanceManagement", "viewAll");
    
    if (userId) {
      // 特定ユーザーの履歴を要求した場合
      if (!canViewAll) {
        // 会社内権限または担当権限があるかチェック
        const canViewUser = await hasPermissionForUser(currentUser.id, userId, "attendanceManagement", "viewAll");
        if (!canViewUser && !canViewCompany && userId !== currentUser.id) {
          return NextResponse.json({ error: "このユーザーの勤怠履歴を閲覧する権限がありません" }, { status: 403 });
        }
      }
      whereCondition.userId = userId;
    } else {
      // ユーザー指定がない場合
      if (!canViewAll && !canViewCompany) {
        if (accessibleUserIds.length === 0) {
          // 担当権限もない場合は自分のみ
          whereCondition.userId = currentUser.id;
        } else {
          // 担当権限がある場合は担当ユーザーも含める
          whereCondition.userId = { in: [...accessibleUserIds, currentUser.id] };
        }
      }
    }

    const attendances = await prisma.attendance.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        corrections: {
          include: {
            attendance: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { clockTime: "asc" },
      ],
    });

    return NextResponse.json(attendances);
  } catch (error) {
    console.error("勤怠履歴取得エラー:", error);
    return NextResponse.json(
      { error: "勤怠履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}