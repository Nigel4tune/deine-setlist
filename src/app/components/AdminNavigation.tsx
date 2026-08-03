"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/client";

type NavigationMode = "live" | "edit";

const NAVIGATION_MODE_KEY = "admin-navigation-mode";

export default function AdminNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [navigationMode, setNavigationMode] =
    useState<NavigationMode>("live");

  useEffect(() => {
    const isEditPage =
      pathname.startsWith("/admin/songs") ||
      pathname.startsWith("/admin/qr") ||
      pathname.startsWith("/admin/band") ||
      pathname.startsWith("/archive");

    /*
     * Wenn gerade eine Verwaltungsseite geöffnet ist,
     * wird automatisch die passende Navigation angezeigt.
     */
    if (isEditPage) {
      setNavigationMode("edit");
      localStorage.setItem(NAVIGATION_MODE_KEY, "edit");
      return;
    }

    const savedMode = localStorage.getItem(
      NAVIGATION_MODE_KEY,
    );

    if (savedMode === "edit" || savedMode === "live") {
      setNavigationMode(savedMode);
    }
  }, [pathname]);

  function switchNavigationMode(
    newMode: NavigationMode,
  ) {
    setNavigationMode(newMode);
    localStorage.setItem(NAVIGATION_MODE_KEY, newMode);
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    localStorage.removeItem(NAVIGATION_MODE_KEY);

    router.replace("/admin-login");
    router.refresh();
  }

  const isLiveMode = navigationMode === "live";

  return (
    <nav className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        {isLiveMode ? (
          <>
            <Link
              href="/admin"
              className={`rounded-2xl px-5 py-3 font-bold transition ${
                pathname === "/admin"
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              🎤 Konzertmodus
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

            <button
              type="button"
              onClick={() => switchNavigationMode("edit")}
              className="rounded-2xl border border-white/10 bg-zinc-800 px-5 py-3 font-bold text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
              title="Verwaltung öffnen"
            >
              Weiter
            </button>
          </>
        ) : (
          <>
            <Link
              href="/admin/songs"
              className={`rounded-2xl px-5 py-3 font-bold transition ${
                pathname.startsWith("/admin/songs")
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              🎵 Songverwaltung
            </Link>

            <Link
              href="/archive"
              className={`rounded-2xl px-5 py-3 font-bold transition ${
                pathname.startsWith("/archive")
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              📊 Analytics
            </Link>

            <Link
              href="/admin/qr"
              className={`rounded-2xl px-5 py-3 font-bold transition ${
                pathname.startsWith("/admin/qr")
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              📱 QR-Code
            </Link>

            <Link
              href="/admin/band"
              className={`rounded-2xl px-5 py-3 font-bold transition ${
                pathname.startsWith("/admin/band")
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              👥 Bandverwaltung
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl bg-zinc-800 px-5 py-3 font-bold text-zinc-300 transition hover:bg-red-600 hover:text-white"
            >
              🚪 Abmelden
            </button>

            <button
              type="button"
              onClick={() => switchNavigationMode("live")}
              className="rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-3 font-bold text-red-200 transition hover:bg-red-600 hover:text-white"
              title="Live-Navigation öffnen"
            >
              Zurück
            </button>
          </>
        )}
      </div>
    </nav>
  );
}