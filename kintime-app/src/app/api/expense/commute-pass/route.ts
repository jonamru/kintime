import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const commutePasses = await prisma.commutePass.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        validFrom: "desc",
      },
    });

    return NextResponse.json(commutePasses);
  } catch (error) {
    console.error("定期券取得エラー:", error);
    return NextResponse.json(
      { error: "定期券の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const startStation = formData.get("startStation") as string;
    const endStation = formData.get("endStation") as string;
    const validFrom = formData.get("validFrom") as string;
    const validUntil = formData.get("validUntil") as string;
    const image = formData.get("image") as File | null;

    let imageUrl = null;

    if (image) {
      // アップロードディレクトリを作成
      const uploadDir = path.join(process.cwd(), "public", "uploads", "commute-passes");
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (error) {
        // ディレクトリが既に存在する場合は無視
      }

      // ファイル名を生成
      const fileName = `${session.user.id}-${Date.now()}-${image.name}`;
      const filePath = path.join(uploadDir, fileName);

      // ファイルを保存
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      imageUrl = `/uploads/commute-passes/${fileName}`;
    }

    const commutePass = await prisma.commutePass.create({
      data: {
        userId: session.user.id,
        startStation,
        endStation,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        imageUrl,
      },
    });

    return NextResponse.json(commutePass);
  } catch (error) {
    console.error("定期券作成エラー:", error);
    return NextResponse.json(
      { error: "定期券の作成に失敗しました" },
      { status: 500 }
    );
  }
}