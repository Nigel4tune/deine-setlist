"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminNavigation from "../../components/AdminNavigation";
import {
    Pencil,
    Eye,
    EyeOff,
    Trash2,
    FileUp,
} from "lucide-react";
import PdfShareButton from "../../components/PdfShareButton";
import { getActiveBandId } from "../../lib/band";

type Song = {
    id: number;
    title: string;
    artist: string;
    is_active: boolean;
};

function normalizeSearchText(value: string) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

export default function AdminSongsPage() {
    const [songs, setSongs] = useState<Song[]>([]);
    const [bandId, setBandId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const [search, setSearch] = useState("");

    const [editingSongId, setEditingSongId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editArtist, setEditArtist] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [deletingSongId, setDeletingSongId] = useState<number | null>(null);
    const [uploadingPdfSongId, setUploadingPdfSongId] =
        useState<number | null>(null);
    const [songsWithPdf, setSongsWithPdf] = useState<Set<number>>(
        new Set(),
    );
    const [availablePdfSongIds, setAvailablePdfSongIds] =
        useState<Set<number>>(new Set());

    useEffect(() => {
        async function loadSongs() {
            setErrorMessage("");

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setErrorMessage("Du bist nicht angemeldet.");
                setLoading(false);
                return;
            }

            const activeBandId = await getActiveBandId();
            setBandId(activeBandId);

            const [
                songsResponse,
                ownPdfsResponse,
                availablePdfsResponse,
            ] = await Promise.all([
                supabase
                    .from("songs")
                    .select("id, title, artist, is_active")
                    .eq("band_id", activeBandId)
                    .order("title"),

                // Nur meine eigenen PDFs
                supabase
                    .from("song_pdfs")
                    .select("song_id")
                    .eq("band_id", activeBandId)
                    .eq("user_id", user.id),

                // Eigene und für mich freigegebene PDFs.
                // Welche Zeilen sichtbar sind, regelt Supabase über RLS.
                supabase
                    .from("song_pdfs")
                    .select("song_id")
                    .eq("band_id", activeBandId),
            ]);

            if (songsResponse.error) {
                console.error(
                    "Fehler beim Laden der Songs:",
                    songsResponse.error,
                );

                setErrorMessage(
                    "Die Songs konnten nicht geladen werden.",
                );

                setLoading(false);
                return;
            }

            if (ownPdfsResponse.error) {
                console.error(
                    "Fehler beim Laden der eigenen PDFs:",
                    ownPdfsResponse.error,
                );

                setErrorMessage(
                    "Die eigenen PDFs konnten nicht geladen werden.",
                );

                setLoading(false);
                return;
            }

            if (availablePdfsResponse.error) {
                console.error(
                    "Fehler beim Laden der verfügbaren PDFs:",
                    availablePdfsResponse.error,
                );

                setErrorMessage(
                    "Die geteilten PDFs konnten nicht geladen werden.",
                );

                setLoading(false);
                return;
            }

            setSongs(songsResponse.data ?? []);

            setSongsWithPdf(
                new Set(
                    (ownPdfsResponse.data ?? []).map(
                        (pdf) => pdf.song_id,
                    ),
                ),
            );

            setAvailablePdfSongIds(
                new Set(
                    (availablePdfsResponse.data ?? []).map(
                        (pdf) => pdf.song_id,
                    ),
                ),
            );

            setLoading(false);
        }

        loadSongs();
    }, []);

    const normalizedSearch = normalizeSearchText(search);

    const filteredSongs = songs.filter((song) => {
        if (!normalizedSearch) {
            return true;
        }

        const normalizedTitle = normalizeSearchText(song.title);
        const normalizedArtist = normalizeSearchText(song.artist);
        const normalizedSong = normalizeSearchText(
            `${song.title} ${song.artist}`
        );

        return (
            normalizedTitle.includes(normalizedSearch) ||
            normalizedArtist.includes(normalizedSearch) ||
            normalizedSong.includes(normalizedSearch)
        );
    });

    async function uploadPdf(song: Song, file: File) {
        if (bandId === null) {
            alert("Die aktive Band konnte nicht geladen werden.");
            return;
        }

        setUploadingPdfSongId(song.id);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                alert("Du bist nicht angemeldet.");
                return;
            }

            const extension = file.name.split(".").pop() ?? "pdf";

            const storagePath =
                `bands/${bandId}/${user.id}/${song.id}.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from("song-pdfs")
                .upload(storagePath, file, {
                    upsert: true,
                });

            if (uploadError) {
                console.error(uploadError);
                alert("PDF konnte nicht hochgeladen werden.");
                return;
            }

            const { error: databaseError } = await supabase
                .from("song_pdfs")
                .upsert(
                    {
                        song_id: song.id,
                        user_id: user.id,
                        band_id: bandId,
                        storage_path: storagePath,
                        file_name: file.name,
                    },
                    {
                        onConflict: "song_id,user_id",
                    },
                );

            if (databaseError) {
                console.error(databaseError);
                alert("PDF konnte nicht gespeichert werden.");
                return;
            }

            setSongsWithPdf((current) => {
                const updated = new Set(current);
                updated.add(song.id);
                return updated;
            });
            alert("PDF erfolgreich gespeichert.");
        } finally {
            setUploadingPdfSongId(null);
        }
    }
    async function saveSong(id: number) {
        if (bandId === null) {
            return;
        }

        const updatedTitle = editTitle.trim();
        const updatedArtist = editArtist.trim();

        if (!updatedTitle || !updatedArtist) {
            alert("Bitte Titel und Interpret eingeben.");
            return;
        }

        setIsSavingEdit(true);

        const { error } = await supabase
            .from("songs")
            .update({
                title: updatedTitle,
                artist: updatedArtist,
            })
            .eq("id", id)
            .eq("band_id", bandId);

        setIsSavingEdit(false);

        if (error) {
            console.error("Fehler beim Speichern:", error);
            alert("Fehler beim Speichern.");
            return;
        }

        setSongs((currentSongs) =>
            currentSongs
                .map((song) =>
                    song.id === id
                        ? {
                            ...song,
                            title: updatedTitle,
                            artist: updatedArtist,
                        }
                        : song
                )
                .sort((a, b) => a.title.localeCompare(b.title))
        );

        cancelEditing();
    }

    function cancelEditing() {
        setEditingSongId(null);
        setEditTitle("");
        setEditArtist("");
    }

    async function toggleSongStatus(song: Song) {
        if (bandId === null) {
            return;
        }

        const newStatus = !song.is_active;

        const { error } = await supabase
            .from("songs")
            .update({
                is_active: newStatus,
            })
            .eq("id", song.id)
            .eq("band_id", bandId);

        if (error) {
            console.error("Fehler beim Ändern des Status:", error);
            alert("Der Status konnte nicht geändert werden.");
            return;
        }

        setSongs((currentSongs) =>
            currentSongs.map((currentSong) =>
                currentSong.id === song.id
                    ? {
                        ...currentSong,
                        is_active: newStatus,
                    }
                    : currentSong
            )
        );
    }

    async function deleteSong(song: Song) {
        if (bandId === null) {
            return;
        }

        const confirmed = window.confirm(
            `Möchtest du „${song.title}“ von ${song.artist} wirklich endgültig löschen?\n\nDabei werden auch alle zugehörigen Abstimmungen dieses Songs gelöscht.`
        );

        if (!confirmed) {
            return;
        }

        setDeletingSongId(song.id);

        const { error } = await supabase
            .from("songs")
            .delete()
            .eq("id", song.id)
            .eq("band_id", bandId);

        setDeletingSongId(null);

        if (error) {
            console.error("Fehler beim Löschen:", error);
            alert("Der Song konnte nicht gelöscht werden.");
            return;
        }

        setSongs((currentSongs) =>
            currentSongs.filter((currentSong) => currentSong.id !== song.id)
        );

        if (editingSongId === song.id) {
            cancelEditing();
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white">
            <div className="mx-auto max-w-5xl">
                <AdminNavigation />

                <h1 className="text-4xl font-black sm:text-5xl">
                    Songverwaltung
                </h1>

                <p className="mt-3 text-zinc-400">
                    Durchsuche und verwalte hier dein komplettes Songrepertoire.
                </p>

                {errorMessage && (
                    <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
                        {errorMessage}
                    </div>
                )}

                <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                    <h2 className="mb-4 text-lg font-bold">
                        Repertoire durchsuchen
                    </h2>

                    <input
                        type="text"
                        placeholder="🔍 Song oder Interpret suchen..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-500"
                    />

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-zinc-400">
                            {search.trim()
                                ? `${filteredSongs.length} von ${songs.length} Songs`
                                : `${songs.length} Songs insgesamt`}
                        </p>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-700"
                                >
                                    Suche löschen
                                </button>
                            )}

                            <Link
                                href="/admin/songs/new"
                                className="rounded-xl bg-green-600 px-5 py-3 text-center font-bold text-white transition hover:bg-green-500"
                            >
                                + Neuen Song hinzufügen
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="mt-8">
                    <h2 className="mb-4 text-2xl font-black">Songliste</h2>

                    {loading ? (
                        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-400">
                            Songs werden geladen …
                        </div>
                    ) : filteredSongs.length === 0 ? (
                        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center">
                            <p className="font-bold text-white">
                                Keine passenden Songs gefunden.
                            </p>

                            <p className="mt-2 text-sm text-zinc-400">
                                Die Suche ignoriert Punkte, Leerzeichen und
                                andere Sonderzeichen.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-3xl border border-white/10">
                            <table className="w-full table-fixed">
                                <thead className="bg-zinc-800 text-left">
                                    <tr>
                                        <th className="px-5 py-4">Song</th>
                                        <th className="px-5 py-4">Vote</th>
                                        <th className="px-5 py-4 text-right">
                                            Aktionen
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredSongs.map((song) => (
                                        <tr
                                            key={song.id}
                                            className="border-t border-white/10 bg-zinc-900/70"
                                        >
                                            <td className="px-3 py-4 sm:px-5">
                                                {editingSongId === song.id ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={editTitle}
                                                            onChange={(event) => setEditTitle(event.target.value)}
                                                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                                                        />

                                                        <input
                                                            type="text"
                                                            value={editArtist}
                                                            onChange={(event) => setEditArtist(event.target.value)}
                                                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="font-bold text-white">
                                                            {song.title}
                                                        </div>

                                                        <div className="mt-1 text-sm text-zinc-400">
                                                            {song.artist}
                                                        </div>
                                                    </>
                                                )}
                                            </td>



                                            <td className="px-5 py-4">
                                                {song.is_active ? (
                                                    <span className="flex items-center gap-2 font-bold text-green-500">
                                                        <span className="h-3 w-3 rounded-full bg-green-500" />
                                                        ON
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2 font-bold text-zinc-400">
                                                        <span className="h-3 w-3 rounded-full bg-red-500" />
                                                        OFF
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex flex-nowrap justify-end gap-2">
                                                    {editingSongId ===
                                                        song.id ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    saveSong(
                                                                        song.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    isSavingEdit
                                                                }
                                                                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {isSavingEdit
                                                                    ? "Speichert …"
                                                                    : "Speichern"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    cancelEditing
                                                                }
                                                                disabled={
                                                                    isSavingEdit
                                                                }
                                                                className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-600 disabled:opacity-50"
                                                            >
                                                                Abbrechen
                                                            </button>
                                                        </>
                                                    ) : (

                                                        <>
                                                            <>
                                                                <input
                                                                    id={`pdf-upload-${song.id}`}
                                                                    type="file"
                                                                    accept="application/pdf"
                                                                    className="hidden"
                                                                    onChange={(event) => {
                                                                        const file = event.target.files?.[0];

                                                                        if (file) {
                                                                            uploadPdf(song, file);
                                                                        }

                                                                        event.target.value = "";
                                                                    }}
                                                                />

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        document
                                                                            .getElementById(`pdf-upload-${song.id}`)
                                                                            ?.click()
                                                                    }
                                                                    disabled={uploadingPdfSongId === song.id}
                                                                    className={`rounded-xl p-2 text-white transition disabled:opacity-50 ${availablePdfSongIds.has(song.id)
                                                                            ? "bg-green-600 hover:bg-green-500"
                                                                            : "bg-red-600 hover:bg-red-500"
                                                                        }`}
                                                                    title={
                                                                        songsWithPdf.has(song.id)
                                                                            ? "Eigene PDF hochladen oder ersetzen"
                                                                            : availablePdfSongIds.has(song.id)
                                                                                ? "Geteilte PDF vorhanden – eigene PDF hochladen"
                                                                                : "PDF hochladen"
                                                                    }
                                                                >
                                                                    <FileUp size={18} />
                                                                </button>

                                                                <PdfShareButton
                                                                    songId={song.id}
                                                                    songTitle={song.title}
                                                                    hasOwnPdf={songsWithPdf.has(song.id)}
                                                                />

                                                            </>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingSongId(song.id);
                                                                    setEditTitle(song.title);
                                                                    setEditArtist(song.artist);
                                                                }}
                                                                className="rounded-xl bg-blue-600 p-2 text-white transition hover:bg-blue-500"
                                                                title="Bearbeiten"
                                                            >
                                                                <Pencil size={18} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSongStatus(song)}
                                                                className="rounded-xl bg-zinc-700 p-2 text-white transition hover:bg-zinc-600"
                                                                title={song.is_active ? "Ausblenden" : "Einblenden"}
                                                            >
                                                                {song.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => deleteSong(song)}
                                                                disabled={deletingSongId === song.id}
                                                                className="rounded-xl bg-red-700 p-2 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                                title="Löschen"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}