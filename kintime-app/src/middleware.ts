import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // 管理者のみアクセス可能なパス
    if (path.startsWith("/admin") && 
        token?.role !== "SUPER_ADMIN" && 
        token?.role !== "MANAGER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // パートナー管理者のみアクセス可能なパス
    if (path.startsWith("/partner") && 
        token?.role !== "PARTNER_MANAGER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/partner/:path*",
    "/attendance/:path*",
    "/shift/:path*",
    "/expense/:path*",
  ],
};