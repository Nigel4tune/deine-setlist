"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveConcertId } from "../lib/concert";
import { supabase } from "../lib/supabase";
import AdminNavigation from "../components/AdminNavigation";

type VoteRow = {
  song_id: number;
  song_title: string;
  artist: string;
};

type PlayedSongRow = {
  song_id: number;
  song_title: string;
  artist: string;
  played_at: string;
};

type VoteResult = {
  songId: number;
  songTitle: string;
  artist: string;
  votes: number;
  isPlayed: boolean;
  playedAt: string | null;
};

export default function AdminPage() {
  const [results, setResults] = useState<VoteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [changingSongId, setChangingSongId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentSongId, setCurrentSongId] = useState<number | null>(
    null,
  );

  const [showNewConcertDialog, setShowNewConcertDialog] =
    useState(false);

  const [newConcertName, setNewConcertName] =
    useState("");
  

  const loadVotes = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsRefreshing(true);
    }

    setErrorMessage("");

    try {
      const concertId = await getActiveConcertId();

      const [
        votesResponse,
        playedSongsResponse,
        currentSongResponse,
      ] = await Promise.all([
        supabase
          .from("votes")
          .select("song_id, song_title, artist")
          .eq("concert_id", concertId),

        supabase
          .from("played_songs")
          .select("song_id, song_title, artist, played_at")
          .eq("concert_id", concertId),

        supabase
          .from("current_song")
          .select("song_id")
          .eq("concert_id", concertId)
          .maybeSingle(),
      ]);

      if (votesResponse.error) {
        console.error(
          "Fehler beim Laden der Stimmen:",
          votesResponse.error,
        );

        setErrorMessage(
          "Die Stimmen konnten nicht geladen werden. Bitte prüfe die Verbindung zu Supabase.",
        );

        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (playedSongsResponse.error) {
        console.error(
          "Fehler beim Laden der gespielten Songs:",
          playedSongsResponse.error,
        );

        setErrorMessage(
          "Der Gespielt-Status konnte nicht geladen werden.",
        );

        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (currentSongResponse.error) {
        console.error(
          "Fehler beim Laden des aktuellen Songs:",
          currentSongResponse.error,
        );

        setErrorMessage(
          "Der aktuell laufende Song konnte nicht geladen werden.",
        );

        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const playedSongs = new Map<number, PlayedSongRow>();

      (playedSongsResponse.data as PlayedSongRow[]).forEach((song) => {
        playedSongs.set(song.song_id, song);
      });

      const groupedVotes = new Map<number, VoteResult>();

      (votesResponse.data as VoteRow[]).forEach((vote) => {
        const existingSong = groupedVotes.get(vote.song_id);
        const playedSong = playedSongs.get(vote.song_id);

        if (existingSong) {
          existingSong.votes += 1;
          return;
        }

        groupedVotes.set(vote.song_id, {
          songId: vote.song_id,
          songTitle: vote.song_title,
          artist: vote.artist,
          votes: 1,
          isPlayed: Boolean(playedSong),
          playedAt: playedSong?.played_at ?? null,
        });
      });

      const sortedResults = Array.from(groupedVotes.values()).sort(
        (a, b) => {
          if (a.isPlayed !== b.isPlayed) {
            return a.isPlayed ? 1 : -1;
          }

          if (b.votes !== a.votes) {
            return b.votes - a.votes;
          }

          return a.songTitle.localeCompare(b.songTitle, "de");
        },
      );

      setCurrentSongId(
        currentSongResponse.data?.song_id ?? null,
      );
      setResults(sortedResults);
      setLastUpdated(new Date());
      setLoading(false);
      setIsRefreshing(false);
    } catch {
      setResults([]);
      setCurrentSongId(null);
      setLastUpdated(null);
      setErrorMessage("");

      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVotes();

    const intervalId = window.setInterval(() => {
      loadVotes();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadVotes]);

  const totalVotes = useMemo(() => {
    return results.reduce(
      (total, song) => total + song.votes,
      0,
    );
  }, [results]);

  const openSongs = useMemo(() => {
    return results.filter((song) => !song.isPlayed);
  }, [results]);

  const playedSongs = useMemo(() => {
    return results.filter((song) => song.isPlayed);
  }, [results]);

  const highestOpenVoteCount = openSongs[0]?.votes ?? 0;

  async function markAsPlayed(song: VoteResult) {
    setChangingSongId(song.songId);
    setErrorMessage("");

    try {
      const concertId = await getActiveConcertId();

      const { error } = await supabase
        .from("played_songs")
        .insert({
          concert_id: concertId,
          song_id: song.songId,
          song_title: song.songTitle,
          artist: song.artist,
        });

      if (error) {
        console.error(
          "Fehler beim Markieren als gespielt:",
          error,
        );

        setErrorMessage(
          "Der Song konnte nicht als gespielt markiert werden.",
        );

        setChangingSongId(null);
        return;
      }

      await loadVotes();
      setChangingSongId(null);
    } catch (error) {
      console.error(
        "Fehler beim Laden des aktiven Konzerts:",
        error,
      );

      setErrorMessage(
        "Der Song konnte keinem aktiven Konzert zugeordnet werden.",
      );

      setChangingSongId(null);
    }
  }

  async function undoPlayed(songId: number) {
    setChangingSongId(songId);
    setErrorMessage("");

    try {
      const concertId = await getActiveConcertId();

      const { error } = await supabase
        .from("played_songs")
        .delete()
        .eq("concert_id", concertId)
        .eq("song_id", songId);

      if (error) {
        console.error(
          "Fehler beim Rückgängigmachen:",
          error,
        );

        setErrorMessage(
          "Der Gespielt-Status konnte nicht rückgängig gemacht werden.",
        );

        setChangingSongId(null);
        return;
      }

      await loadVotes();
      setChangingSongId(null);
    } catch (error) {
      console.error(
        "Fehler beim Laden des aktiven Konzerts:",
        error,
      );

      setErrorMessage(
        "Das aktive Konzert konnte nicht gefunden werden.",
      );

      setChangingSongId(null);
    }
  }

  async function setCurrentSong(song: VoteResult) {
    setChangingSongId(song.songId);
    setErrorMessage("");

    try {
      const concertId = await getActiveConcertId();

      const { error } = await supabase
        .from("current_song")
        .upsert(
          {
            concert_id: concertId,
            song_id: song.songId,
            song_title: song.songTitle,
            artist: song.artist,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "concert_id",
          },
        );

      if (error) {
        console.error(
          "Fehler beim Setzen des aktuellen Songs:",
          error,
        );

        setErrorMessage(
          "Der aktuelle Song konnte nicht gespeichert werden.",
        );

        setChangingSongId(null);
        return;
      }

      setCurrentSongId(song.songId);
      setChangingSongId(null);
    } catch (error) {
      console.error(
        "Fehler beim Laden des aktiven Konzerts:",
        error,
      );

      setErrorMessage(
        "Das aktive Konzert konnte nicht gefunden werden.",
      );

      setChangingSongId(null);
    }
  }

  async function startNewConcert() {
    if (!newConcertName.trim()) {
      alert("Bitte gib einen Konzertnamen ein.");
      return;
    }

    setErrorMessage("");

    try {
      const { error: deactivateError } = await supabase
        .from("concerts")
        .update({
          is_active: false,
        })
        .eq("is_active", true);

      if (deactivateError) {
        console.error(
          "Fehler beim Deaktivieren des alten Konzerts:",
          deactivateError,
        );

        setErrorMessage(
          "Das bisherige Konzert konnte nicht beendet werden.",
        );

        return;
      }

      const { data: newConcert, error: createError } =
        await supabase
          .from("concerts")
          .insert({
            name: newConcertName.trim(),
            is_active: true,
          })
          .select("id")
          .single();

      if (createError || !newConcert) {
        console.error(
          "Fehler beim Erstellen des neuen Konzerts:",
          createError,
        );

        setErrorMessage(
          "Das neue Konzert konnte nicht erstellt werden.",
        );

        return;
      }

      setShowNewConcertDialog(false);
      setNewConcertName("");
      setCurrentSongId(null);

      await loadVotes(true);
    } catch (error) {
      console.error(
        "Fehler beim Starten des neuen Konzerts:",
        error,
      );

      setErrorMessage(
        "Beim Starten des neuen Konzerts ist ein Fehler aufgetreten.",
      );
    }
  }

  function getPositionLabel(index: number) {
    if (index === 0) {
      return "🥇";
    }

    if (index === 1) {
      return "🥈";
    }

    if (index === 2) {
      return "🥉";
    }

    return `#${index + 1}`;
  }

  async function endConcert() {
    const confirmed = window.confirm(
      "Möchtest du das aktuelle Konzert wirklich beenden?",
    );

    if (!confirmed) {
      return;
    }

    const { data: activeConcert, error: concertError } = await supabase
      .from("concerts")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    if (concertError) {
      console.error(
        "Aktives Konzert konnte nicht geladen werden:",
        concertError.message,
      );
      return;
    }

    if (!activeConcert) {
      alert("Es gibt aktuell kein aktives Konzert.");
      return;
    }

    const { error: currentSongError } = await supabase
      .from("current_song")
      .delete()
      .eq("concert_id", activeConcert.id);

    if (currentSongError) {
      console.error(
        "Aktueller Song konnte nicht entfernt werden:",
        currentSongError.message,
      );
      return;
    }

    const { error: updateError } = await supabase
      .from("concerts")
      .update({ is_active: false })
      .eq("id", activeConcert.id);

    if (updateError) {
      console.error(
        "Konzert konnte nicht beendet werden:",
        updateError.message,
      );
      return;
    }

    alert("Das Konzert wurde beendet.");
    window.location.reload();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />
        
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
              Deine Setlist
            </p>

            <h1 className="mt-2 text-4xl font-black sm:text-5xl">
              Konzertmodus
            </h1>

            <p className="mt-3 text-sm text-zinc-400">
              Die Ergebnisse werden automatisch alle 5 Sekunden
              aktualisiert.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowNewConcertDialog(true)}
              className="rounded-2xl bg-green-600 px-6 py-4 font-black transition hover:bg-green-500"
            >
              ➕ Neues Konzert
            </button>

            <button
              onClick={endConcert}
              className="rounded-2xl bg-orange-600 px-6 py-5 text-xl font-bold text-white transition hover:bg-orange-500"
            >
              Konzert beenden
            </button>

          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-4">
          <article className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Gesamtstimmen
            </p>

            <p className="mt-3 text-5xl font-black text-red-500">
              {totalVotes}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Offene Songs
            </p>

            <p className="mt-3 text-5xl font-black">
              {openSongs.length}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Gespielt
            </p>

            <p className="mt-3 text-5xl font-black text-green-500">
              {playedSongs.length}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Aktualisiert
            </p>

            <p className="mt-3 text-xl font-bold">
              {lastUpdated
                ? lastUpdated.toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
                : "Noch nicht geladen"}
            </p>
          </article>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
            {errorMessage}
          </div>
        )}
        
        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black">
                Offene Publikumswünsche
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Songs mit den meisten Stimmen stehen oben.
              </p>
            </div>

            {!loading && (
              <p className="text-sm text-zinc-500">
                {openSongs.length} offen
              </p>
            )}
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-400">
              Stimmen werden geladen …
            </div>
          ) : openSongs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center">
              <p className="text-xl font-bold">
                Keine offenen Wünsche
              </p>

              <p className="mt-2 text-zinc-400">
                Alle gewählten Songs wurden bereits gespielt.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {openSongs.map((song, index) => {
                const barWidth =
                  highestOpenVoteCount > 0
                    ? (song.votes / highestOpenVoteCount) * 100
                    : 0;

                const isTopThree = index < 3;
                const isChanging =
                  changingSongId === song.songId;

                return (
                  <article
                    key={song.songId}
                    className={`overflow-hidden rounded-2xl border p-5 shadow-lg ${isTopThree
                      ? "border-red-500/40 bg-zinc-900"
                      : "border-white/10 bg-zinc-900/70"
                      }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-12 items-center justify-center text-xl font-black">
                        {getPositionLabel(index)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-5">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-black">
                              {song.songTitle}
                            </h3>

                            <p className="mt-1 truncate text-sm text-zinc-400">
                              {song.artist}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-3xl font-black text-red-500">
                              {song.votes}
                            </p>

                            <p className="text-xs text-zinc-500">
                              {song.votes === 1
                                ? "Stimme"
                                : "Stimmen"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-red-600 transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentSong(song)}
                          disabled={isChanging}
                          className={`rounded-xl px-5 py-3 font-black transition ${currentSongId === song.songId
                            ? "bg-blue-700"
                            : "bg-blue-600 hover:bg-blue-500"
                            }`}
                        >
                          {currentSongId === song.songId
                            ? "🎤 Läuft gerade"
                            : "🎤 Jetzt spielen"}
                        </button>

                        <button
                          type="button"
                          onClick={() => markAsPlayed(song)}
                          disabled={isChanging}
                          className="rounded-xl bg-green-600 px-5 py-3 font-black transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                        >
                          {isChanging
                            ? "Wird gespeichert …"
                            : "✓ Gespielt"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {playedSongs.length > 0 && (
          <section className="mt-12">
            <div className="mb-4">
              <h2 className="text-2xl font-black text-zinc-400">
                Bereits gespielt
              </h2>

              <p className="mt-1 text-sm text-zinc-600">
                Diese Songs bleiben gespeichert und können
                zurückgesetzt werden.
              </p>
            </div>

            <div className="space-y-3">
              {playedSongs.map((song) => {
                const isChanging =
                  changingSongId === song.songId;

                return (
                  <article
                    key={song.songId}
                    className="rounded-2xl border border-white/5 bg-zinc-950/60 p-5 text-zinc-500"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-12 items-center justify-center text-2xl">
                        ✓
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-black line-through">
                          {song.songTitle}
                        </h3>

                        <p className="mt-1 truncate text-sm">
                          {song.artist}
                        </p>

                        {song.playedAt && (
                          <p className="mt-2 text-xs text-zinc-600">
                            Gespielt um{" "}
                            {new Date(
                              song.playedAt,
                            ).toLocaleTimeString("de-DE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 sm:text-right">
                        <p className="text-xl font-black">
                          {song.votes}
                        </p>

                        <p className="text-xs">
                          {song.votes === 1
                            ? "Stimme"
                            : "Stimmen"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          undoPlayed(song.songId)
                        }
                        disabled={isChanging}
                        className="shrink-0 rounded-xl border border-white/10 px-5 py-3 font-bold text-zinc-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
                      >
                        {isChanging
                          ? "Wird geändert …"
                          : "Rückgängig"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {showNewConcertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-6">
            <h2 className="text-2xl font-black">
              Neues Konzert
            </h2>

            <input
              type="text"
              value={newConcertName}
              onChange={(e) => setNewConcertName(e.target.value)}
              placeholder="z.B. Dorffest Husby 2026"
              className="mt-5 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewConcertDialog(false);
                  setNewConcertName("");
                }}
                className="rounded-xl bg-zinc-700 px-5 py-3"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={startNewConcert}
                className="rounded-xl bg-green-600 px-5 py-3 font-bold"
              >
                Konzert starten
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}