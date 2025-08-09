import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    // テストユーザーの情報
    const testUsers = [
      { email: "admin@example.com", password: "password123" },
      { email: "manager@example.com", password: "password123" },
      { email: "staff@example.com", password: "password123" },
    ];
    
    const results = [];
    
    for (const testUser of testUsers) {
      try {
        // ユーザーが存在するか確認
        const existingUser = await prisma.user.findUnique({
          where: { email: testUser.email },
        });
        
        if (existingUser) {
          // パスワードをハッシュ化
          const hashedPassword = await bcrypt.hash(testUser.password, 10);
          
          // ユーザーを更新
          const updatedUser = await prisma.user.update({
            where: { email: testUser.email },
            data: { password: hashedPassword },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          });
          
          results.push({
            email: testUser.email,
            status: "updated",
            user: updatedUser,
          });
        } else {
          results.push({
            email: testUser.email,
            status: "not_found",
          });
        }
      } catch (error) {
        results.push({
          email: testUser.email,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      message: "テストユーザーのパスワードをリセットしました",
      results,
      note: "すべてのテストユーザーのパスワードは 'password123' です",
    });
  } catch (error) {
    console.error("パスワードリセットエラー:", error);
    return NextResponse.json(
      { error: "パスワードのリセットに失敗しました", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}