import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("案件取得エラー:", error);
    return NextResponse.json(
      { error: "案件の取得に失敗しました" },
      { status: 500 }
    );
  }
}