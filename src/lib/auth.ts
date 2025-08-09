import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminCompat } from "@/lib/permissions";

import { JWT_SECRET_STRING } from "@/lib/jwt";

export interface AuthUser {
  id: string;
  userId?: string;
  email: string;
  name: string;
  customRole: {
    id: string;
    name: string;
    displayName: string;
    permissions: any;
    pageAccess: any;
  };
  partnerId?: string;
  partner?: {
    id: string;
    name: string;
  };
  gpsEnabled: boolean;
  wakeUpEnabled: boolean;
  departureEnabled: boolean;
  defaultLocation?: string;
}

// ユーザーキャッシュ（5分間）
const userCache = new Map<string, { user: AuthUser; expiry: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分

export async function getCurrentUser(request: NextRequest | Request): Promise<AuthUser | null> {
  try {
    // クッキーからトークンを取得
    let token: string | undefined;
    
    if ('cookies' in request) {
      // NextRequest の場合
      token = request.cookies.get("auth-token")?.value;
    } else {
      // Request の場合
      const cookieHeader = request.headers.get("cookie");
      token = cookieHeader
        ?.split("; ")
        .find((row) => row.startsWith("auth-token="))
        ?.split("=")[1];
    }

    if (!token) {
      return null;
    }

    // トークンを検証
    const decoded = jwt.verify(token, JWT_SECRET_STRING) as any;
    const userId = decoded.userId;
    
    // キャッシュから取得を試行
    const cacheKey = `user:${userId}`;
    const cached = userCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && cached.expiry > now) {
      return cached.user;
    }
    
    // キャッシュにないまたは期限切れの場合、DBから取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
          },
        },
        customRole: {
          select: {
            id: true,
            name: true,
            displayName: true,
            permissions: true,
            pageAccess: true,
          },
        },
      },
    });

    if (!user || !user.customRole) {
      return null;
    }

    const authUser: AuthUser = {
      id: user.id,
      userId: user.userId || undefined,
      email: user.email,
      name: user.name,
      customRole: user.customRole,
      partnerId: user.partnerId || undefined,
      partner: user.partner || undefined,
      gpsEnabled: user.gpsEnabled,
      wakeUpEnabled: user.wakeUpEnabled,
      departureEnabled: user.departureEnabled,
      defaultLocation: user.defaultLocation || undefined,
    };
    
    // キャッシュに保存
    userCache.set(cacheKey, {
      user: authUser,
      expiry: now + CACHE_DURATION
    });
    
    return authUser;
  } catch (error) {
    console.error("認証エラー:", error);
    return null;
  }
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET_STRING);
  } catch (error) {
    return null;
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  return await isAdminCompat(userId);
}

export function canAccessPartnerData(userRole: string, userPartnerId?: string, targetPartnerId?: string): boolean {
  // スーパー管理者は全てのデータにアクセス可能
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }
  
  // マネージャーは自社のデータのみアクセス可能
  if (userRole === 'MANAGER') {
    return !targetPartnerId || userPartnerId === targetPartnerId;
  }
  
  // パートナー管理者は自社のデータのみアクセス可能
  if (userRole === 'PARTNER_MANAGER') {
    return userPartnerId === targetPartnerId;
  }
  
  // スタッフは自分のデータのみアクセス可能
  return false;
}