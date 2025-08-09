import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { JWT_SECRET_STRING } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードは必須です" },
        { status: 400 }
      );
    }

    // ユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // パスワードを検証
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24時間
    });

    return response;
  } catch (error) {
    console.error("ログインエラー:", error);
    return NextResponse.json(
      { error: "ログインに失敗しました" },
      { status: 500 }
    );
  }
}