"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import AdminNavigation from "../../../components/AdminNavigation";

export default function NewSongPage() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    async function addSong(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const trimmedTitle = title.trim();
        const trimmedArtist = artist.trim();

        if (!trimmedTitle || !trimmedArtist) {
            setErrorMessage("Bitte Titel und Interpret eingeben.");
            return;
        }

        setIsSaving(true);
        setErrorMessage("");

        const { error } = await supabase.from("songs").insert({
            title: trimmedTitle,
            artist: trimmedArtist,
            is_active: true,
        });

        setIsSaving(false);

        if (error) {
            console.error("Fehler beim Hinzufügen:", error);
            setErrorMessage("Der Song konnte nicht hinzugefügt werden.");
            return;
        }

        router.push("/admin/songs");
        router.refresh();
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white">
            <div className="mx-auto max-w-3xl">
                <AdminNavigation />

                <Link
                    href="/admin/songs"
                    className="mt-8 inline-flex text-sm font-bold text-zinc-400 transition hover:text-white"
                >
                    ← Zurück zur Songverwaltung
                </Link>

                <h1 className="mt-5 text-4xl font-black sm:text-5xl">
                    Neuen Song hinzufügen
                </h1>

                <p className="mt-3 text-zinc-400">
                    Trage Titel und Interpret ein. Der neue Song wird direkt im
                    Repertoire aktiviert.
                </p>

                <form
                    onSubmit={addSong}
                    className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8"
                >
                    {errorMessage && (
                        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
                            {errorMessage}
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="title"
                            className="mb-2 block font-bold text-white"
                        >
                            Titel
                        </label>

                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Zum Beispiel T.N.T."
                            autoFocus
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
                        />
                    </div>

                    <div className="mt-5">
                        <label
                            htmlFor="artist"
                            className="mb-2 block font-bold text-white"
                        >
                            Interpret
                        </label>

                        <input
                            id="artist"
                            type="text"
                            value={artist}
                            onChange={(event) => setArtist(event.target.value)}
                            placeholder="Zum Beispiel AC/DC"
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
                        />
                    </div>

                    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Link
                            href="/admin/songs"
                            className="rounded-xl bg-zinc-700 px-5 py-3 text-center font-bold text-white transition hover:bg-zinc-600"
                        >
                            Abbrechen
                        </Link>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving
                                ? "Song wird hinzugefügt …"
                                : "+ Song hinzufügen"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}