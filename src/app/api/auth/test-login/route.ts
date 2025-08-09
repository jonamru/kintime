import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // ユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
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
      return NextResponse.json({
        error: "ユーザーが見つかりません",
        email,
      }, { status: 404 });
    }

    // パスワードチェック
    const isHashedPassword = user.password.startsWith('$2');
    let isPasswordValid = false;

    if (isHashedPassword) {
      // ハッシュ化されたパスワードの場合
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      // 平文パスワードの場合（開発環境のみ）
      isPasswordValid = password === user.password;
    }

    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        role: user.customRole?.name || "",
      },
      passwordCheck: {
        isHashedPassword,
        isPasswordValid,
        passwordLength: user.password.length,
        passwordPrefix: user.password.substring(0, 10) + '...',
      },
      debug: {
        providedPassword: password,
        providedEmail: email,
      }
    });
  } catch (error) {
    console.error("テストログインエラー:", error);
    return NextResponse.json(
      { error: "テストログインに失敗しました" },
      { status: 500 }
    );
  }
}