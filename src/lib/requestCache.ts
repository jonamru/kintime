// リクエストレベルでのキャッシュシステム
import { prisma } from './prisma';

export interface CachedPermissions {
  userManagement?: {
    create?: boolean;
    viewAll?: boolean;
    edit?: boolean;
    delete?: boolean;
  };
  shiftManagement?: {
    viewAll?: boolean;
    viewCompany?: boolean;
    viewAssigned?: boolean;
    approve?: boolean;
    edit?: boolean;
    delete?: boolean;
    forceRegister?: boolean;
    lockUnlock?: boolean;
  };
  attendanceManagement?: {
    viewAll?: boolean;
    forceClockInOut?: boolean;
    editOthers?: boolean;
  };
  expenseManagement?: {
    viewAll?: boolean;
    approve?: boolean;
    lockUnlock?: boolean;
    ignoreDeadline?: boolean;
  };
  systemSettings?: {
    manageCompanies?: boolean;
    manageRoles?: boolean;
    managePartners?: boolean;
  };
}

export interface CachedPageAccess {
  [key: string]: boolean;
}

export class RequestPermissionCache {
  private permissionCache = new Map<string, CachedPermissions | null>();
  private pageAccessCache = new Map<string, CachedPageAccess>();
  private userDataCache = new Map<string, any>();

  // ユーザーの権限情報を取得（キャッシュ付き）
  async getUserPermissions(userId: string): Promise<CachedPermissions | null> {
    const cacheKey = `permissions:${userId}`;
    
    if (!this.permissionCache.has(cacheKey)) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            customRole: {
              select: {
                permissions: true
              }
            }
          },
        });
        
        const permissions = user?.customRole?.permissions as CachedPermissions || null;
        this.permissionCache.set(cacheKey, permissions);
      } catch (error) {
        console.error(`権限取得エラー (userId: ${userId}):`, error);
        this.permissionCache.set(cacheKey, null);
      }
    }
    
    return this.permissionCache.get(cacheKey) || null;
  }

  // ユーザーのページアクセス権限を取得（キャッシュ付き）
  async getUserPageAccess(userId: string): Promise<CachedPageAccess> {
    const cacheKey = `pageAccess:${userId}`;
    
    if (!this.pageAccessCache.has(cacheKey)) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            customRole: {
              select: {
                pageAccess: true
              }
            }
          },
        });
        
        const pageAccess = user?.customRole?.pageAccess as CachedPageAccess || {};
        this.pageAccessCache.set(cacheKey, pageAccess);
      } catch (error) {
        console.error(`ページアクセス権限取得エラー (userId: ${userId}):`, error);
        this.pageAccessCache.set(cacheKey, {});
      }
    }
    
    return this.pageAccessCache.get(cacheKey) || {};
  }

  // ユーザーの基本情報を取得（キャッシュ付き）
  async getUserData(userId: string): Promise<any> {
    const cacheKey = `userData:${userId}`;
    
    if (!this.userDataCache.has(cacheKey)) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            partnerId: true,
            customRoleId: true,
            partner: {
              select: {
                id: true,
                name: true
              }
            },
            customRole: {
              select: {
                id: true,
                name: true,
                displayName: true,
                permissions: true,
                pageAccess: true
              }
            }
          },
        });
        
        this.userDataCache.set(cacheKey, user);
      } catch (error) {
        console.error(`ユーザーデータ取得エラー (userId: ${userId}):`, error);
        this.userDataCache.set(cacheKey, null);
      }
    }
    
    return this.userDataCache.get(cacheKey);
  }

  // 特定の権限をチェック
  async hasPermission(
    userId: string, 
    category: keyof CachedPermissions, 
    permission: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    if (!permissions || !permissions[category]) {
      return false;
    }
    
    return (permissions[category] as any)[permission] === true;
  }

  // 特定のページへのアクセス権限をチェック
  async hasPageAccess(userId: string, page: string): Promise<boolean> {
    const pageAccess = await this.getUserPageAccess(userId);
    return pageAccess[page] === true;
  }

  // アクセス可能なユーザーIDリストを取得（企業ベース）
  async getAccessibleUserIds(
    currentUserId: string, 
    category: keyof CachedPermissions, 
    permission: string
  ): Promise<string[]> {
    const cacheKey = `accessibleUsers:${currentUserId}:${category}:${permission}`;
    
    if (!this.userDataCache.has(cacheKey)) {
      try {
        const hasViewAll = await this.hasPermission(currentUserId, category, permission);
        if (hasViewAll) {
          // 全ユーザーアクセス可能
          const allUsers = await prisma.user.findMany({
            select: { id: true }
          });
          const userIds = allUsers.map(u => u.id);
          this.userDataCache.set(cacheKey, userIds);
        } else {
          // 企業内ユーザーのみ
          const currentUser = await this.getUserData(currentUserId);
          if (currentUser?.partnerId) {
            const companyUsers = await prisma.user.findMany({
              where: { partnerId: currentUser.partnerId },
              select: { id: true }
            });
            const userIds = companyUsers.map(u => u.id);
            this.userDataCache.set(cacheKey, userIds);
          } else {
            this.userDataCache.set(cacheKey, []);
          }
        }
      } catch (error) {
        console.error(`アクセス可能ユーザー取得エラー:`, error);
        this.userDataCache.set(cacheKey, []);
      }
    }
    
    return this.userDataCache.get(cacheKey) || [];
  }

  // キャッシュをクリア
  clear(): void {
    this.permissionCache.clear();
    this.pageAccessCache.clear();
    this.userDataCache.clear();
  }

  // 統計情報を取得
  getStats(): { permissionCacheSize: number; pageAccessCacheSize: number; userDataCacheSize: number } {
    return {
      permissionCacheSize: this.permissionCache.size,
      pageAccessCacheSize: this.pageAccessCache.size,
      userDataCacheSize: this.userDataCache.size,
    };
  }
}

// リクエストごとにインスタンスを作成するヘルパー
export function createRequestCache(): RequestPermissionCache {
  return new RequestPermissionCache();
}