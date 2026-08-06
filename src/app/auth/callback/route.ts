import { NextResponse } from "next/server";
import { createClient } from "../../lib/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const requestedNext =
    requestUrl.searchParams.get("next");

  const nextPath =
    requestedNext?.startsWith("/")
      ? requestedNext
      : "/admin";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/admin-login?error=missing-code",
        requestUrl.origin,
      ),
    );
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "Auth-Code konnte nicht eingelöst werden:",
      error,
    );

    return NextResponse.redirect(
      new URL(
        "/admin-login?error=callback",
        requestUrl.origin,
      ),
    );
  }

  return NextResponse.redirect(
    new URL(nextPath, requestUrl.origin),
  );
}