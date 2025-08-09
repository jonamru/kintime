import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

import { JWT_SECRET_STRING } from "@/lib/jwt";
import { getUserPermissions, getUserPageAccess } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    // クッキーからトークンを取得
    const cookieHeader = request.headers.get("cookie");
    const token = cookieHeader
      ?.split("; ")
      .find((row) => row.startsWith("auth-token="))
      ?.split("=")[1];

    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    // トークンを検証
    const decoded = jwt.verify(token, JWT_SECRET_STRING) as any;
    
    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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

    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // ユーザーの権限を取得
    const permissions = await getUserPermissions(user.id);
    const pageAccess = await getUserPageAccess(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        customRole: user.customRole,
        partnerId: user.partnerId,
        partner: user.partner,
        gpsEnabled: user.gpsEnabled,
        wakeUpEnabled: user.wakeUpEnabled,
        departureEnabled: user.departureEnabled,
        defaultLocation: user.defaultLocation,
      },
      permissions: permissions,
      pageAccess: pageAccess,
    });
  } catch (error) {
    console.error("認証エラー:", error);
    return NextResponse.json(
      { error: "認証に失敗しました" },
      { status: 401 }
    );
  }
}