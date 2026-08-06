"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminNavigation from "../components/AdminNavigation";
import { supabase } from "../lib/supabase";
import { getActiveBandId } from "../lib/band";


type Concert = {
  id: number;
  name: string;
  created_at: string;
  is_active: boolean;
};

type VoteRow = {
  song_id: number;
  song_title: string;
  artist: string;
};

type RankingSong = {
  songId: number;
  songTitle: string;
  artist: string;
  votes: number;
};

type AnalyticsView = "ranking" | "history";

export default function ArchivePage() {
  const [view, setView] =
    useState<AnalyticsView>("ranking");
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [ranking, setRanking] = useState<RankingSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadArchive();
  }, []);

  async function loadArchive() {
    setLoading(true);
    setErrorMessage("");

    try {
      const activeBandId = await getActiveBandId();

      const concertResponse = await supabase
        .from("concerts")
        .select("id, name, created_at, is_active")
        .eq("band_id", activeBandId)
        .eq("is_active", false)
        .order("created_at", { ascending: false });

      if (concertResponse.error) {
        throw new Error(
          `Vergangene Konzerte konnten nicht geladen werden: ${concertResponse.error.message}`,
        );
      }

      const archivedConcerts =
        (concertResponse.data ?? []) as Concert[];

      setConcerts(archivedConcerts);

      const archivedConcertIds = archivedConcerts.map(
        (concert) => concert.id,
      );

      if (archivedConcertIds.length === 0) {
        setRanking([]);
        return;
      }

      const voteResponse = await supabase
        .from("votes")
        .select("song_id, song_title, artist")
        .eq("band_id", activeBandId)
        .in("concert_id", archivedConcertIds);

      if (voteResponse.error) {
        throw new Error(
          `Ranking konnte nicht geladen werden: ${voteResponse.error.message}`,
        );
      }

      const groupedVotes = new Map<number, RankingSong>();

      (voteResponse.data as VoteRow[] | null)?.forEach(
        (vote) => {
          const existingSong = groupedVotes.get(
            vote.song_id,
          );

          if (existingSong) {
            existingSong.votes += 1;
            return;
          }

          groupedVotes.set(vote.song_id, {
            songId: vote.song_id,
            songTitle: vote.song_title,
            artist: vote.artist,
            votes: 1,
          });
        },
      );

      const topTen = Array.from(groupedVotes.values())
        .sort((firstSong, secondSong) => {
          if (secondSong.votes !== firstSong.votes) {
            return secondSong.votes - firstSong.votes;
          }

          return firstSong.songTitle.localeCompare(
            secondSong.songTitle,
            "de",
          );
        })
        .slice(0, 10);

      setRanking(topTen);
    } catch (error) {
      console.error(
        "Analytics konnten nicht geladen werden:",
        error,
      );

      setConcerts([]);
      setRanking([]);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Die Analytics konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteConcert(concert: Concert) {
    const confirmed = window.confirm(
      `Konzert „${concert.name}“ endgültig löschen?\n\n` +
      "ACHTUNG: Dabei werden auch alle Stimmen dieses Konzerts gelöscht. " +
      "Die Stimmen werden anschließend nicht mehr im Top-Ranking berücksichtigt.\n\n" +
      "Diese Aktion kann nicht rückgängig gemacht werden.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(concert.id);
    setErrorMessage("");

    const {
      data: wasDeleted,
      error: deleteError,
    } = await supabase.rpc("delete_archived_concert", {
      p_concert_id: concert.id,
    });

    if (deleteError) {
      console.error(
        "Konzert konnte nicht gelöscht werden:",
        deleteError.message,
        deleteError.code,
        deleteError.details,
        deleteError.hint,
      );

      setErrorMessage(
        `Das Konzert konnte nicht gelöscht werden: ${deleteError.message}`,
      );

      setDeletingId(null);
      return;
    }

    if (!wasDeleted) {
      setErrorMessage(
        "Das Konzert wurde nicht gefunden oder ist noch aktiv.",
      );

      setDeletingId(null);
      return;
    }

    await loadArchive();
    setDeletingId(null);
  }

  function getPosition(index: number) {
    if (index === 0) {
      return "🥇";
    }

    if (index === 1) {
      return "🥈";
    }

    if (index === 2) {
      return "🥉";
    }

    return `${index + 1}.`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-4 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminNavigation />

        <div className="mb-8">
  <p className="text-sm font-black uppercase tracking-[0.35em] text-red-500">
    DEINE SETLIST
  </p>

  <h1 className="mt-2 text-5xl font-black sm:text-6xl">
    Analytics
  </h1>

  <p className="mt-2 max-w-3xl text-lg text-zinc-400">
    Vergangene Konzerte und die beliebtesten Publikumswünsche im Überblick.
  </p>
</div>

        {errorMessage && (
          <div className="mb-8 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="mb-8 flex justify-center sm:justify-start">
          <div className="inline-flex rounded-2xl border border-white/10 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setView("ranking")}
              className={`rounded-xl px-5 py-3 font-black transition ${view === "ranking"
                ? "bg-red-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
            >
              🏆 Top-Ranking
            </button>

            <button
              type="button"
              onClick={() => setView("history")}
              className={`rounded-xl px-5 py-3 font-black transition ${view === "history"
                ? "bg-red-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
            >
              🕘 History
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-10 text-center text-zinc-400">
            Analytics werden geladen …
          </div>
        ) : view === "ranking" ? (
          <section className="mx-auto max-w-3xl">
            <div className="mb-5">
              <h2 className="text-2xl font-black sm:text-3xl">
                Top 10 Wünsche
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Meistgewählte Songs über alle vergangenen Konzerte
              </p>
            </div>

            {ranking.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-zinc-400">
                Es wurden noch keine Stimmen abgegeben.
              </div>
            ) : (
              <ol className="space-y-3">
                {ranking.map((song, index) => (
                  <li
                    key={song.songId}
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${index === 0
                      ? "border-yellow-400/70 bg-yellow-500/10"
                      : index === 1
                        ? "border-slate-300/60 bg-slate-300/10"
                        : index === 2
                          ? "border-amber-700/70 bg-amber-700/10"
                          : "border-white/10 bg-zinc-900/70"
                      }`}
                  >
                    <div
                      className={`flex w-12 shrink-0 items-center justify-center font-black ${index < 3
                        ? "text-3xl"
                        : "text-lg text-zinc-500"
                        }`}
                    >
                      {getPosition(index)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-black">
                        {song.songTitle}
                      </h3>

                      <p className="truncate text-sm text-zinc-400">
                        {song.artist}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-black text-red-500">
                        {song.votes}
                      </p>

                      <p className="text-xs text-zinc-500">
                        {song.votes === 1
                          ? "Wunsch"
                          : "Wünsche"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : (
          <section className="mx-auto max-w-4xl">
            <div className="mb-5">
              <h2 className="text-2xl font-black sm:text-3xl">
                Vergangene Konzerte
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {concerts.length} beendete{" "}
                {concerts.length === 1
                  ? "Veranstaltung"
                  : "Veranstaltungen"}
              </p>
            </div>

            {concerts.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-zinc-400">
                Es wurden noch keine Konzerte beendet.
              </div>
            ) : (
              <div className="space-y-4">
                {concerts.map((concert) => (
                  <article
                    key={concert.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 p-5 transition hover:border-white/25 sm:flex-row sm:items-center"
                  >
                    <Link
                      href={`/archive/${concert.id}`}
                      className="min-w-0 flex-1"
                    >
                      <h3 className="truncate text-xl font-black">
                        {concert.name}
                      </h3>

                      <p className="mt-1 text-sm text-zinc-500">
                        {new Date(
                          concert.created_at,
                        ).toLocaleString("de-DE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>

                      <p className="mt-3 text-sm font-bold text-red-400">
                        Auswertung ansehen →
                      </p>
                    </Link>

                    <button
                      type="button"
                      onClick={() => deleteConcert(concert)}
                      disabled={deletingId === concert.id}
                      className="shrink-0 rounded-xl bg-red-950 px-4 py-3 font-bold text-red-300 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === concert.id
                        ? "Lösche …"
                        : "🗑 Löschen"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}