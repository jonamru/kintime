import { prisma } from "@/lib/prisma";
import { createRequestCache, type RequestPermissionCache } from "@/lib/requestCache";

// 権限タイプの定義
export interface Permissions {
  userManagement: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    viewAll: boolean;
    viewAssigned: boolean;
    editAssigned: boolean;
  };
  shiftManagement: {
    approve: boolean;
    edit: boolean;
    delete: boolean;
    viewAll: boolean;
    viewCompany: boolean;
    forceRegister: boolean;
    lockUnlock: boolean;
    viewAssigned: boolean;
    editAssigned: boolean;
  };
  attendanceManagement: {
    viewAll: boolean;
    viewCompany: boolean;
    forceClockInOut: boolean;
    editOthers: boolean;
    viewAssigned: boolean;
    editAssigned: boolean;
  };
  expenseManagement: {
    approve: boolean;
    viewAll: boolean;
    viewCompany: boolean;
    lock: boolean;
    delete: boolean;
    ignoreDeadline: boolean;
    viewAssigned: boolean;
    editAssigned: boolean;
  };
  systemSettings: {
    manageCompany: boolean;
    manageRoles: boolean;
    managePartners: boolean;
  };
}

// ページアクセス権限の定義
export interface PageAccess {
  dashboard: boolean;
  attendance: boolean;
  attendanceHistory: boolean;
  shiftRequest: boolean;
  shiftWorkers: boolean;
  shiftOverview: boolean;
  shiftRegister: boolean;
  shiftLock: boolean;
  expense: boolean;
  expenseMonthly: boolean;
  reports: boolean;
  adminUsers: boolean;
  adminPartners: boolean;
  adminSystem: boolean;
  bulkEdit: boolean;
}

// ユーザーの権限を取得（キャッシュ対応）
export async function getUserPermissions(userId: string, cache?: RequestPermissionCache): Promise<Permissions | null> {
  if (cache) {
    return await cache.getUserPermissions(userId) as Permissions | null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: true },
    });

    if (!user || !user.customRole) return null;

    return user.customRole.permissions as unknown as Permissions;
  } catch (error) {
    console.error("getUserPermissions エラー:", error);
    return null;
  }
}

// ユーザーのページアクセス権限を取得（キャッシュ対応）
export async function getUserPageAccess(userId: string, cache?: RequestPermissionCache): Promise<PageAccess | null> {
  if (cache) {
    return await cache.getUserPageAccess(userId) as PageAccess | null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: true },
    });

    if (!user || !user.customRole) return null;

    return user.customRole.pageAccess as unknown as PageAccess;
  } catch (error) {
    console.error("getUserPageAccess エラー:", error);
    return null;
  }
}

// 特定の権限をチェック（キャッシュ対応）
export async function hasPermission(
  userId: string,
  category: keyof Permissions,
  permission: string,
  cache?: RequestPermissionCache
): Promise<boolean> {
  if (cache) {
    return await cache.hasPermission(userId, category, permission);
  }

  const permissions = await getUserPermissions(userId);
  if (!permissions) return false;

  const categoryPermissions = permissions[category];
  if (!categoryPermissions) return false;

  return categoryPermissions[permission as keyof typeof categoryPermissions] === true;
}

// ページアクセス権限をチェック（キャッシュ対応）
export async function hasPageAccess(userId: string, page: keyof PageAccess, cache?: RequestPermissionCache): Promise<boolean> {
  if (cache) {
    return await cache.hasPageAccess(userId, page);
  }

  const pageAccess = await getUserPageAccess(userId);
  if (!pageAccess) return false;

  return pageAccess[page] === true;
}

// 管理者権限チェック（後方互換性のため）
export async function isAdminCompat(userId: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  if (!permissions) return false;
  
  return permissions.systemSettings.manageCompany || permissions.userManagement.viewAll;
}

/**
 * 交通費の期限制限をチェックする
 * @param expenseDate 交通費の日付（YYYY-MM-DD形式またはDateオブジェクト）
 * @param userId ユーザーID（権限チェック用、オプション）
 * @returns 編集可能かどうか
 */
