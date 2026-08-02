"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { getActiveConcertId } from "./lib/concert";
import { getDeviceId } from "./lib/device";
import PublicNavigation from "./components/PublicNavigation";

type Screen = "landing" | "vote" | "thanks";

type Song = {
  id: number;
  title: string;
  artist: string;
};

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

export default function Home() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [screen, setScreen] = useState<Screen>("landing");
  const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [hasAlreadyVoted, setHasAlreadyVoted] = useState(false);
  const [isCheckingVote, setIsCheckingVote] = useState(true);
  useEffect(() => {
    async function checkExistingVote() {
      try {
        const concertId = await getActiveConcertId();
        const deviceId = getDeviceId();

        const { data: alreadyVoted, error } = await supabase.rpc(
          "has_device_voted",
          {
            p_concert_id: concertId,
            p_device_id: deviceId,
          },
        );

        if (error) {
          console.error(
            "Fehler beim Prüfen vorhandener Stimmen:",
            error.message,
            error.code,
            error.details,
            error.hint,
          );
          return;
        }

        setHasAlreadyVoted(Boolean(alreadyVoted));
      } catch {
        setHasAlreadyVoted(false);
      } finally {
        setIsCheckingVote(false);
      }
    }

    checkExistingVote();
  }, []);

  useEffect(() => {
    async function loadAvailableSongs() {
      const [songsResponse, setlistResponse] = await Promise.all([
        supabase
          .from("songs")
          .select("id, title, artist")
          .eq("is_active", true)
          .order("title"),

        supabase
          .from("setlist_items")
          .select("song_id, assigned_song_id"),
      ]);

      if (songsResponse.error) {
        console.error(
          "Fehler beim Laden der Songs:",
          songsResponse.error,
        );
        return;
      }

      if (setlistResponse.error) {
        console.error(
          "Fehler beim Laden der Setlist:",
          setlistResponse.error,
        );
        return;
      }

      const songIdsInSetlist = new Set<number>();

      for (const item of setlistResponse.data ?? []) {
        if (typeof item.song_id === "number") {
          songIdsInSetlist.add(item.song_id);
        }

        if (typeof item.assigned_song_id === "number") {
          songIdsInSetlist.add(item.assigned_song_id);
        }
      }

      const availableSongs = (songsResponse.data ?? []).filter(
        (song) => !songIdsInSetlist.has(song.id),
      );

      setSongs(availableSongs);

      setSelectedSongIds((currentSelection) =>
        currentSelection.filter((songId) =>
          availableSongs.some((song) => song.id === songId),
        ),
      );
    }

    void loadAvailableSongs();
  }, []);

  const filteredSongs = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchTerm);

    if (!normalizedQuery) {
      return songs;
    }

    return songs.filter((song) => {
      const normalizedTitle = normalizeSearchText(song.title);
      const normalizedArtist = normalizeSearchText(song.artist);
      const normalizedCombined = normalizeSearchText(
        `${song.title} ${song.artist}`
      );

      return (
        normalizedTitle.includes(normalizedQuery) ||
        normalizedArtist.includes(normalizedQuery) ||
        normalizedCombined.includes(normalizedQuery)
      );
    });
  }, [songs, searchTerm]);

  const selectedSongs = useMemo(() => {
    return songs.filter((song) => selectedSongIds.includes(song.id));
  }, [songs, selectedSongIds]);

  function toggleSong(songId: number) {
    setSubmitError("");

    const isSelected = selectedSongIds.includes(songId);

    if (isSelected) {
      setSelectedSongIds((current) =>
        current.filter((id) => id !== songId),
      );
      return;
    }

    if (selectedSongIds.length >= 3) {
      return;
    }

    setSelectedSongIds((current) => [...current, songId]);
  }

  async function submitVotes() {
    if (selectedSongs.length !== 3 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const concertId = await getActiveConcertId();
      const deviceId = getDeviceId();

      const {
        data: alreadyVoted,
        error: voteCheckError,
      } = await supabase.rpc("has_device_voted", {
        p_concert_id: concertId,
        p_device_id: deviceId,
      });

      if (voteCheckError) {
        throw voteCheckError;
      }

      if (alreadyVoted) {
        setHasAlreadyVoted(true);
        setScreen("thanks");
        return;
      }

      const votes = selectedSongs.map((song) => ({
        concert_id: concertId,
        device_id: deviceId,
        song_id: song.id,
        song_title: song.title,
        artist: song.artist,
      }));

      const { error: insertError } = await supabase
        .from("votes")
        .insert(votes);

      if (insertError) {
        throw insertError;
      }

      // Verhindert auch ohne erneutes Laden der Seite
      // eine weitere Abstimmung.
      setHasAlreadyVoted(true);
      setSelectedSongIds([]);
      setScreen("thanks");
    } catch (error: unknown) {
      let message = "Unbekannter Fehler";

      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        message = String(error.message);
      } else if (error instanceof Error) {
        message = error.message;
      }

      console.error(
        "Fehler beim Speichern der Stimmen:",
        message,
      );

      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes("maximum of three") ||
        normalizedMessage.includes("maximal drei") ||
        normalizedMessage.includes("bereits abgestimmt")
      ) {
        setHasAlreadyVoted(true);
        setScreen("thanks");
        return;
      }

      setSubmitError(
        normalizedMessage.includes("kein aktives konzert")
          ? "Aktuell läuft kein Konzert. Die Abstimmung ist geschlossen."
          : "Deine Wünsche konnten nicht gespeichert werden. Bitte versuche es noch einmal.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingVote) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
        <p className="text-zinc-400">Abstimmung wird geladen...</p>
       <PublicNavigation /> 
      </main>
    );
  }

  if (hasAlreadyVoted && screen !== "thanks") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-green-500/30 bg-green-950/20 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-4xl font-black">
            ✓
          </div>

          <h1 className="mt-6 text-3xl font-black sm:text-4xl">
            Du hast bereits abgestimmt!
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm text-zinc-500">Weitere Infos:</p>

              <a
                href="https://www.instagram.com/nofrontband/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-pink-500/30 bg-pink-500/10 px-5 py-3 font-semibold text-pink-300 transition hover:border-pink-400 hover:bg-pink-500/20 hover:text-pink-200"
                aria-label="No Front auf Instagram öffnen"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6 fill-current"
                >
                  <path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5ZM17.5 5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                </svg>

                
              </a>
            </div>
          </h1>

          <p className="mt-4 text-zinc-300">
            Vielen Dank. Deine drei Wünsche wurden gespeichert.
          </p>
        </section>
       <PublicNavigation /> 
      </main>
    );
  }
  if (screen === "landing") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
        <section className="w-full max-w-xl text-center">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.35em] text-red-500">
            No Front präsentiert
          </p>

          <div className="mb-6 text-7xl" aria-hidden="true">
            🎸
          </div>

          <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
            Deine Setlist
          </h1>

          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-zinc-300">
            Heute entscheidest du mit, welche Songs wir auf der Bühne spielen.
          </p>

          <p className="mt-3 text-zinc-500">
            Wähle drei deiner Favoriten.
          </p>

          <button
            type="button"
            onClick={() => setScreen("vote")}
            className="mt-10 w-full rounded-2xl bg-red-600 px-8 py-5 text-xl font-black shadow-lg transition hover:bg-red-500 active:scale-[0.98] sm:w-auto sm:min-w-72"
          >
            Jetzt abstimmen
          </button>

          <p className="mt-10 text-sm text-zinc-600">
            Die Band entscheidet über die endgültige Setlist.
          </p>
        </section>
       <PublicNavigation /> 
      </main>
    );
  }

  if (screen === "thanks") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28text-white">
        <section className="w-full max-w-xl rounded-3xl border border-green-500/30 bg-green-950/20 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-4xl font-black">
            ✓
          </div>

          <h1 className="mt-6 text-3xl font-black sm:text-4xl">
            Danke für deine Wünsche!
          </h1>

          <p className="mt-4 text-zinc-300">
            Deine Stimmen wurden gespeichert.
          </p>

          <ul className="mt-7 space-y-3">
            {selectedSongs.map((song) => (
              <li
                key={song.id}
                className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-left"
              >
                <p className="font-bold">{song.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{song.artist}</p>
              </li>
            ))}
          </ul>

          <p className="mt-7 text-sm leading-relaxed text-zinc-400">
            Deine Auswahl hilft uns dabei, die Setlist für den Abend
            zusammenzustellen.
          </p>

        </section>
      <PublicNavigation />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
      <section className="mx-auto w-full max-w-2xl">
        <header className="text-center">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            No Front präsentiert
          </p>

          <h1 className="text-4xl font-black sm:text-6xl">
            Deine Setlist
          </h1>

          <p className="mt-4 text-zinc-300">
            Wähle drei Songs.
          </p>
        </header>

        <div className="sticky top-3 z-10 mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-xl backdrop-blur">
          <div>
            <p className="text-sm text-zinc-400">Deine Auswahl</p>
            <p className="mt-1 text-lg font-bold">
              {selectedSongIds.length} von 3 Songs
            </p>
          </div>

          <div className="flex gap-2">
            {[1, 2, 3].map((number) => (
              <span
                key={number}
                className={`h-3 w-3 rounded-full ${selectedSongIds.length >= number
                  ? "bg-red-500"
                  : "bg-zinc-700"
                  }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Song oder Künstler suchen..."
            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-5 py-4 text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
          />
        </div>

        <div className="mt-5 space-y-3">
          {filteredSongs.map((song) => {
            const isSelected = selectedSongIds.includes(song.id);
            const selectionIsFull =
              selectedSongIds.length >= 3 && !isSelected;

            return (
              <button
                key={song.id}
                type="button"
                onClick={() => toggleSong(song.id)}
                disabled={selectionIsFull || isSubmitting}
                className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${isSelected
                  ? "border-red-500 bg-red-600/20"
                  : selectionIsFull
                    ? "cursor-not-allowed border-white/5 bg-zinc-900/40 text-zinc-600"
                    : "border-white/10 bg-zinc-900 hover:border-white/30 hover:bg-zinc-800"
                  }`}
              >
                <span>
                  <span className="block font-bold">{song.title}</span>
                  <span className="mt-1 block text-sm text-zinc-400">
                    {song.artist}
                  </span>
                </span>

                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border font-bold ${isSelected
                    ? "border-red-500 bg-red-500"
                    : "border-zinc-600 text-transparent"
                    }`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {filteredSongs.length === 0 && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center text-zinc-400">
            Kein passender Song gefunden.
          </div>
        )}

        {submitError && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-sm text-red-200">
            {submitError}
          </div>
        )}

        <button
          type="button"
          onClick={submitVotes}
          disabled={selectedSongIds.length !== 3 || isSubmitting}
          className="mt-7 w-full rounded-2xl bg-red-600 px-6 py-5 text-xl font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {isSubmitting ? "Wünsche werden gespeichert..." : "Abstimmen"}
        </button>

        <button
          type="button"
          onClick={() => setScreen("landing")}
          disabled={isSubmitting}
          className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-zinc-500 transition hover:text-white disabled:cursor-not-allowed"
        >
          Zurück zur Startseite
        </button>
      </section>
    <PublicNavigation />  
    </main>
  );
}