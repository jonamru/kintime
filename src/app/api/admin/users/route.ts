import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, getAccessibleUserIds } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    console.log("admin/users API が呼ばれました");
    
    // ページネーションパラメータを取得
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const skip = (page - 1) * limit;
    
    console.log("ページネーションパラメータ:", { page, limit, search, skip });
    
    const currentUser = await getCurrentUser(request as any);
    console.log("現在のユーザー:", currentUser?.name, "partnerId:", currentUser?.partnerId);
    console.log("現在のユーザーの権限:", currentUser?.customRole?.permissions);
    
    if (!currentUser) {
      console.log("認証エラー: ユーザーが見つかりません");
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 複数の権限を一括チェック（N+1問題を回避）
    console.log("権限チェック開始...");
    
    // 全ての必要な権限を一度に取得
    const [
      hasUserManagementPermission,
      hasShiftManagementPermission, 
      hasExpenseManagementPermission,
      hasUserManagementAssignedPermission,
      hasShiftManagementAssignedPermission,
      hasExpenseManagementAssignedPermission,
      hasShiftManagementCompanyPermission,
      hasAttendanceManagementCompanyPermission,
      hasExpenseManagementCompanyPermission
    ] = await Promise.all([
      hasPermission(currentUser.id, "userManagement", "viewAll"),
      hasPermission(currentUser.id, "shiftManagement", "viewAll"),
      hasPermission(currentUser.id, "expenseManagement", "viewAll"),
      hasPermission(currentUser.id, "userManagement", "viewAssigned"),
      hasPermission(currentUser.id, "shiftManagement", "viewAssigned"),
      hasPermission(currentUser.id, "expenseManagement", "viewAssigned"),
      hasPermission(currentUser.id, "shiftManagement", "viewCompany"),
      hasPermission(currentUser.id, "attendanceManagement", "viewCompany"),
      hasPermission(currentUser.id, "expenseManagement", "viewCompany")
    ]);
    
    console.log("ユーザー管理権限:", hasUserManagementPermission);
    console.log("シフト管理権限:", hasShiftManagementPermission);
    console.log("経費管理権限:", hasExpenseManagementPermission);
    console.log("ユーザー管理担当者権限:", hasUserManagementAssignedPermission);
    console.log("シフト管理担当者権限:", hasShiftManagementAssignedPermission);
    console.log("経費管理担当者権限:", hasExpenseManagementAssignedPermission);
    console.log("シフト管理会社内権限:", hasShiftManagementCompanyPermission);
    console.log("勤怠管理会社内権限:", hasAttendanceManagementCompanyPermission);
    console.log("経費管理会社内権限:", hasExpenseManagementCompanyPermission);
    
    // いずれかの管理権限（全体、会社内、または担当者）があればOK
    const hasAnyManagementPermission = hasUserManagementPermission || hasShiftManagementPermission || hasExpenseManagementPermission ||
                                       hasUserManagementAssignedPermission || hasShiftManagementAssignedPermission || hasExpenseManagementAssignedPermission ||
                                       hasShiftManagementCompanyPermission || hasAttendanceManagementCompanyPermission || hasExpenseManagementCompanyPermission;
    
    if (!hasAnyManagementPermission) {
      // 管理権限がない場合は自分の情報のみ返す
      console.log("管理権限がないため、自分の情報のみ返します");
      const selfOnly = [currentUser];
      return NextResponse.json({ users: selfOnly });
    }
    
    // アクセス可能なユーザーIDを取得
    let accessibleUserIds: string[] = [];
    
    console.log("アクセス可能ユーザー取得の条件分岐開始");
    if (hasUserManagementPermission) {
      console.log("分岐1: ユーザー管理全体権限");
      // 全体権限がある場合は全ユーザーを取得
      accessibleUserIds = await getAccessibleUserIds(currentUser.id, "userManagement", "viewAll");
    } else if (hasUserManagementAssignedPermission) {
      console.log("分岐2: ユーザー管理担当者権限");
      // 担当者権限がある場合は担当ユーザーのみ
      accessibleUserIds = await getAccessibleUserIds(currentUser.id, "userManagement", "viewAll");
    } else if (hasShiftManagementCompanyPermission || hasAttendanceManagementCompanyPermission || hasExpenseManagementCompanyPermission) {
      console.log("分岐3: 会社内権限");
      // 会社内権限がある場合は同じ会社のユーザーのみ
      // 現在のユーザーの会社のユーザーIDを直接取得
      // undefinedをnullに変換してPrismaで正しく処理されるようにする
      const partnerIdCondition = currentUser.partnerId === undefined ? null : currentUser.partnerId;
      console.log("Prismaクエリに使用するpartnerId:", partnerIdCondition);
      
      const companyUsers = await prisma.user.findMany({
        where: { partnerId: partnerIdCondition }, // nullの場合は自社ユーザー
        select: { id: true },
      });
      accessibleUserIds = companyUsers.map(user => user.id);
      console.log("会社内権限による取得ユーザー (partnerId=" + partnerIdCondition + "):", accessibleUserIds);
    } else {
      console.log("分岐4: 権限なし");
    }
    
    console.log("アクセス可能なユーザーID:", accessibleUserIds);
    
    // デバッグ: 現在のユーザーの担当者関係を確認
    const currentUserWithManagers = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { 
        managers: true,
        managedUsers: true 
      }
    });
    console.log("現在のユーザーの管理者:", currentUserWithManagers?.managers);
    console.log("現在のユーザーが管理している部下:", currentUserWithManagers?.managedUsers);
    
    // クエリ条件を設定
    const whereCondition: any = {};
    
    // ユーザー管理の全体閲覧権限がない場合はアクセス可能なユーザーのみ取得
    if (!hasUserManagementPermission) {
      if (accessibleUserIds.length > 0) {
        console.log("制限された権限により、特定のユーザーのみ取得:", accessibleUserIds);
        whereCondition.id = { in: accessibleUserIds };
      } else {
        console.log("担当者が設定されていないため、アクセス可能なユーザーなし");
        // アクセス可能なユーザーが無い場合、シフト・経費管理権限があれば全ユーザー取得
        // （管理権限チェックは上で済んでいる）
        if (hasShiftManagementPermission || hasExpenseManagementPermission || 
            hasShiftManagementAssignedPermission || hasExpenseManagementAssignedPermission ||
            hasShiftManagementCompanyPermission || hasAttendanceManagementCompanyPermission || hasExpenseManagementCompanyPermission) {
          console.log("シフト・経費・勤怠管理権限があるため、全ユーザー取得");
          // 全ユーザー取得（whereConditionを空のまま）
        } else if (hasUserManagementAssignedPermission) {
          console.log("ユーザー管理担当者権限があるが、担当者が未設定のため、自分の情報のみ");
          whereCondition.id = { in: [currentUser.id] };
        } else {
          console.log("管理権限がないため、自分の情報のみ");
          whereCondition.id = { in: [currentUser.id] };
        }
      }
    } else {
      console.log("ユーザー管理の全体権限があるため、全ユーザー取得");
    }
    
    // 検索条件を追加
    if (search) {
      whereCondition.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { userId: { contains: search } }
      ];
    }
    
    console.log("最終的なクエリ条件:", JSON.stringify(whereCondition, null, 2));
    console.log("権限まとめ:", {
      hasUserManagementPermission,
      hasUserManagementAssignedPermission,
      hasShiftManagementCompanyPermission,
      hasAttendanceManagementCompanyPermission,
      hasExpenseManagementCompanyPermission
    });
    
    console.log("クエリ条件:", whereCondition);
    console.log("データベースクエリを実行中...");
    
    // 総件数を取得（ページネーション用）
    const totalCount = await prisma.user.count({
      where: whereCondition,
    });
    
    // フィールド選択パラメータを取得
    const fields = url.searchParams.get('fields')?.split(',') || [];
    const includeDetails = url.searchParams.get('details') === 'true';
    
    // 基本フィールド（常に含める）
    const baseSelect = {
      id: true,
      userId: true,
      name: true,
      email: true,
    };
    
    // 詳細情報（リクエストに応じて含める）
    const detailSelect = includeDetails ? {
      partnerId: true,
      customRoleId: true,
      gpsEnabled: true,
      wakeUpEnabled: true,
      departureEnabled: true,
      defaultLocation: true,
      createdAt: true,
      updatedAt: true,
      partner: {
        select: {
          id: true,
          name: true,
          userIdPrefix: true,
        }
      },
      managers: {
        select: {
          id: true,
          name: true,
        }
      },
      customRole: {
        select: {
          id: true,
          name: true,
          displayName: true,
        }
      },
    } : {};

    const users = await prisma.user.findMany({
      where: whereCondition,
      skip,
      take: limit,
      select: {
        ...baseSelect,
        ...detailSelect,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(`取得したユーザー数: ${users.length} / 総件数: ${totalCount}`);
    console.log("取得したユーザー:", users.map(u => ({ id: u.id, name: u.name, partnerId: u.partnerId, defaultLocation: u.defaultLocation })));
    
    // デバッグ: 各ユーザーの詳細情報
    for (const user of users) {
      const isSameCompany = user.partnerId === currentUser.partnerId;
      console.log(`ユーザー ${user.name}: partnerId=${user.partnerId}, 同じ会社=${isSameCompany}`);
    }
    
    // ページネーション情報を含めてレスポンス
    const totalPages = Math.ceil(totalCount / limit);
    
    return NextResponse.json({ 
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("ユーザー取得エラー:", error);
    console.error("エラーのスタックトレース:", error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { 
        error: "ユーザーの取得に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}