"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { getActiveConcertId } from "./lib/concert";
import { songs } from "./data/songs";
import { getDeviceId } from "./lib/device";

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

      const { count, error } = await supabase
        .from("votes")
        .select("*", { count: "exact", head: true })
        .eq("concert_id", concertId)
        .eq("device_id", deviceId);

      if (error) {
        console.error("Fehler bei der Abstimmungsprüfung:", error);
        return;
      }

      setHasAlreadyVoted((count ?? 0) > 0);
    } catch {
      setHasAlreadyVoted(false);
    } finally {
      setIsCheckingVote(false);
    }
  }

  checkExistingVote();
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
}, [searchTerm]);

  const selectedSongs = useMemo(() => {
    return songs.filter((song) => selectedSongIds.includes(song.id));
  }, [selectedSongIds]);

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

    const concertId = await getActiveConcertId();
    const deviceId = getDeviceId();

const { count, error: countError } = await supabase
  .from("votes")
  .select("*", { count: "exact", head: true })
  .eq("concert_id", concertId)
  .eq("device_id", deviceId);

if (countError) {
  console.error(countError);
}

if ((count ?? 0) > 0) {
  setHasAlreadyVoted(true);
  setIsSubmitting(false);
  return;
}

const votes = selectedSongs.map((song) => ({
  concert_id: concertId,
  device_id: deviceId,
  song_id: song.id,
  song_title: song.title,
  artist: song.artist,
}));

const { error } = await supabase.from("votes").insert(votes);

    if (error) {
      console.error("Fehler beim Speichern:", error);
      setSubmitError(
        "Deine Wünsche konnten nicht gespeichert werden. Bitte versuche es noch einmal.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setScreen("thanks");
  }

  if (isCheckingVote) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
      <p className="text-zinc-400">Abstimmung wird geladen...</p>
    </main>
  );
}

if (hasAlreadyVoted) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-green-500/30 bg-green-950/20 p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-4xl font-black">
          ✓
        </div>

        <h1 className="mt-6 text-3xl font-black sm:text-4xl">
          Du hast bereits abgestimmt!
        </h1>

        <p className="mt-4 text-zinc-300">
          Vielen Dank. Deine drei Wünsche wurden gespeichert.
        </p>
      </section>
    </main>
  );
}
  if (screen === "landing") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
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
      </main>
    );
  }

  if (screen === "thanks") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
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
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
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
                className={`h-3 w-3 rounded-full ${
                  selectedSongIds.length >= number
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
                className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${
                  isSelected
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
                  className={`flex h-8 w-8 items-center justify-center rounded-full border font-bold ${
                    isSelected
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
    </main>
  );
}