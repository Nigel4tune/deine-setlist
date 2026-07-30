"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getActiveConcertId } from "../lib/concert";

type VoteRow = {
  song_id: number;
  song_title: string;
  artist: string;
};

type SetlistItemRow = {
  id: number;
  song_id: number | null;
  assigned_song_id: number | null;
  is_played: boolean;
  played_at: string | null;
};

type CurrentSongRow = {
  song_id: number | null;
  song_title: string | null;
  artist: string | null;
  updated_at: string | null;
};

type SongResult = {
  songId: number;
  songTitle: string;
  artist: string;
  votes: number;
  isPlayed: boolean;
  playedAt: string | null;
};

export default function LivePage() {
  const [songs, setSongs] = useState<SongResult[]>([]);
  const [currentSong, setCurrentSong] = useState<CurrentSongRow | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

const loadLiveResults = useCallback(async () => {
  setErrorMessage("");

  try {
    const concertId = await getActiveConcertId();

    const [
      votesResponse,
      setlistItemsResponse,
      currentSongResponse,
    ] = await Promise.all([
      supabase
        .from("votes")
        .select("song_id, song_title, artist")
        .eq("concert_id", concertId),

      supabase
        .from("setlist_items")
        .select(
          "id, song_id, assigned_song_id, is_played, played_at",
        ),

      supabase
        .from("current_song")
        .select("song_id, song_title, artist, updated_at")
        .eq("concert_id", concertId)
        .maybeSingle(),
    ]);

    if (votesResponse.error) {
      console.error(
        "Fehler beim Laden der Stimmen:",
        votesResponse.error,
      );

      setErrorMessage(
        "Die Live-Ergebnisse konnten gerade nicht geladen werden.",
      );

      setLoading(false);
      return;
    }

    if (setlistItemsResponse.error) {
      console.error(
        "Fehler beim Laden der Setlist-Einträge:",
        setlistItemsResponse.error,
      );

      setErrorMessage(
        "Die gespielten Songs konnten gerade nicht geladen werden.",
      );

      setLoading(false);
      return;
    }

    if (currentSongResponse.error) {
      console.error(
        "Fehler beim Laden des aktuellen Songs:",
        currentSongResponse.error,
      );

      setErrorMessage(
        "Der aktuelle Song konnte gerade nicht geladen werden.",
      );

      setLoading(false);
      return;
    }

    const setlistItemBySongId = new Map<
      number,
      {
        isPlayed: boolean;
        playedAt: string | null;
      }
    >();

    (
      setlistItemsResponse.data as SetlistItemRow[]
    ).forEach((item) => {
      const status = {
        isPlayed: item.is_played,
        playedAt: item.played_at,
      };

      if (item.song_id !== null) {
        setlistItemBySongId.set(item.song_id, status);
      }

      if (item.assigned_song_id !== null) {
        setlistItemBySongId.set(
          item.assigned_song_id,
          status,
        );
      }
    });

    const groupedSongs = new Map<number, SongResult>();

    (votesResponse.data as VoteRow[]).forEach((vote) => {
      const existingSong = groupedSongs.get(vote.song_id);

      if (existingSong) {
        existingSong.votes += 1;
        return;
      }

      const setlistItem =
        setlistItemBySongId.get(vote.song_id);

      groupedSongs.set(vote.song_id, {
        songId: vote.song_id,
        songTitle: vote.song_title,
        artist: vote.artist,
        votes: 1,
        isPlayed: setlistItem?.isPlayed ?? false,
        playedAt: setlistItem?.playedAt ?? null,
      });
    });

    const sortedSongs = Array.from(
      groupedSongs.values(),
    ).sort((a, b) => {
      if (a.isPlayed !== b.isPlayed) {
        return a.isPlayed ? 1 : -1;
      }

      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }

      return a.songTitle.localeCompare(
        b.songTitle,
        "de",
      );
    });

    setSongs(sortedSongs);

    setCurrentSong(
      currentSongResponse.data
        ? (currentSongResponse.data as CurrentSongRow)
        : null,
    );

    setLastUpdated(new Date());
    setLoading(false);
  } catch (error) {
    console.error(
      "Unerwarteter Fehler beim Laden der Live-Seite:",
      error,
    );

    setErrorMessage(
      "Die Live-Ergebnisse konnten gerade nicht geladen werden.",
    );

    setLoading(false);
  }
}, []);

  useEffect(() => {
    loadLiveResults();

    const intervalId = window.setInterval(() => {
      loadLiveResults();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadLiveResults]);

  const openSongs = useMemo(() => {
    return songs.filter(
      (song) =>
        !song.isPlayed && song.songId !== currentSong?.song_id,
    );
  }, [songs, currentSong]);

  const playedSongs = useMemo(() => {
    return songs
      .filter((song) => song.isPlayed)
      .sort((a, b) => {
        const timeA = a.playedAt
          ? new Date(a.playedAt).getTime()
          : 0;

        const timeB = b.playedAt
          ? new Date(b.playedAt).getTime()
          : 0;

        return timeB - timeA;
      });
  }, [songs]);

  const topSongs = openSongs.slice(0, 3);

  function getPositionIcon(index: number) {
    if (index === 0) {
      return "🥇";
    }

    if (index === 1) {
      return "🥈";
    }

    return "🥉";
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-red-500">
            Deine Setlist
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Live vom Konzert
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Ihr bestimmt mit, welche Songs heute auf der Bühne
            landen.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-950/30 px-4 py-2 text-xs font-bold text-green-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Live
          </div>
        </header>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-center text-red-200">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900/80 p-10 text-center text-zinc-400">
            Live-Ergebnisse werden geladen …
          </div>
        ) : (
          <>
            {currentSong?.song_id &&
            currentSong.song_title &&
            currentSong.artist ? (
              <section className="mt-10">
                <article className="overflow-hidden rounded-[2rem] border border-red-500/60 bg-gradient-to-br from-red-950 via-zinc-900 to-black p-8 text-center shadow-2xl shadow-red-950/40 sm:p-12">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-500/40 bg-red-600/20 text-4xl">
                    🎤
                  </div>

                  <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-red-400">
                    Jetzt auf der Bühne
                  </p>

                  <h2 className="mt-4 text-4xl font-black sm:text-6xl">
                    {currentSong.song_title}
                  </h2>

                  <p className="mt-3 text-xl font-bold text-zinc-300 sm:text-2xl">
                    {currentSong.artist}
                  </p>

                  <div className="mx-auto mt-8 h-1 w-24 rounded-full bg-red-600" />
                </article>
              </section>
            ) : (
              <section className="mt-10 rounded-3xl border border-white/10 bg-zinc-900/80 p-8 text-center">
                <p className="text-xl font-black">
                  Gleich geht es weiter
                </p>

                <p className="mt-2 text-zinc-400">
                  Der nächste Song wird gleich bekannt gegeben.
                </p>
              </section>
            )}

            <section className="mt-12">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-zinc-500">
                  Publikumslieblinge
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  Eure nächsten Favoriten
                </h2>

                <p className="mt-2 text-sm text-zinc-400">
                  Die Stimmenzahlen bleiben geheim.
                </p>
              </div>

              {topSongs.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/80 p-8 text-center">
                  <p className="text-xl font-black">
                    Noch keine offenen Wünsche
                  </p>

                  <p className="mt-2 text-zinc-400">
                    Stimmt für eure Lieblingssongs ab.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {topSongs.map((song, index) => (
                    <article
                      key={song.songId}
                      className={`rounded-3xl border p-6 shadow-xl ${
                        index === 0
                          ? "border-red-500/40 bg-gradient-to-r from-red-950/60 to-zinc-900"
                          : "border-white/10 bg-zinc-900/80"
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-3xl">
                          {getPositionIcon(index)}
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate text-2xl font-black sm:text-3xl">
                            {song.songTitle}
                          </h3>

                          <p className="mt-1 truncate text-zinc-400">
                            {song.artist}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {playedSongs.length > 0 && (
              <section className="mt-12">
                <div className="mb-4">
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-zinc-500">
                    Schon gespielt
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Das war bereits dabei
                  </h2>
                </div>

                <div className="space-y-3">
                  {playedSongs.map((song) => (
                    <article
                      key={song.songId}
                      className="flex items-center gap-4 rounded-2xl border border-white/5 bg-zinc-950/60 px-5 py-4 text-zinc-500"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-950/50 font-black text-green-500">
                        ✓
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-black text-zinc-300">
                          {song.songTitle}
                        </h3>

                        <p className="truncate text-sm">
                          {song.artist}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
          <p>
            Die Anzeige wird automatisch alle 5 Sekunden
            aktualisiert.
          </p>

          {lastUpdated && (
            <p className="mt-2">
              Stand:{" "}
              {lastUpdated.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </footer>
      </div>
    </main>
  );
}