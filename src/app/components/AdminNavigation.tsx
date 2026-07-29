"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-3">
      <Link
        href="/admin"
        className={`rounded-2xl px-5 py-3 font-bold transition ${
          pathname === "/admin"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        }`}
      >
        🎤 Konzertsteuerung
      </Link>

      <Link
        href="/admin/songs"
        className={`rounded-2xl px-5 py-3 font-bold transition ${
          pathname === "/admin/songs"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        }`}
      >
        🎵 Songverwaltung
      </Link>

      <Link
        href="/admin/setlist"
        className={`rounded-2xl px-5 py-3 font-bold transition ${
          pathname === "/admin/setlist"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        }`}
      >
        📋 Setlist
      </Link>
    </nav>
  );
}