import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    // 管理者アカウントのパスワードをリセット
    const adminEmail = "admin@example.com";
    const newPassword = "password123";
    
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // ユーザーを更新
    const updatedUser = await prisma.user.update({
      where: { email: adminEmail },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: "管理者パスワードをリセットしました",
      user: updatedUser,
      newPassword: newPassword,
      note: "このパスワードでログインしてください",
    });
  } catch (error) {
    console.error("パスワードリセットエラー:", error);
    return NextResponse.json(
      { error: "パスワードのリセットに失敗しました", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}