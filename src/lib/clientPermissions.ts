import { AuthUser } from "@/lib/auth";
import { Permissions, PageAccess } from "@/lib/permissions";

// クライアントサイドでの権限チェック関数
export function hasUserPermission(
  user: AuthUser,
  category: keyof Permissions,
  permission: string
): boolean {
  try {
    // ユーザーが存在しない場合はfalse
    if (!user) return false;

    // カスタムロールがある場合はその権限を使用
    if (user.customRole && user.customRole.permissions) {
      const permissions = user.customRole.permissions as unknown as Permissions;
      const categoryPermissions = permissions[category];
      if (!categoryPermissions) return false;

      // Check if using new scope/level format
      if ('scope' in categoryPermissions && 'level' in categoryPermissions) {
        const cp = categoryPermissions as { scope: string; level: string };
        const scopeHierarchy = ['self', 'assigned', 'company', 'all'];
        const levelHierarchy = ['none', 'view', 'edit', 'admin'];

        // Determine required level based on permission
        const requiredLevel =
          permission === 'viewAll' || permission === 'viewCompany' || permission === 'viewAssigned' ? 'view' :
            permission === 'edit' || permission === 'editOthers' || permission === 'editAssigned' || permission === 'create' ? 'edit' :
              (permission === 'lock' && category === 'expenseManagement') ? 'edit' :
                (permission === 'lockUnlock' && category === 'shiftManagement') ? 'edit' :
                  permission === 'approve' || permission === 'delete' || permission === 'lock' || permission === 'lockUnlock' || permission === 'ignoreDeadline' ? 'admin' : 'view';

        // Check if level is sufficient
        if (levelHierarchy.indexOf(cp.level) < levelHierarchy.indexOf(requiredLevel)) {
          return false;
        }

        // Check scope based on permission requested
        if (permission === 'viewAll') {
          return cp.scope === 'all';
        }
        if (permission === 'viewCompany') {
          return cp.scope === 'all' || cp.scope === 'company';
        }
        if (permission === 'viewAssigned') {
          return scopeHierarchy.indexOf(cp.scope) >= scopeHierarchy.indexOf('assigned');
        }

        // For other permissions (edit, admin, etc.), return true if level is sufficient
        return true;
      }

      // Old format: check boolean value
      return (categoryPermissions as Record<string, boolean>)[permission] === true;
    }
  } catch (error: unknown) {
    console.error('hasUserPermission error:', error);
    return false;
  }

  return false; // カスタムロールがない場合は権限なし
}

// ページアクセス権限をチェック
export function hasUserPageAccess(user: AuthUser, page: keyof PageAccess): boolean {
  try {
    // ユーザーが存在しない場合はfalse
    if (!user) return false;

    // カスタムロールがある場合はその権限を使用
    if (user.customRole && user.customRole.pageAccess) {
      const pageAccess = user.customRole.pageAccess as unknown as PageAccess;
      return pageAccess[page] === true;
    }
  } catch (error: unknown) {
    console.error('hasUserPageAccess error:', error);
    return false;
  }

  return false; // カスタムロールがない場合はページアクセス不可
}

// 担当者権限チェック（クライアントサイド）- 特定のユーザーに対する権限があるかチェック
export function hasUserPermissionForUser(
  user: AuthUser,
  targetUserId: string,
  category: keyof Permissions,
  permission: string
): boolean {
  try {
    // ユーザーが存在しない場合はfalse
    if (!user) return false;

    // 全体権限がある場合
    if (hasUserPermission(user, category, permission)) {
      return true;
    }

    // 担当権限がある場合、管理者-部下関係をチェック
    const assignedPermissionKey = permission.replace('All', 'Assigned').replace('Others', 'Assigned');
    if (hasUserPermission(user, category, assignedPermissionKey)) {
      // クライアントサイドでは管理者IDの確認ができないため、
      // サーバーサイドの確認に依存する必要がある
      return true; // 実際のチェックはAPI側で行う
    }

    return false;
  } catch (error: unknown) {
    console.error('hasUserPermissionForUser error:', error);
    return false;
  }
}

// 管理者権限のチェック（既存のコードとの互換性）
export function isUserAdmin(user: AuthUser): boolean {
  try {
    // ユーザーが存在しない場合はfalse
    if (!user) return false;

    // カスタムロールがある場合は、カスタムロールの権限のみを使用
    if (user.customRole) {
      return hasUserPermission(user, 'userManagement', 'viewAll') ||
        hasUserPermission(user, 'systemSettings', 'manageCompany');
    }

    // カスタムロールがない場合は管理者権限なし
    return false;
  } catch (error: unknown) {
    console.error('isUserAdmin error:', error);
    return false;
  }
}

// 管理者として担当者を持てるかどうかをチェック（担当権限も含む）
export function canBeManager(user: AuthUser): boolean {
  try {
    // ユーザーが存在しない場合はfalse
    if (!user) return false;

    // カスタムロールがある場合
    if (user.customRole) {
      // 全体権限がある場合
      if (hasUserPermission(user, 'userManagement', 'viewAll') ||
        hasUserPermission(user, 'userManagement', 'editOthers') ||
        hasUserPermission(user, 'systemSettings', 'manageCompany')) {
        return true;
      }

      // 会社内権限がある場合
      if (hasUserPermission(user, 'shiftManagement', 'viewCompany') ||
        hasUserPermission(user, 'attendanceManagement', 'viewCompany') ||
        hasUserPermission(user, 'expenseManagement', 'viewCompany')) {
        return true;
      }

      // 担当者権限がある場合
      if (hasUserPermission(user, 'userManagement', 'viewAssigned') ||
        hasUserPermission(user, 'userManagement', 'editAssigned')) {
        return true;
      }
    }

    return false;
  } catch (error: unknown) {
    console.error('canBeManager error:', error);
    return false;
  }
}