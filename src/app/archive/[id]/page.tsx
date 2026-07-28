"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  const params = useParams<{ id: string }>();
  const concertId = params.id;

  const [concert, setConcert] = useState<Concert | null>(null);
  const [songs, setSongs] = useState<PlayedSong[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  useEffect(() => {
    if (concertId) {
      loadConcert();
      loadSongs();
      loadVotes();
    }
  }, [concertId]);

  async function loadConcert() {
    const { data, error } = await supabase
      .from("concerts")
      .select("id, name, created_at")
      .eq("id", concertId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setConcert(data);
  }

  async function loadSongs() {
    const { data, error } = await supabase
      .from("played_songs")
      .select("song_id, song_title, artist, played_at")
      .eq("concert_id", concertId)
      .order("played_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setSongs(data ?? []);
  }

  async function loadVotes() {
    const { data, error } = await supabase
      .from("votes")
      .select("song_id")
      .eq("concert_id", concertId);

    if (error) {
      console.error(error);
      return;
    }

    setVotes(data ?? []);
  }

  function getVoteCount(songId: number) {
    return votes.filter((vote) => vote.song_id === songId).length;
  }

  return (
    <main className="min-h-screen bg-zinc-900 p-8 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-4xl font-bold">
          {concert?.name ?? "Lade..."}
        </h1>

        <p className="mb-8 text-gray-400">
          {concert &&
            new Date(concert.created_at).toLocaleString("de-DE")}
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {songs.length === 0 ? (
            <p className="text-gray-400">
              Für dieses Konzert wurden noch keine Songs gespielt.
            </p>
          ) : (
            <ol className="space-y-4">
              {songs.map((song, index) => (
                <li
                  key={`${song.song_id}-${song.played_at}`}
                  className="flex items-center justify-between border-b border-white/10 pb-3"
                >
                  <div>
                    <div className="font-semibold">
                      {index + 1}. {song.song_title}
                    </div>

                    <div className="text-sm text-gray-400">
                      {song.artist}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold">
                      👍 {getVoteCount(song.song_id)}
                    </div>

                    <div className="text-xs text-gray-400">
                      Stimmen
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </main>
  );
}