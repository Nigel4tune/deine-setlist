import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const adminCookie = request.cookies.get("admin");

  if (!adminCookie || adminCookie.value !== "true") {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};