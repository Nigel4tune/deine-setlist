"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminNavigation from "../../components/AdminNavigation";
import { getActiveBandId } from "../../lib/band";
import { supabase } from "../../lib/supabase";

type Concert = {
  id: number;
  name: string;
  created_at: string;
};

type PlayedSong = {
  song_id: number;
  song_title: string;
  artist: string;
  played_at: string;
};

type Vote = {
  song_id: number;
};

export default function ConcertPage() {
  const params = useParams<{ id?: string }>();

  const concertId =
    typeof params.id === "string"
      ? Number(params.id)
      : null;

  const [concert, setConcert] = useState<Concert | null>(
    null,
  );
  const [songs, setSongs] = useState<PlayedSong[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadConcertDetails() {
      if (
        concertId === null ||
        !Number.isInteger(concertId) ||
        concertId <= 0
      ) {
        setErrorMessage(
          "Die angeforderte Konzert-ID ist ungültig.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setConcert(null);
      setSongs([]);
      setVotes([]);

      try {
        const activeBandId = await getActiveBandId();

        const concertResponse = await supabase
          .from("concerts")
          .select("id, name, created_at")
          .eq("id", concertId)
          .eq("band_id", activeBandId)
          .eq("is_active", false)
          .maybeSingle();

        if (concertResponse.error) {
          throw new Error(
            `Konzert konnte nicht geladen werden: ${concertResponse.error.message}`,
          );
        }

        if (!concertResponse.data) {
          setErrorMessage(
            "Dieses Konzert wurde nicht gefunden oder gehört nicht zur aktiven Band.",
          );
          setLoading(false);
          return;
        }

        const [songsResponse, votesResponse] =
          await Promise.all([
            supabase
              .from("played_songs")
              .select(
                "song_id, song_title, artist, played_at",
              )
              .eq("concert_id", concertId)
              .eq("band_id", activeBandId)
              .order("played_at", {
                ascending: true,
              }),

            supabase
              .from("votes")
              .select("song_id")
              .eq("concert_id", concertId)
              .eq("band_id", activeBandId),
          ]);

        if (songsResponse.error) {
          throw new Error(
            `Gespielte Songs konnten nicht geladen werden: ${songsResponse.error.message}`,
          );
        }

        if (votesResponse.error) {
          throw new Error(
            `Stimmen konnten nicht geladen werden: ${votesResponse.error.message}`,
          );
        }

        setConcert(
          concertResponse.data as Concert,
        );
        setSongs(
          (songsResponse.data ?? []) as PlayedSong[],
        );
        setVotes(
          (votesResponse.data ?? []) as Vote[],
        );
      } catch (error) {
        console.error(
          "Konzertauswertung konnte nicht geladen werden:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Die Konzertauswertung konnte nicht geladen werden.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadConcertDetails();
  }, [concertId]);

  function getVoteCount(songId: number) {
    return votes.filter(
      (vote) => vote.song_id === songId,
    ).length;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-10 text-center text-zinc-400">
            Konzertauswertung wird geladen …
          </div>
        ) : errorMessage ? (
          <section className="rounded-3xl border border-red-500/30 bg-red-950/20 p-8 text-center shadow-2xl">
            <div className="text-5xl">⚠️</div>

            <h1 className="mt-5 text-3xl font-black">
              Auswertung nicht verfügbar
            </h1>

            <p className="mt-4 text-red-200">
              {errorMessage}
            </p>
          </section>
        ) : concert ? (
          <>
            <header>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                Konzertauswertung
              </p>

              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                {concert.name}
              </h1>

              <p className="mt-3 text-zinc-400">
                {new Date(
                  concert.created_at,
                ).toLocaleString("de-DE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </header>

            <section className="mt-8 rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl sm:p-8">
              <h2 className="text-2xl font-black">
                Gespielte Songs
              </h2>

              {songs.length === 0 ? (
                <p className="mt-6 text-zinc-400">
                  Für dieses Konzert wurden keine gespielten
                  Songs gespeichert.
                </p>
              ) : (
                <ol className="mt-6 space-y-4">
                  {songs.map((song, index) => (
                    <li
                      key={`${song.song_id}-${song.played_at}`}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-black">
                          {index + 1}. {song.song_title}
                        </div>

                        <div className="mt-1 text-sm text-zinc-400">
                          {song.artist}
                        </div>

                        <div className="mt-2 text-xs text-zinc-500">
                          Gespielt um{" "}
                          {new Date(
                            song.played_at,
                          ).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <div className="text-2xl font-black text-red-500">
                          {getVoteCount(song.song_id)}
                        </div>

                        <div className="text-xs text-zinc-500">
                          {getVoteCount(song.song_id) === 1
                            ? "Stimme"
                            : "Stimmen"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}