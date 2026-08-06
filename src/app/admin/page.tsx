"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { getActiveConcertId } from "../lib/concert";
import { getActiveBandId } from "../lib/band";
import { supabase } from "../lib/supabase";
import AdminNavigation from "../components/AdminNavigation";

type VoteRow = {
  song_id: number;
  song_title: string;
  artist: string;
};



type VoteResult = {
  songId: number;
  songTitle: string;
  artist: string;
  votes: number;
  isPlayed: boolean;
  playedAt: string | null;
  setlistItemId: number | null;
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

  const [isStartingConcert, setIsStartingConcert] =
    useState(false);
  const [isConcertActive, setIsConcertActive] =
    useState<boolean | null>(null);

  const [isEndingConcert, setIsEndingConcert] =
    useState(false);

  const [songsInSetlist, setSongsInSetlist] = useState<Set<number>>(
    new Set(),
  );

  const checkConcertStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from("concerts")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Konzertstatus konnte nicht geladen werden:",
        error,
      );

      setIsConcertActive(false);
      return;
    }



    setIsConcertActive(Boolean(data));
  }, []);

  useEffect(() => {
    void checkConcertStatus();

    const statusInterval = window.setInterval(() => {
      void checkConcertStatus();
    }, 5000);

    return () => {
      window.clearInterval(statusInterval);
    };
  }, [checkConcertStatus]);


  const loadVotes = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsRefreshing(true);
    }

    setErrorMessage("");

    try {
      const bandId = await getActiveBandId();
      const concertId = await getActiveConcertId(bandId);

      const [
        votesResponse,
        currentSongResponse,
        setlistItemsResponse,
      ] = await Promise.all([
        supabase
          .from("votes")
          .select("song_id, song_title, artist")
          .eq("concert_id", concertId),

        supabase
          .from("current_song")
          .select("song_id")
          .eq("concert_id", concertId)
          .maybeSingle(),

        supabase
          .from("setlist_items")
          .select(
            "id, song_id, assigned_song_id, is_played, played_at",
          ),
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


      if (setlistItemsResponse.error) {
        console.error(
          "Fehler beim Laden der Setlist-Einträge:",
          setlistItemsResponse.error,
        );

        setErrorMessage(
          "Die Zuordnung zur Setlist konnte nicht geladen werden.",
        );

        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      type SetlistStatus = {
        id: number;
        isPlayed: boolean;
        playedAt: string | null;
      };

      const setlistItemBySongId =
        new Map<number, SetlistStatus>();

      (
        setlistItemsResponse.data as {
          id: number;
          song_id: number | null;
          assigned_song_id: number | null;
          is_played: boolean;
          played_at: string | null;
        }[]
      ).forEach((item) => {
        const status: SetlistStatus = {
          id: item.id,
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
      const groupedVotes = new Map<number, VoteResult>();

      (votesResponse.data as VoteRow[]).forEach((vote) => {
        const existingSong = groupedVotes.get(vote.song_id);


        if (existingSong) {
          existingSong.votes += 1;
          return;
        }



        const setlistItem =
          setlistItemBySongId.get(vote.song_id);

        groupedVotes.set(vote.song_id, {
          songId: vote.song_id,
          songTitle: vote.song_title,
          artist: vote.artist,
          votes: 1,
          isPlayed: setlistItem?.isPlayed ?? false,
          playedAt: setlistItem?.playedAt ?? null,
          setlistItemId: setlistItem?.id ?? null,
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
      setIsConcertActive(false);
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
    loadSongsInSetlist();

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
      let setlistItemId = song.setlistItemId;

      // Falls die Zuordnung im Browser noch nicht aktualisiert wurde,
      // den passenden Setlist-Eintrag direkt aus Supabase laden.
      if (setlistItemId === null) {
        const { data: setlistItem, error: setlistItemError } =
          await supabase
            .from("setlist_items")
            .select("id")
            .or(
              `song_id.eq.${song.songId},assigned_song_id.eq.${song.songId}`,
            )
            .limit(1)
            .maybeSingle();

        if (setlistItemError) {
          console.error("Fehler beim Suchen des Setlist-Eintrags:", {
            message: setlistItemError.message,
            code: setlistItemError.code,
            details: setlistItemError.details,
            hint: setlistItemError.hint,
          });

          setErrorMessage(
            "Der passende Eintrag in der Setlist konnte nicht gefunden werden.",
          );

          setChangingSongId(null);
          return;
        }

        if (!setlistItem) {
          setErrorMessage(
            "Der Song befindet sich noch nicht in der Setlist. Klicke zuerst auf „Jetzt spielen“.",
          );

          setChangingSongId(null);
          return;
        }

        setlistItemId = setlistItem.id;
      }

      const playedAt = new Date().toISOString();

      const { error } = await supabase
        .from("setlist_items")
        .update({
          is_played: true,
          played_at: playedAt,
        })
        .eq("id", setlistItemId);

      if (error) {
        console.error("Fehler beim Markieren als gespielt:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        setErrorMessage(
          `Der Song konnte nicht als gespielt markiert werden: ${error.message}`,
        );

        setChangingSongId(null);
        return;
      }

      await loadVotes();
      setChangingSongId(null);
    } catch (error) {
      console.error(
        "Unerwarteter Fehler beim Markieren als gespielt:",
        error,
      );

      setErrorMessage(
        "Beim Markieren als gespielt ist ein unerwarteter Fehler aufgetreten.",
      );

      setChangingSongId(null);
    }
  }

  async function undoPlayed(songId: number) {
    setChangingSongId(songId);
    setErrorMessage("");

    try {
      const song = results.find(
        (result) => result.songId === songId,
      );

      if (!song?.setlistItemId) {
        setErrorMessage(
          "Der passende Setlist-Eintrag konnte nicht gefunden werden.",
        );

        setChangingSongId(null);
        return;
      }

      const { error } = await supabase
        .from("setlist_items")
        .update({
          is_played: false,
          played_at: null,
        })
        .eq("id", song.setlistItemId);

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
        "Fehler beim Rückgängigmachen:",
        error,
      );

      setErrorMessage(
        "Der Gespielt-Status konnte nicht rückgängig gemacht werden.",
      );

      setChangingSongId(null);
    }
  }

  async function loadSongsInSetlist() {
    const { data, error } = await supabase
      .from("setlist_items")
      .select("assigned_song_id")
      .eq("item_type", "request")
      .not("assigned_song_id", "is", null);

    if (error) {
      console.error(
        "Zugewiesene Wunschsongs konnten nicht geladen werden:",
        error.message,
        error.code,
        error.details,
        error.hint,
      );
      return;
    }

    const assignedSongIds = new Set<number>();

    for (const item of data ?? []) {
      if (typeof item.assigned_song_id === "number") {
        assignedSongIds.add(item.assigned_song_id);
      }
    }

    setSongsInSetlist(assignedSongIds);
  }

  async function addRequestToSetlist(song: VoteResult) {
    if (
      changingSongId !== null ||
      songsInSetlist.has(song.songId)
    ) {
      return;
    }

    setChangingSongId(song.songId);
    setErrorMessage("");

    try {
      // Kontrollieren, ob der Song bereits zugewiesen wurde.
      const { data: existingRequest, error: existingRequestError } =
        await supabase
          .from("setlist_items")
          .select("id")
          .eq("item_type", "request")
          .eq("assigned_song_id", song.songId)
          .maybeSingle();

      if (existingRequestError) {
        console.error(
          "Fehler beim Prüfen des Wunschsongs:",
          existingRequestError.message,
          existingRequestError.code,
          existingRequestError.details,
          existingRequestError.hint,
        );

        setErrorMessage(
          "Der Wunschsong konnte nicht geprüft werden.",
        );
        return;
      }

      if (existingRequest) {
        setSongsInSetlist((currentIds) => {
          const updatedIds = new Set(currentIds);
          updatedIds.add(song.songId);
          return updatedIds;
        });
        return;
      }

      // Den ersten noch freien Wunschsong-Platzhalter suchen.
      const { data: freeRequest, error: freeRequestError } =
        await supabase
          .from("setlist_items")
          .select("id")
          .eq("item_type", "request")
          .is("assigned_song_id", null)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();

      if (freeRequestError) {
        console.error(
          "Fehler beim Suchen eines freien Wunschsongs:",
          freeRequestError.message,
          freeRequestError.code,
          freeRequestError.details,
          freeRequestError.hint,
        );

        setErrorMessage(
          "Ein freier Wunschsong-Platzhalter konnte nicht gesucht werden.",
        );
        return;
      }

      if (!freeRequest) {
        setErrorMessage(
          "Es gibt keinen freien Wunschsong-Platzhalter in der Setlist.",
        );
        return;
      }

      // Den Publikumswunsch in den freien Platz eintragen.
      const { error: assignError } = await supabase
        .from("setlist_items")
        .update({
          assigned_song_id: song.songId,
        })
        .eq("id", freeRequest.id);

      if (assignError) {
        console.error(
          "Fehler beim Einfügen des Wunschsongs:",
          assignError.message,
          assignError.code,
          assignError.details,
          assignError.hint,
        );

        setErrorMessage(
          "Der Wunschsong konnte nicht in die Setlist übernommen werden.",
        );
        return;
      }

      setSongsInSetlist((currentIds) => {
        const updatedIds = new Set(currentIds);
        updatedIds.add(song.songId);
        return updatedIds;
      });

      await loadSongsInSetlist();
    } catch (error) {
      console.error(
        "Fehler beim Hinzufügen des Wunschsongs:",
        error,
      );

      setErrorMessage(
        "Der Wunschsong konnte nicht hinzugefügt werden.",
      );
    } finally {
      setChangingSongId(null);
    }
  }

  async function startNewConcert() {
    const concertName = newConcertName.trim();

    if (!concertName) {
      alert("Bitte gib einen Konzertnamen ein.");
      return;
    }

    if (isStartingConcert) {
      return;
    }

    setErrorMessage("");
    setIsStartingConcert(true);

    try {
      const { data: newConcertId, error: createError } =
        await supabase.rpc("start_new_concert", {
          p_name: concertName,
        });

      if (createError || newConcertId === null) {
        console.error(
          "Neues Konzert konnte nicht erstellt werden:",
          createError?.message,
          createError?.code,
          createError?.details,
          createError?.hint,
        );

        setErrorMessage(
          createError?.message
            ? `Das Konzert konnte nicht gestartet werden: ${createError.message}`
            : "Das Konzert konnte nicht gestartet werden.",
        );

        return;
      }

      setIsConcertActive(true);
      setShowNewConcertDialog(false);
      setNewConcertName("");
      setCurrentSongId(null);
      setResults([]);

      await loadVotes(true);
    } catch (error) {
      console.error("Fehler beim Starten des Konzerts:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Beim Starten des Konzerts ist ein Fehler aufgetreten.",
      );
    } finally {
      setIsStartingConcert(false);
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
    if (isEndingConcert) {
      return;
    }

    const confirmed = window.confirm(
      "Möchtest du das aktuelle Konzert wirklich beenden?",
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setIsEndingConcert(true);

    try {
      const { data: endedConcertId, error: updateError } =
        await supabase.rpc("end_active_concert");

      if (updateError) {
        console.error(
          "Konzert konnte nicht beendet werden:",
          updateError.message,
          updateError.code,
          updateError.details,
          updateError.hint,
        );

        setErrorMessage(
          `Das Konzert konnte nicht beendet werden: ${updateError.message}`,
        );

        return;
      }

      if (endedConcertId === null) {
        setIsConcertActive(false);
        setErrorMessage("Es wurde kein aktives Konzert gefunden.");
        return;
      }

      setIsConcertActive(false);
      setResults([]);
      setCurrentSongId(null);
      setLastUpdated(null);

      await checkConcertStatus();

      alert("Das Konzert wurde beendet.");
    } catch (error) {
      console.error("Fehler beim Beenden des Konzerts:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Beim Beenden des Konzerts ist ein Fehler aufgetreten.",
      );
    } finally {
      setIsEndingConcert(false);
    }
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

          <div className="flex flex-wrap gap-3">
  <Link
    href="/admin/qr"
    className="rounded-2xl border border-white/10 bg-zinc-800 px-6 py-4 font-black text-white transition hover:bg-zinc-700"
  >
    📱 QR-Code
  </Link>

  {isConcertActive === null ? (
              <button
                type="button"
                disabled
                className="rounded-2xl bg-zinc-700 px-6 py-4 font-black text-zinc-400"
              >
                Konzertstatus wird geladen …
              </button>
            ) : isConcertActive ? (
              <button
                type="button"
                onClick={endConcert}
                disabled={isEndingConcert}
                className="rounded-2xl bg-orange-600 px-6 py-4 font-black text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEndingConcert
                  ? "Konzert wird beendet …"
                  : "■ Konzert beenden"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewConcertDialog(true)}
                disabled={isStartingConcert}
                className="rounded-2xl bg-green-600 px-6 py-4 font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ▶ Konzert starten
              </button>
            )}
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

                const isChanging =
                  changingSongId === song.songId;

                const cardStyle =
                  index === 0
                    ? "min-h-[190px] border-2 border-yellow-400 bg-gradient-to-r from-yellow-950/40 to-zinc-900 p-7 shadow-[0_0_30px_rgba(250,204,21,0.16)]"
                    : index === 1
                      ? "min-h-[165px] border-2 border-slate-300 bg-gradient-to-r from-slate-700/30 to-zinc-900 p-6 shadow-[0_0_24px_rgba(203,213,225,0.12)]"
                      : index === 2
                        ? "min-h-[155px] border-2 border-amber-700 bg-gradient-to-r from-amber-950/30 to-zinc-900 p-6 shadow-[0_0_22px_rgba(180,83,9,0.12)]"
                        : "min-h-[125px] border border-white/10 bg-zinc-900/70 p-4";

                const medalStyle =
                  index === 0
                    ? "text-6xl"
                    : index === 1
                      ? "text-5xl"
                      : index === 2
                        ? "text-5xl"
                        : "text-2xl text-zinc-500";

                const titleStyle =
                  index === 0
                    ? "text-2xl sm:text-3xl"
                    : index < 3
                      ? "text-xl sm:text-2xl"
                      : "text-lg";

                return (
                  <article
                    key={song.songId}
                    className={`overflow-hidden rounded-2xl shadow-lg transition-all ${cardStyle}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div
                        className={`flex min-w-16 shrink-0 items-center justify-center font-black ${medalStyle}`}
                      >
                        {getPositionLabel(index)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-5">
                          <div className="min-w-0">
                            <h3 className={`truncate font-black ${titleStyle}`}>
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

                      <div className="flex w-28 shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void addRequestToSetlist(song)}
                          disabled={
                            isChanging || songsInSetlist.has(song.songId)
                          }
                          className={`min-h-16 w-28 rounded-xl px-3 py-3 text-center text-sm font-black leading-tight transition ${songsInSetlist.has(song.songId)
                            ? "cursor-default border border-green-500/40 bg-green-950 text-green-300"
                            : "bg-amber-500 text-black hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
                            }`}
                        >
                          {isChanging ? (
                            <>
                              Wird
                              <br />
                              hinzugefügt …
                            </>
                          ) : songsInSetlist.has(song.songId) ? (
                            <>
                              ✓ In der
                              <br />
                              Setlist
                            </>
                          ) : (
                            <>
                              Zur Setlist
                              <br />
                              hinzufügen
                            </>
                          )}
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
              Konzert starten
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