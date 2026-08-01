"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/client";

export default function AdminNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/admin-login");
    router.refresh();
  }

  return (
    <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin"
          className={`rounded-2xl px-5 py-3 font-bold transition ${pathname === "/admin"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
        >
          🎤 Konzertsteuerung
        </Link>

        <Link
          href="/admin/setlist"
          className={`rounded-2xl px-5 py-3 font-bold transition ${pathname === "/admin/setlist"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
        >
          📋 Setlist
        </Link>

        <Link
          href="/admin/songs"
          className={`rounded-2xl px-5 py-3 font-bold transition ${pathname === "/admin/songs"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
        >
          🎵 Songverwaltung
        </Link>
        
        <Link
          href="/archive"
          className={`rounded-2xl px-5 py-3 font-bold transition ${pathname.startsWith("/archive")
              ? "bg-red-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
        >
          📊 Analytics
        </Link>
      </div>

      <Link
        href="/admin/qr"
        className={`rounded-2xl px-5 py-3 font-bold transition ${pathname === "/admin/qr"
          ? "bg-red-600 text-white"
          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
      >
        📱 QR-Code
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="rounded-2xl bg-zinc-800 px-5 py-3 font-bold text-zinc-300 transition hover:bg-red-600 hover:text-white"
      >
        🚪 Abmelden
      </button>
    </nav>
  );
}