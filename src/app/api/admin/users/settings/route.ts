import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { userId, gpsEnabled, wakeUpEnabled, departureEnabled, defaultLocation } = await request.json();

    // ユーザー設定を更新
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(gpsEnabled !== undefined && { gpsEnabled }),
        ...(wakeUpEnabled !== undefined && { wakeUpEnabled }),
        ...(departureEnabled !== undefined && { departureEnabled }),
        ...(defaultLocation !== undefined && { defaultLocation }),
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("ユーザー設定更新エラー:", error);
    return NextResponse.json(
      { error: "ユーザー設定の更新に失敗しました" },
      { status: 500 }
    );
  }
}