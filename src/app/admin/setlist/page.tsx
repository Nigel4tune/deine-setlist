"use client";

import { useEffect, useState } from "react";
import AdminNavigation from "../../components/AdminNavigation";
import { supabase } from "../../lib/supabase";

type Song = {
    id: number;
    title: string;
    artist: string;
};

export default function SetlistPage() {
    const [songs, setSongs] = useState<Song[]>([]);
    const [setlist, setSetlist] = useState<Song[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSongs();
    }, []);

    async function loadSongs() {
        const { data, error } = await supabase
            .from("songs")
            .select("*")
            .order("title");

        if (error) {
            console.error("Fehler beim Laden der Songs:", error);
            setLoading(false);
            return;
        }

        setSongs(data ?? []);
        setLoading(false);
    }

    function addSong(song: Song) {
        const songIsAlreadyInSetlist = setlist.some(
            (setlistSong) => setlistSong.id === song.id
        );

        if (songIsAlreadyInSetlist) {
            return;
        }

        setSetlist((currentSetlist) => [...currentSetlist, song]);
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white">
            <div className="mx-auto max-w-6xl">
                <AdminNavigation />

                <h1 className="text-4xl font-black sm:text-5xl">Setlist</h1>

                <p className="mt-3 text-zinc-400">
                    Stelle hier die Setlist für dein Konzert zusammen.
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                        <div className="mb-5">
                            <h2 className="text-2xl font-bold">Verfügbare Songs</h2>

                            <p className="mt-1 text-sm text-zinc-400">
                                {songs.length} Songs verfügbar
                            </p>
                        </div>

                        {loading ? (
                            <p className="text-zinc-400">Songs werden geladen ...</p>
                        ) : songs.length === 0 ? (
                            <p className="text-zinc-400">
                                Es wurden keine Songs gefunden.
                            </p>
                        ) : (
                            <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">
                                {songs.map((song) => {
                                    const songIsAlreadyInSetlist = setlist.some(
                                        (setlistSong) => setlistSong.id === song.id
                                    );

                                    return (
                                        <div
                                            key={song.id}
                                            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-950/70 p-4"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="break-words font-semibold leading-snug">
                                                    {song.title}
                                                </div>

                                                <div className="mt-1 break-words text-sm text-zinc-400">
                                                    {song.artist}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => addSong(song)}
                                                disabled={songIsAlreadyInSetlist}
                                                className="min-w-11 shrink-0 rounded-lg bg-green-600 px-3 py-2 text-lg font-bold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                                            >
                                                {songIsAlreadyInSetlist ? "✓" : "+"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                        <div className="mb-5">
                            <h2 className="text-2xl font-bold">Aktuelle Setlist</h2>

                            <p className="mt-1 text-sm text-zinc-400">
                                {setlist.length === 0
                                    ? "Noch keine Songs ausgewählt"
                                    : `${setlist.length} Songs ausgewählt`}
                            </p>
                        </div>

                        {setlist.length === 0 ? (
                            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-6 text-center text-zinc-500">
                                Klicke links auf das Plus, um einen Song hinzuzufügen.
                            </div>
                        ) : (
                            <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">
                                {setlist.map((song, index) => (
                                    <div
                                        key={song.id}
                                        className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950/70 p-4"
                                    >
                                        <span className="mr-3 min-w-8 font-bold text-zinc-500">
                                            {index + 1}.
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <div className="break-words font-semibold leading-snug">
                                                {song.title}
                                            </div>

                                            <div className="mt-1 break-words text-sm text-zinc-400">
                                                {song.artist}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}