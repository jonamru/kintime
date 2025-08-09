import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    // パートナー企業を作成
    const partner1 = await prisma.partner.create({
      data: {
        name: "パートナー企業A",
      },
    });

    // 初期ユーザーを作成
    const hashedPassword = await bcrypt.hash("password123", 10);

    // 全権管理者
    const superAdmin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        password: hashedPassword,
        name: "システム管理者",
        role: "SUPER_ADMIN",
      },
    });

    // 担当別管理者
    const manager = await prisma.user.create({
      data: {
        email: "manager@example.com",
        password: hashedPassword,
        name: "山田太郎",
        role: "MANAGER",
      },
    });

    // パートナー企業管理者
    const partnerManager = await prisma.user.create({
      data: {
        email: "partner@example.com",
        password: hashedPassword,
        name: "パートナー管理者",
        role: "PARTNER_MANAGER",
        partnerId: partner1.id,
      },
    });

    // 自社スタッフ
    const staff = await prisma.user.create({
      data: {
        email: "staff@example.com",
        password: hashedPassword,
        name: "鈴木花子",
        role: "STAFF",
        managerId: manager.id,
      },
    });

    // パートナースタッフ
    const partnerStaff = await prisma.user.create({
      data: {
        email: "partnerstaff@example.com",
        password: hashedPassword,
        name: "佐藤次郎",
        role: "PARTNER_STAFF",
        partnerId: partner1.id,
        managerId: manager.id,
      },
    });

    return NextResponse.json({
      message: "初期データの作成に成功しました",
      users: [
        { email: "admin@example.com", password: "password123", role: "全権管理者" },
        { email: "manager@example.com", password: "password123", role: "担当別管理者" },
        { email: "partner@example.com", password: "password123", role: "パートナー企業管理者" },
        { email: "staff@example.com", password: "password123", role: "自社スタッフ" },
        { email: "partnerstaff@example.com", password: "password123", role: "パートナースタッフ" },
      ],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "初期データの作成に失敗しました" },
      { status: 500 }
    );
  }
}