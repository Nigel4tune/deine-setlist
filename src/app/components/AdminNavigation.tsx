"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NavigationMode = "live" | "edit";

const BOTTOM_NAV_COLLAPSED_KEY =
  "admin-bottom-navigation-collapsed";

function getNavigationMode(
  pathname: string,
): NavigationMode {
  const isLivePage =
    pathname === "/admin" ||
    pathname.startsWith("/admin/setlist") ||
    pathname.startsWith("/admin/qr");

  return isLivePage ? "live" : "edit";
}

export default function AdminNavigation() {
  const pathname = usePathname();

  const [
    isBottomNavigationCollapsed,
    setIsBottomNavigationCollapsed,
  ] = useState(false);

  const navigationMode = getNavigationMode(pathname);
  const isLiveMode = navigationMode === "live";

  const isBandInfoArea =
    pathname.startsWith("/admin/bandinfo") ||
    pathname.startsWith("/admin/band");

  useEffect(() => {
    const savedValue = localStorage.getItem(
      BOTTOM_NAV_COLLAPSED_KEY,
    );

    setIsBottomNavigationCollapsed(
      savedValue === "true",
    );
  }, []);

  function toggleBottomNavigation() {
    setIsBottomNavigationCollapsed(
      (currentValue) => {
        const nextValue = !currentValue;

        localStorage.setItem(
          BOTTOM_NAV_COLLAPSED_KEY,
          String(nextValue),
        );

        return nextValue;
      },
    );
  }

  return (
    <>
      <nav className="mb-1">
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
                  pathname.startsWith("/admin/setlist")
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                📋 Setlist
              </Link>
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
  href="/admin/voting"
  className={`rounded-2xl px-5 py-3 font-bold transition ${
    pathname.startsWith("/admin/voting")
      ? "bg-red-600 text-white"
      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
  }`}
>
  🗳️ Votingregeln
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
                href="/admin/bandinfo"
                className={`rounded-2xl px-5 py-3 font-bold transition ${
                  isBandInfoArea
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                🌐 Bandinfos
              </Link>

              <Link
                href="/admin/account"
                className={`rounded-2xl px-5 py-3 font-bold transition ${
                  pathname.startsWith("/admin/account")
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                👤 Konto
              </Link>
            </>
          )}
        </div>

        {!isLiveMode && isBandInfoArea && (
          <div className="mt-4 flex w-fit rounded-2xl bg-zinc-900 p-1">
            <Link
              href="/admin/bandinfo"
              className={`rounded-xl px-4 py-3 font-bold transition ${
                pathname.startsWith("/admin/bandinfo")
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              Bandinfos
            </Link>

            <Link
              href="/admin/band"
              className={`rounded-xl px-4 py-3 font-bold transition ${
                pathname === "/admin/band"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              Bandmitglieder
            </Link>
          </div>
        )}
      </nav>

      <div
        className={
          isBottomNavigationCollapsed
            ? "h-16"
            : "h-24"
        }
        aria-hidden="true"
      />

      {isBottomNavigationCollapsed ? (
        <button
          type="button"
          onClick={toggleBottomNavigation}
          className="fixed bottom-3 left-1/2 z-50 flex h-11 -translate-x-1/2 items-center justify-center rounded-full bg-black px-5 font-black text-zinc-300 shadow-2xl transition hover:bg-zinc-800 hover:text-white"
          aria-label="Live- und Edit-Navigation einblenden"
          title="Navigation einblenden"
        >
          ▲
        </button>
      ) : (
        <nav className="fixed inset-x-0 bottom-0 z-50 bg-black py-2 shadow-2xl">
          <div className="mx-auto flex max-w-xl items-center gap-2 px-3">
            <Link
              href="/admin"
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                isLiveMode
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <span>🎤</span>
              <span>Live</span>
            </Link>

            <Link
              href="/admin/songs"
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                !isLiveMode
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <span>✏️</span>
              <span>Edit</span>
            </Link>

            <button
              type="button"
              onClick={toggleBottomNavigation}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              aria-label="Live- und Edit-Navigation ausblenden"
              title="Navigation ausblenden"
            >
              ▼
            </button>
          </div>
        </nav>
      )}
    </>
  );
}