export async function canEditExpenseByDate(
  expenseDate: string | Date,
  userId?: string
): Promise<boolean> {
  try {
    // ユーザーがignoreDeadline権限を持っている場合は常に編集可能
    if (userId && await hasPermission(userId, 'expenseManagement', 'ignoreDeadline')) {
      return true;
    }

    const targetDate = typeof expenseDate === 'string' ? new Date(expenseDate) : expenseDate;
    const today = new Date();
    
    // 日付を日本時間の年月で比較
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    
    // 当月と未来月は常に編集可能
    if (targetYear > todayYear || (targetYear === todayYear && targetMonth >= todayMonth)) {
      return true;
    }
    
    // 過去月の場合、翌月3日までかチェック
    const nextMonth = new Date(targetYear, targetMonth + 1, 3);
    nextMonth.setHours(23, 59, 59, 999); // 3日の23:59:59まで
    
    return today <= nextMonth;
  } catch (error) {
    console.error('Expense date check error:', error);
    return false;
  }
}

// 担当者権限チェック - 特定のユーザーに対する権限があるかチェック
export async function hasPermissionForUser(
  userId: string,
  targetUserId: string,
  category: keyof Permissions,
  permission: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  if (!permissions) return false;

  const categoryPermissions = permissions[category];
  if (!categoryPermissions) return false;

  // 全体権限がある場合
  if (categoryPermissions[permission as keyof typeof categoryPermissions] === true) {
    return true;
  }

  // 担当権限の確認
  const hasViewAssigned = categoryPermissions.viewAssigned === true;
  const hasEditAssigned = categoryPermissions.editAssigned === true;
  
  // 担当権限がある場合、管理者-部下関係をチェック
  if ((permission === 'viewAll' && hasViewAssigned) || 
      (permission === 'editOthers' && hasEditAssigned) ||
      (permission === 'edit' && hasEditAssigned) ||
      (permission === 'delete' && hasEditAssigned)) {
    return await isAssignedUser(userId, targetUserId);
  }

  return false;
}

// 担当ユーザーかどうかをチェック
export async function isAssignedUser(managerId: string, userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { managers: true },
    });

    return user?.managers?.some(manager => manager.id === managerId) || false;
  } catch (error) {
    console.error("isAssignedUser エラー:", error);
    return false;
  }
}

// アクセス可能なユーザーIDを取得（キャッシュ対応）
export async function getAccessibleUserIds(
  userId: string,
  category: keyof Permissions,
  permission: string,
  cache?: RequestPermissionCache
): Promise<string[]> {
  if (cache) {
    return await cache.getAccessibleUserIds(userId, category, permission);
  }

  try {
    const permissions = await getUserPermissions(userId);
    if (!permissions) return [];

    const categoryPermissions = permissions[category];
    if (!categoryPermissions) return [];

    // 全体権限がある場合は全ユーザー
    if (categoryPermissions[permission as keyof typeof categoryPermissions] === true) {
      const allUsers = await prisma.user.findMany({
        select: { id: true },
      });
      return allUsers.map(user => user.id);
    }

    // 会社内権限の確認
    const hasViewCompany = categoryPermissions.viewCompany === true;
    if ((permission === 'viewAll' && hasViewCompany) || 
        (permission === 'editOthers' && hasViewCompany) ||
        (permission === 'edit' && hasViewCompany) ||
        (permission === 'delete' && hasViewCompany)) {
      
      // 現在のユーザーの会社情報を取得
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { partnerId: true },
      });
      
      // partnerIdがnullでも自社として扱う
      const partnerIdCondition = currentUser?.partnerId === undefined ? null : currentUser?.partnerId;
      const companyUsers = await prisma.user.findMany({
        where: { partnerId: partnerIdCondition },
        select: { id: true },
      });
      return companyUsers.map(user => user.id);
    }

    // 担当権限の確認
    const hasViewAssigned = categoryPermissions.viewAssigned === true;
    const hasEditAssigned = categoryPermissions.editAssigned === true;
    
    // viewAll権限がなくても、viewAssigned権限があれば担当ユーザーを返す
    // editOthers権限がなくても、editAssigned権限があれば担当ユーザーを返す
    if ((permission === 'viewAll' && hasViewAssigned) || 
        (permission === 'editOthers' && hasEditAssigned) ||
        (permission === 'edit' && hasEditAssigned) ||
        (permission === 'delete' && hasEditAssigned)) {
      
      const assignedUsers = await prisma.user.findMany({
        where: { 
          managers: {
            some: { id: userId }
          }
        },
        select: { id: true },
      });
      return assignedUsers.map(user => user.id);
    }

    return [];
  } catch (error) {
    console.error("getAccessibleUserIds エラー:", error);
    return [];
  }
}