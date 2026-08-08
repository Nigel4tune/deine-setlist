"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type VoteSongScope = "all" | "outside_setlist";

type PublicBand = {
  id: number;
  name: string;
  slug: string;
  max_votes: number;
  vote_song_scope: VoteSongScope;
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
  const searchParams = useSearchParams();

  const bandSlug =
    searchParams.get("band")?.trim().toLowerCase() ||
    "no-front";

  const [band, setBand] = useState<PublicBand | null>(null);
  const [bandLoading, setBandLoading] = useState(true);
  const [bandError, setBandError] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [screen, setScreen] = useState<Screen>("landing");
  const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);
  const [submittedSongs, setSubmittedSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [hasAlreadyVoted, setHasAlreadyVoted] = useState(false);
  const [isCheckingVote, setIsCheckingVote] = useState(true);

  const [isChangingVotes, setIsChangingVotes] = useState(false);
  const [changeVotesError, setChangeVotesError] = useState("");

  useEffect(() => {
    async function loadBand() {
      if (!bandSlug) {
        return;
      }
      setBandLoading(true);
      setBandError("");

      const { data, error } = await supabase.rpc(
        "get_public_band_by_slug",
        {
          requested_slug: bandSlug,
        },
      );

      if (error) {
        console.error(
          "Band konnte nicht geladen werden:",
          error.message,
          error.code,
          error.details,
          error.hint,
        );

        setBandError(
          "Die gewünschte Band konnte nicht geladen werden.",
        );
        setBandLoading(false);
        return;
      }

      const loadedBand = Array.isArray(data)
        ? data[0]
        : data;

      if (!loadedBand) {
        setBandError("Diese Band wurde nicht gefunden.");
        setBandLoading(false);
        return;
      }

      setBand({
        id: Number(loadedBand.id),
        name: loadedBand.name,
        slug: loadedBand.slug,
        max_votes:
          typeof loadedBand.max_votes === "number" &&
          loadedBand.max_votes >= 1
            ? loadedBand.max_votes
            : 3,
        vote_song_scope:
          loadedBand.vote_song_scope === "all"
            ? "all"
            : "outside_setlist",
      });

      setBandLoading(false);
    }

    void loadBand();
  }, [bandSlug]);

  useEffect(() => {
    async function checkExistingVote() {
      if (!band) {
        return;
      }
      try {
        const concertId = await getActiveConcertId(band.id);
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

        const hasVoted = Boolean(alreadyVoted);
        setHasAlreadyVoted(hasVoted);

        if (hasVoted) {
          const { data: existingVotes, error: existingVotesError } =
            await supabase
              .from("votes")
              .select("song_id")
              .eq("concert_id", concertId)
              .eq("device_id", deviceId);

          if (existingVotesError) {
            console.error(
              "Vorhandene Auswahl konnte nicht geladen werden:",
              existingVotesError.message,
              existingVotesError.code,
              existingVotesError.details,
              existingVotesError.hint,
            );
          } else {
            setSelectedSongIds(
              (existingVotes ?? [])
                .map((vote) => Number(vote.song_id))
                .filter((songId) => Number.isFinite(songId)),
            );
          }
        }
      } catch {
        setHasAlreadyVoted(false);
      } finally {
        setIsCheckingVote(false);
      }
    }

    void checkExistingVote();
  }, [band]);

  useEffect(() => {
    async function loadAvailableSongs() {
      if (!band) {
        return;
      }
      const [songsResponse, setlistResponse] = await Promise.all([
        supabase
          .from("songs")
          .select("id, title, artist")
          .eq("band_id", band.id)
          .eq("is_active", true)
          .order("title"),

        supabase
          .from("setlist_items")
          .select("song_id, assigned_song_id")
          .eq("band_id", band.id),
      ]);

      if (songsResponse.error) {
        console.error(
          "Fehler beim Laden der Songs:",
          songsResponse.error.message,
          songsResponse.error.code,
          songsResponse.error.details,
          songsResponse.error.hint,
        );
        return;
      }

      if (setlistResponse.error) {
        console.error(
          "Fehler beim Laden der Setlist:",
          setlistResponse.error.message,
          setlistResponse.error.code,
          setlistResponse.error.details,
          setlistResponse.error.hint,
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

      const availableSongs =
        band.vote_song_scope === "all"
          ? songsResponse.data ?? []
          : (songsResponse.data ?? []).filter(
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
  }, [band]);

  const filteredSongs = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchTerm);

    if (!normalizedQuery) {
      return songs;
    }

    return songs.filter((song) => {
      const normalizedTitle = normalizeSearchText(song.title);
      const normalizedArtist = normalizeSearchText(song.artist);
      const normalizedCombined = normalizeSearchText(
        `${song.title} ${song.artist}`,
      );

      return (
        normalizedTitle.includes(normalizedQuery) ||
        normalizedArtist.includes(normalizedQuery) ||
        normalizedCombined.includes(normalizedQuery)
      );
    });
  }, [songs, searchTerm]);

  const selectedSongs = useMemo(() => {
    return songs.filter((song) =>
      selectedSongIds.includes(song.id),
    );
  }, [songs, selectedSongIds]);

  function toggleSong(songId: number) {
    if (!band) {
      return;
    }

    setSubmitError("");

    const isSelected = selectedSongIds.includes(songId);

    if (isSelected) {
      setSelectedSongIds((current) =>
        current.filter((id) => id !== songId),
      );
      return;
    }

    if (selectedSongIds.length >= band.max_votes) {
      return;
    }

    setSelectedSongIds((current) => [...current, songId]);
  }

  async function submitVotes() {
    if (!band) {
      setSubmitError("Die Band konnte nicht geladen werden.");
      return;
    }
    if (
      selectedSongs.length < 1 ||
      selectedSongs.length > band.max_votes ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const concertId = await getActiveConcertId(band.id);
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
        band_id: band.id,
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

      // Die Auswahl für die Danke-Seite merken,
      // bevor selectedSongIds geleert wird.
      setSubmittedSongs(selectedSongs);
      setHasAlreadyVoted(true);
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
        normalizedMessage.includes(
          "maximale anzahl an songwünschen",
        ) ||
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

  async function changeVotes() {
    if (isChangingVotes) {
      return;
    }
    if (!band) {
      setChangeVotesError(
        "Die Band konnte nicht geladen werden.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Möchtest du deine bisherige Auswahl löschen und neu abstimmen?",
    );

    if (!confirmed) {
      return;
    }

    setIsChangingVotes(true);
    setChangeVotesError("");

    try {
      const concertId = await getActiveConcertId(band.id);
      const deviceId = getDeviceId();

      const { error } = await supabase
        .from("votes")
        .delete()
        .eq("concert_id", concertId)
        .eq("device_id", deviceId);

      if (error) {
        console.error(
          "Stimmen konnten nicht zurückgenommen werden:",
          error.message,
          error.code,
          error.details,
          error.hint,
        );

        setChangeVotesError(
          "Deine Auswahl konnte nicht zurückgenommen werden.",
        );
        return;
      }

      setSubmittedSongs([]);
      setSearchTerm("");
      setSubmitError("");
      setChangeVotesError("");
      setHasAlreadyVoted(false);
      setScreen("vote");
    } catch (error) {
      console.error(
        "Fehler beim Ändern der Abstimmung:",
        error,
      );

      setChangeVotesError(
        "Aktuell konnte deine Auswahl nicht geändert werden.",
      );
    } finally {
      setIsChangingVotes(false);
    }
  }

  if (bandLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
        <p className="text-zinc-400">
          Band wird geladen …
        </p>

        <PublicNavigation />
      </main>
    );
  }

  if (bandError || !band) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-red-500/30 bg-red-950/20 p-8 text-center">
          <h1 className="text-3xl font-black">
            Band nicht gefunden
          </h1>

          <p className="mt-4 text-red-200">
            {bandError || "Diese Band wurde nicht gefunden."}
          </p>
        </section>

        <PublicNavigation />
      </main>
    );
  }

  if (isCheckingVote) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
        <p className="text-zinc-400">
          Abstimmung wird geladen...
        </p>

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
          </h1>

          <p className="mt-4 text-zinc-300">
            Vielen Dank. Deine Wünsche wurden gespeichert.
          </p>

          <button
            type="button"
            onClick={changeVotes}
            disabled={isChangingVotes}
            className="mt-6 w-full rounded-2xl border border-white/15 bg-zinc-900 px-6 py-4 font-black text-white transition hover:border-red-500 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isChangingVotes
              ? "Auswahl wird zurückgesetzt …"
              : "← Auswahl ändern"}
          </button>

          {changeVotesError && (
            <p className="mt-4 text-sm font-semibold text-red-300">
              {changeVotesError}
            </p>
          )}

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
            {band.name} präsentiert
          </p>

          <div className="mb-6 text-7xl" aria-hidden="true">
            🎸
          </div>

          <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
            Deine Setlist
          </h1>

          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-zinc-300">
            Heute entscheidest du mit, welche Songs wir auf der
            Bühne spielen.
          </p>

          <p className="mt-3 text-zinc-500">
            {band.max_votes === 1
              ? "Wähle deinen Favoriten."
              : `Wähle bis zu ${band.max_votes} deiner Favoriten.`}
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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white">
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

          {submittedSongs.length > 0 && (
            <ul className="mt-7 space-y-3">
              {submittedSongs.map((song) => (
                <li
                  key={song.id}
                  className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-left"
                >
                  <p className="font-bold">{song.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {song.artist}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-7 text-sm leading-relaxed text-zinc-400">
            Deine Auswahl hilft uns dabei, die Setlist für den
            Abend zusammenzustellen.
          </p>

          <button
            type="button"
            onClick={changeVotes}
            disabled={isChangingVotes}
            className="mt-6 w-full rounded-2xl border border-white/15 bg-zinc-900 px-6 py-4 font-black text-white transition hover:border-red-500 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isChangingVotes
              ? "Auswahl wird zurückgesetzt …"
              : "← Auswahl ändern"}
          </button>

          {changeVotesError && (
            <p className="mt-4 text-sm font-semibold text-red-300">
              {changeVotesError}
            </p>
          )}
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
            {band.name} präsentiert
          </p>

          <h1 className="text-4xl font-black sm:text-6xl">
            Deine Setlist
          </h1>

          <p className="mt-4 text-zinc-300">
            {band.max_votes === 1
              ? "Wähle einen Song."
              : `Wähle bis zu ${band.max_votes} Songs.`}
          </p>
        </header>

        <div className="sticky top-3 z-20 mt-8 rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-xl backdrop-blur sm:p-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-400">
                Deine Auswahl
              </p>

              <p className="mt-1 font-bold sm:text-lg">
                {selectedSongIds.length} von {band.max_votes}{" "}
                {band.max_votes === 1 ? "Song" : "Songs"}
              </p>
            </div>

            {band.max_votes <= 10 && (
              <div className="hidden shrink-0 gap-2 sm:flex">
                {Array.from(
                  { length: band.max_votes },
                  (_, index) => index + 1,
                ).map((number) => (
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
            )}

            <button
              type="button"
              onClick={submitVotes}
              disabled={
                selectedSongIds.length < 1 ||
                selectedSongIds.length > band.max_votes ||
                isSubmitting
              }
              className="shrink-0 rounded-xl bg-red-600 px-4 py-3 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:px-5"
            >
              {isSubmitting ? "Speichert …" : "Abstimmen"}
            </button>
          </div>

          {band.max_votes <= 10 && (
            <div className="mt-3 flex gap-2 sm:hidden">
              {Array.from(
                { length: band.max_votes },
                (_, index) => index + 1,
              ).map((number) => (
                <span
                  key={number}
                  className={`h-2.5 w-2.5 rounded-full ${
                    selectedSongIds.length >= number
                      ? "bg-red-500"
                      : "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Song oder Künstler suchen..."
            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-5 py-4 text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
          />
        </div>

        <div className="mt-5 space-y-3">
          {filteredSongs.map((song) => {
            const isSelected = selectedSongIds.includes(song.id);

            const selectionIsFull =
              selectedSongIds.length >= band.max_votes &&
              !isSelected;

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
                  <span className="block font-bold">
                    {song.title}
                  </span>

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