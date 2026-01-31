import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { JWT_SECRET_STRING } from "@/lib/jwt";

import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // loginId（メールアドレスまたはユーザーID）とパスワードを取得
    const { loginId, password } = await request.json();

    if (!loginId || !password) {
      return NextResponse.json(
        { error: "ログインIDとパスワードは必須です" },
        { status: 400 }
      );
    }

    // ユーザーを検索 (メールアドレス または ユーザーID)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginId.toLowerCase() },
          { userId: loginId }
        ]
      },
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
            rank: true,
          },
        },
      },
    });

    if (!user) {
      logger.warn('AUTH', 'Login failed: User not found', { loginId, ip, userAgent });
      return NextResponse.json(
        { error: "ログインIDまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // アカウントが無効化されているかチェック
    if (user.isActive === false) {
      logger.warn('AUTH', 'Login blocked: Account inactive', { userId: user.id, loginId, ip });
      return NextResponse.json(
        { error: "アカウントが無効化されています" },
        { status: 403 }
      );
    }

    // パスワードを検証
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('AUTH', 'Login failed: Invalid password', { userId: user.id, loginId, ip, userAgent });
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // JWTトークンを生成
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.customRole?.name || "",
        partnerId: user.partnerId,
      },
      JWT_SECRET_STRING,
      { expiresIn: "24h" }
    );

    // ログイン成功ログ
    logger.info('AUTH', 'Login successful', { userId: user.id, loginId, ip, userAgent });

    // レスポンスにクッキーを設定
    const response = NextResponse.json({
      message: "ログインしました",
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.customRole?.name || "",
        partnerId: user.partnerId,
        partner: user.partner,
        gpsEnabled: user.gpsEnabled,
        wakeUpEnabled: user.wakeUpEnabled,
        departureEnabled: user.departureEnabled,
        defaultLocation: user.defaultLocation,
      },
    });

    // HTTPOnlyクッキーとしてトークンを設定
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // 本番環境ではHTTPSのみ
      sameSite: "strict", // CSRF対策強化
      maxAge: 24 * 60 * 60, // 24時間
      path: "/", // 全パスで有効
    });

    return response;
  } catch (error) {
    console.error("ログインエラー:", error);
    logger.error('AUTH', 'Login error occurred', { error: String(error), ip });
    return NextResponse.json(
      { error: "ログインに失敗しました" },
      { status: 500 }
    );
  }
}