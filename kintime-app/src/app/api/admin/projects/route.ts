import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("プロジェクト取得エラー:", error);
    return NextResponse.json(
      { error: "プロジェクトの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, client, location, description, contractPrice, paymentPrice } = await request.json();

    const project = await prisma.project.create({
      data: {
        name,
        client,
        location,
        description,
        contractPrice: contractPrice ? parseFloat(contractPrice) : null,
        paymentPrice: paymentPrice ? parseFloat(paymentPrice) : null,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("プロジェクト作成エラー:", error);
    return NextResponse.json(
      { error: "プロジェクトの作成に失敗しました" },
      { status: 500 }
    );
  }
}