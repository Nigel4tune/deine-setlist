"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminNavigation from "../../../components/AdminNavigation";
import { getActiveBandId } from "../../../lib/band";
import { supabase } from "../../../lib/supabase";

type SavedSetlist = {
  id: number;
  name: string;
  created_at: string;
};

type SavedSetlistItem = {
  id: number;
  position: number;
  item_type: string;
  song_id: number | null;
  request_number: number | null;
};

type Song = {
  id: number;
  title: string;
  artist: string;
};

export default function SavedSetlistPage() {
  const params = useParams<{ id: string }>();

  const savedSetlistId = Number(params.id);

  const [savedSetlist, setSavedSetlist] =
    useState<SavedSetlist | null>(null);

  const [items, setItems] = useState<
    SavedSetlistItem[]
  >([]);

  const [songs, setSongs] = useState<Song[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadSavedSetlist() {
      if (
        !Number.isInteger(savedSetlistId) ||
        savedSetlistId <= 0
      ) {
        setErrorMessage(
          "Die Setlist-ID ist ungültig.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const activeBandId =
          await getActiveBandId();

        const [
          setlistResponse,
          itemsResponse,
        ] = await Promise.all([
          supabase
            .from("saved_setlists")
            .select("id, name, created_at")
            .eq("id", savedSetlistId)
            .eq("band_id", activeBandId)
            .maybeSingle(),

          supabase
            .from("saved_setlist_items")
            .select(
              "id, position, item_type, song_id, request_number",
            )
            .eq(
              "saved_setlist_id",
              savedSetlistId,
            )
            .eq("band_id", activeBandId)
            .order("position", {
              ascending: true,
            }),
        ]);

        if (setlistResponse.error) {
          throw new Error(
            `Setlist konnte nicht geladen werden: ${setlistResponse.error.message}`,
          );
        }

        if (!setlistResponse.data) {
          setErrorMessage(
            "Diese gespeicherte Setlist wurde nicht gefunden.",
          );
          return;
        }

        if (itemsResponse.error) {
          throw new Error(
            `Setlist-Einträge konnten nicht geladen werden: ${itemsResponse.error.message}`,
          );
        }

        const loadedItems =
          (itemsResponse.data ??
            []) as SavedSetlistItem[];

        const songIds = Array.from(
          new Set(
            loadedItems
              .map((item) => item.song_id)
              .filter(
                (songId): songId is number =>
                  typeof songId === "number",
              ),
          ),
        );

        let loadedSongs: Song[] = [];

        if (songIds.length > 0) {
          const songsResponse =
            await supabase
              .from("songs")
              .select("id, title, artist")
              .eq("band_id", activeBandId)
              .in("id", songIds);

          if (songsResponse.error) {
            throw new Error(
              `Songs konnten nicht geladen werden: ${songsResponse.error.message}`,
            );
          }

          loadedSongs =
            (songsResponse.data ??
              []) as Song[];
        }

        setSavedSetlist(
          setlistResponse.data as SavedSetlist,
        );

        setItems(loadedItems);
        setSongs(loadedSongs);
      } catch (error) {
        console.error(
          "Gespeicherte Setlist konnte nicht geladen werden:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Die gespeicherte Setlist konnte nicht geladen werden.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadSavedSetlist();
  }, [savedSetlistId]);

  function getSong(
    songId: number | null,
  ): Song | undefined {
    if (songId === null) {
      return undefined;
    }

    return songs.find(
      (song) => song.id === songId,
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-4 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="print:hidden">
          <AdminNavigation />
        </div>

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900/80 p-10 text-center text-zinc-400">
            Gespeicherte Setlist wird geladen …
          </div>
        ) : errorMessage ? (
          <section className="mt-8 rounded-3xl border border-red-500/30 bg-red-950/20 p-8 text-center">
            <div className="text-5xl">
              ⚠️
            </div>

            <h1 className="mt-5 text-3xl font-black">
              Setlist nicht verfügbar
            </h1>

            <p className="mt-4 text-red-200">
              {errorMessage}
            </p>

            <Link
              href="/archive"
              className="mt-6 inline-flex rounded-xl bg-zinc-800 px-5 py-3 font-bold transition hover:bg-zinc-700"
            >
              ← Zurück zum Archiv
            </Link>
          </section>
        ) : savedSetlist ? (
          <>
            <header className="print-header">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-red-500">
                DEINE SETLIST
              </p>

              <h1 className="mt-2 text-4xl font-black sm:text-6xl">
                {savedSetlist.name}
              </h1>

              <p className="mt-3 text-zinc-400">
                Gespeichert am{" "}
                {new Date(
                  savedSetlist.created_at,
                ).toLocaleString("de-DE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>

              <div className="mt-5 flex flex-wrap gap-3 print:hidden">
                <Link
                  href="/archive"
                  className="inline-flex rounded-xl bg-zinc-800 px-4 py-3 font-bold transition hover:bg-zinc-700"
                >
                  ← Zurück zum Archiv
                </Link>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex rounded-xl bg-red-600 px-4 py-3 font-black text-white transition hover:bg-red-500"
                >
                  🖨️ Drucken / als PDF speichern
                </button>
              </div>
            </header>

            <section className="print-setlist mt-8 rounded-3xl border border-white/10 bg-zinc-900/80 p-6 sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-2xl font-black">
                  Setlist
                </h2>

                <span className="text-sm text-zinc-500">
                  {items.length}{" "}
                  {items.length === 1
                    ? "Eintrag"
                    : "Einträge"}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="mt-6 text-zinc-400">
                  Diese Setlist enthält keine
                  Einträge.
                </p>
              ) : (
                <ol className="mt-6 space-y-3">
                  {items.map((item, index) => {
                    const song = getSong(
                      item.song_id,
                    );

                    const isRequest =
                      item.item_type ===
                      "request";

                    return (
                      <li
                        key={item.id}
                        className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 p-5"
                      >
                        <div className="w-9 shrink-0 text-lg font-black text-red-400">
                          {index + 1}.
                        </div>

                        <div className="min-w-0 flex-1">
                          {song ? (
                            <>
                              <h3 className="font-black">
                                {song.title}
                              </h3>

                              <p className="mt-1 text-sm text-zinc-400">
                                {song.artist}
                              </p>
                            </>
                          ) : isRequest ? (
                            <>
                              <h3 className="font-black">
                                Wunschsong{" "}
                                {item.request_number ??
                                  ""}
                              </h3>

                              <p className="mt-1 text-sm text-zinc-400">
                                Publikumswunsch
                              </p>
                            </>
                          ) : (
                            <>
                              <h3 className="font-black">
                                Song nicht verfügbar
                              </h3>

                              <p className="mt-1 text-sm text-zinc-500">
                                Dieser Song ist nicht
                                mehr in der
                                Songverwaltung
                                vorhanden.
                              </p>
                            </>
                          )}

                          {isRequest && (
                            <span className="mt-3 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                              Wunschsong
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          html,
          body {
            background: white !important;
          }

          body {
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          main {
            min-height: auto !important;
            background: white !important;
            padding: 0 !important;
            color: black !important;
          }

          main > div {
            max-width: none !important;
          }

          .print-header {
            margin: 0 0 8mm !important;
          }

          .print-header p:first-child {
            color: #b91c1c !important;
          }

          .print-header h1 {
            color: black !important;
            font-size: 28pt !important;
            line-height: 1.1 !important;
          }

          .print-header > p:not(:first-child) {
            color: #52525b !important;
          }

          .print-setlist {
            margin-top: 0 !important;
            border: 0 !important;
            background: white !important;
            padding: 0 !important;
            box-shadow: none !important;
          }

          .print-setlist h2 {
            color: black !important;
          }

          .print-setlist > div > span {
            color: #52525b !important;
          }

          .print-setlist ol {
            margin-top: 5mm !important;
            gap: 0 !important;
          }

          .print-setlist li {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 0 !important;
            border-bottom: 1px solid #d4d4d8 !important;
            border-radius: 0 !important;
            background: white !important;
            padding: 3.5mm 0 !important;
            color: black !important;
          }

          .print-setlist li > div:first-child {
            color: #b91c1c !important;
          }

          .print-setlist li h3 {
            color: black !important;
          }

          .print-setlist li p {
            color: #52525b !important;
          }

          .print-setlist li span {
            border: 1px solid #d4d4d8 !important;
            background: white !important;
            color: #52525b !important;
          }
        }
      `}</style>
    </main>
  );
}