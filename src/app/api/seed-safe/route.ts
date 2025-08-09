import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 既存ユーザーを更新（削除せずに）
    const users = [
      {
        email: "admin@example.com",
        password: "password123",
        name: "システム管理者",
        role: "SUPER_ADMIN",
        gpsEnabled: true,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
      {
        email: "manager@example.com", 
        password: "password123",
        name: "山田太郎",
        role: "MANAGER",
        gpsEnabled: true,
        wakeUpEnabled: false,
        departureEnabled: true,
      },
      {
        email: "partner@example.com",
        password: "password123", 
        name: "パートナー管理者",
        role: "PARTNER_MANAGER",
        gpsEnabled: true,
        wakeUpEnabled: false,
        departureEnabled: false,
      },
      {
        email: "staff@example.com",
        password: "password123",
        name: "鈴木花子", 
        role: "STAFF",
        gpsEnabled: false,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
      {
        email: "partnerstaff@example.com",
        password: "password123",
        name: "佐藤次郎",
        role: "PARTNER_STAFF", 
        gpsEnabled: true,
        wakeUpEnabled: false,
        departureEnabled: false,
      }
    ];

    // パートナー企業が存在しない場合は作成
    let partner = await prisma.partner.findFirst({ where: { name: "パートナー企業A" } });
    if (!partner) {
      partner = await prisma.partner.create({
        data: {
          name: "パートナー企業A",
          userIdPrefix: "PRTA",
        },
      });
    }

    // 各ユーザーを更新または作成
    for (const userData of users) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        // 既存ユーザーを更新
        await prisma.user.update({
          where: { email: userData.email },
          data: {
            gpsEnabled: userData.gpsEnabled,
            wakeUpEnabled: userData.wakeUpEnabled,
            departureEnabled: userData.departureEnabled,
            name: userData.name,
          },
        });
      } else {
        // 新規ユーザーを作成
        await prisma.user.create({
          data: {
            ...userData,
            role: userData.role as any,
            partnerId: userData.role.includes('PARTNER') ? partner.id : null,
          },
        });
      }
    }

    return NextResponse.json({
      message: "ユーザー設定の更新に成功しました",
      users: users.map(u => ({ 
        email: u.email, 
        password: u.password, 
        role: u.role,
        gpsEnabled: u.gpsEnabled,
        wakeUpEnabled: u.wakeUpEnabled,
        departureEnabled: u.departureEnabled
      })),
    });
  } catch (error) {
    console.error("設定更新エラー:", error);
    return NextResponse.json(
      { 
        error: "設定の更新に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}