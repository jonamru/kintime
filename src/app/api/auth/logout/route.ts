import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({
      message: "ログアウトしました",
    });

    // クッキーを削除
    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0, // 即座に削除
    });

    return response;
  } catch (error) {
    console.error("ログアウトエラー:", error);
    return NextResponse.json(
      { error: "ログアウトに失敗しました" },
      { status: 500 }
    );
  }
}