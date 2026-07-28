import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD fehlt." },
      { status: 500 }
    );
  }

  const { password } = await request.json();

  if (password !== adminPassword) {
    return NextResponse.json(
      { error: "Falsches Passwort." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("admin", "true", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}