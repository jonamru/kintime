import { prisma } from "@/lib/prisma";
import { type RequestPermissionCache } from "@/lib/requestCache";

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

// New simplified permission format types
export type PermissionScope = 'self' | 'assigned' | 'company' | 'all';
export type PermissionLevel = 'none' | 'view' | 'edit' | 'admin';

export interface SimplifiedCategoryPermission {
  scope: PermissionScope;
  level: PermissionLevel;
}

// Helper to check if permissions use new format
export function isNewPermissionFormat(categoryPermissions: unknown): categoryPermissions is SimplifiedCategoryPermission {
  if (!categoryPermissions || typeof categoryPermissions !== 'object') return false;
  const cp = categoryPermissions as Record<string, unknown>;
  return 'scope' in cp && 'level' in cp;
}

// Convert scope to accessible level
const SCOPE_HIERARCHY: PermissionScope[] = ['self', 'assigned', 'company', 'all'];
const LEVEL_HIERARCHY: PermissionLevel[] = ['none', 'view', 'edit', 'admin'];

export function scopeIncludes(userScope: PermissionScope, requiredScope: PermissionScope): boolean {
  return SCOPE_HIERARCHY.indexOf(userScope) >= SCOPE_HIERARCHY.indexOf(requiredScope);
}

export function levelIncludes(userLevel: PermissionLevel, requiredLevel: PermissionLevel): boolean {
  return LEVEL_HIERARCHY.indexOf(userLevel) >= LEVEL_HIERARCHY.indexOf(requiredLevel);
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
  expenseLock: boolean;
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
  } catch (error: unknown) {
    console.error("getUserPermissions エラー:", error);
    return null;
  }
}

// ユーザーのページアクセス権限を取得（キャッシュ対応）
export async function getUserPageAccess(userId: string, cache?: RequestPermissionCache): Promise<PageAccess | null> {
  if (cache) {
    return await cache.getUserPageAccess(userId) as unknown as PageAccess | null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: true },
    });

    if (!user || !user.customRole) return null;

    return user.customRole.pageAccess as unknown as PageAccess;
  } catch (error: unknown) {
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
  if (!permissions) {
    console.log(`[Permission Debug] No permissions found for user ${userId}`);
    return false;
  }

  const categoryPermissions = permissions[category];
  if (!categoryPermissions) {
    console.log(`[Permission Debug] Category ${String(category)} not found in permissions`);
    return false;
  }

  // Debug log
  console.log(`[Permission Debug] Checking ${String(category)}.${permission} for user ${userId}. Data:`, JSON.stringify(categoryPermissions));

  // Check if using new scope/level format
  if (isNewPermissionFormat(categoryPermissions)) {
    const { scope, level } = categoryPermissions;
    console.log(`[Permission Debug] New format detected. Scope: ${scope}, Level: ${level}`);

    // Determine required level based on permission being checked
    const requiredLevel: PermissionLevel =
      permission === 'viewAll' || permission === 'viewCompany' || permission === 'viewAssigned' ? 'view' :
        permission === 'edit' || permission === 'editOthers' || permission === 'editAssigned' || permission === 'create' ? 'edit' :
          (permission === 'lock' && category === 'expenseManagement') ? 'edit' :
            (permission === 'lockUnlock' && category === 'shiftManagement') ? 'edit' :
              permission === 'approve' || permission === 'delete' || permission === 'lock' || permission === 'forceRegister' || permission === 'lockUnlock' || permission === 'forceClockInOut' || permission === 'ignoreDeadline' ? 'admin' : 'view';

    console.log(`[Permission Debug] Required level: ${requiredLevel}`);

    // Check if level is sufficient
    if (!levelIncludes(level, requiredLevel)) {
      console.log(`[Permission Debug] Level insufficient. Has ${level}, needs ${requiredLevel}`);
      return false;
    }

    // For "viewAll" permission specifically, check if scope is 'all'
    // For other permissions, just return true if level is sufficient (scope is checked elsewhere)
    if (permission === 'viewAll') {
      return scope === 'all';
    }
    if (permission === 'viewCompany') {
      return scope === 'all' || scope === 'company';
    }
    if (permission === 'viewAssigned') {
      return scope === 'all' || scope === 'company' || scope === 'assigned';
    }

    // For edit/admin permissions, return true if level is sufficient (scope logic handled in other functions or implied)
    // Wait, strictly speaking, edit permissions also depend on scope. 
    // But currently getAccessibleUserIds handles scope for edit actions (finding targets).
    // Here we just return true if *capable* of editing *something* (at required level).
    return true;
  }

  console.log(`[Permission Debug] Legacy format check for ${permission}`);

  // Legacy format: check boolean value
  return (categoryPermissions as Record<string, boolean>)[permission] === true;
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

    if (today <= nextMonth) {
      return true;
    }

    // 期限切れの場合、個別のロック解除を確認
    if (userId) {
      const lockRecord = await prisma.expenseRegistrationLock.findUnique({
        where: {
          userId_year_month: {
            userId,
            year: targetYear,
            month: targetMonth + 1, // Prisma stores 1-based month? No, I defined `month: Int`.
            // User usually sees 1-12. Date.getMonth() is 0-11.
            // In API route I treated month param as 1-based.
            // If expenseDate is Jan (0), we store month=1.
          }
        }
      });

      if (lockRecord && lockRecord.isUnlocked) {
        return true;
      }
    }

    return false;
  } catch (error: unknown) {
    console.error('Expense date check error:', error);
    return false;
  }
}

