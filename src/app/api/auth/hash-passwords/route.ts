import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    // セキュリティのため、特定のキーが必要
    const { secretKey } = await request.json();
    
    if (secretKey !== "hash-all-passwords-2024") {
      return NextResponse.json({ error: "Invalid secret key" }, { status: 403 });
    }

    // すべてのユーザーを取得
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        password: true,
      },
    });

    let hashedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // すでにハッシュ化されているかチェック（bcryptハッシュは$2で始まる）
      if (user.password.startsWith('$2')) {
        skippedCount++;
        continue;
      }

      // パスワードをハッシュ化
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // データベースを更新
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      hashedCount++;
      console.log(`Hashed password for user: ${user.email}`);
    }

    return NextResponse.json({
      message: "パスワードのハッシュ化が完了しました",
      hashedCount,
      skippedCount,
      totalUsers: users.length,
    });
  } catch (error) {
    console.error("パスワードハッシュ化エラー:", error);
    return NextResponse.json(
      { error: "パスワードのハッシュ化に失敗しました" },
      { status: 500 }
    );
  }
}