// 担当者権限チェック - 特定のユーザーに対する権限があるかチェック
export async function hasPermissionForUser(
  userId: string,
  targetUserId: string,
  category: keyof Permissions,
  permission: string,
  cache?: RequestPermissionCache
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, cache);
  if (!permissions) return false;

  const categoryPermissions = permissions[category];
  if (!categoryPermissions) return false;

  // Check if using new scope/level format
  if (isNewPermissionFormat(categoryPermissions)) {
    const { scope, level } = categoryPermissions;

    // Determine required level
    const requiredLevel: PermissionLevel =
      permission === 'viewAll' || permission === 'viewCompany' || permission === 'viewAssigned' ? 'view' :
        permission === 'edit' || permission === 'editOthers' || permission === 'editAssigned' ? 'edit' :
          permission === 'approve' || permission === 'delete' || permission === 'lock' ? 'admin' : 'view';

    if (!levelIncludes(level, requiredLevel)) {
      return false;
    }

    // Check scope
    switch (scope) {
      case 'all':
        return true;
      case 'company':
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { partnerId: true },
        });
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { partnerId: true },
        });
        return currentUser?.partnerId === targetUser?.partnerId;
      case 'assigned':
        return await isAssignedUser(userId, targetUserId) || userId === targetUserId;
      case 'self':
      default:
        return userId === targetUserId;
    }
  }

  // Legacy format handling
  // 全体権限がある場合
  if ((categoryPermissions as Record<string, boolean>)[permission] === true) {
    return true;
  }

  // 担当権限の確認
  const hasViewAssigned = (categoryPermissions as Record<string, boolean>).viewAssigned === true;
  const hasEditAssigned = (categoryPermissions as Record<string, boolean>).editAssigned === true;

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
  } catch (error: unknown) {
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

    // Check if using new scope/level format
    if (isNewPermissionFormat(categoryPermissions)) {
      const { scope, level } = categoryPermissions;

      // Check if permission level is sufficient
      const requiredLevel: PermissionLevel =
        permission === 'viewAll' || permission === 'viewCompany' || permission === 'viewAssigned' ? 'view' :
          permission === 'edit' || permission === 'editOthers' || permission === 'editAssigned' ? 'edit' :
            permission === 'approve' || permission === 'delete' || permission === 'lock' ? 'admin' : 'view';

      if (!levelIncludes(level, requiredLevel)) {
        return [userId]; // Return only self if level insufficient
      }

      // Return users based on scope
      switch (scope) {
        case 'all':
          const allUsers = await prisma.user.findMany({ select: { id: true } });
          return allUsers.map(user => user.id);

        case 'company':
          const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true },
          });
          const partnerIdCondition = currentUser?.partnerId === undefined ? null : currentUser?.partnerId;
          const companyUsers = await prisma.user.findMany({
            where: { partnerId: partnerIdCondition },
            select: { id: true },
          });
          return companyUsers.map(user => user.id);

        case 'assigned':
          const assignedUsers = await prisma.user.findMany({
            where: { managers: { some: { id: userId } } },
            select: { id: true },
          });
          // Include self in assigned users
          const assignedIds = assignedUsers.map(user => user.id);
          if (!assignedIds.includes(userId)) assignedIds.push(userId);
          return assignedIds;

        case 'self':
        default:
          return [userId];
      }
    }

    // Legacy format handling (old checkbox-based permissions)
    // 全体権限がある場合は全ユーザー
    if ((categoryPermissions as Record<string, boolean>)[permission] === true) {
      const allUsers = await prisma.user.findMany({
        select: { id: true },
      });
      return allUsers.map(user => user.id);
    }

    // 会社内権限の確認
    const hasViewCompany = (categoryPermissions as Record<string, boolean>).viewCompany === true;
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
    const hasViewAssigned = (categoryPermissions as Record<string, boolean>).viewAssigned === true;
    const hasEditAssigned = (categoryPermissions as Record<string, boolean>).editAssigned === true;

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
  } catch (error: unknown) {
    console.error("getAccessibleUserIds エラー:", error);
    return [];
  }
}