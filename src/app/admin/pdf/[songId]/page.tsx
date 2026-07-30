"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function PdfPage() {
    const params = useParams();
    const router = useRouter();

    const songId = Number(params.songId);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [songTitle, setSongTitle] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        loadPdf();
    }, []);

    async function loadPdf() {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setErrorMessage("Du bist nicht angemeldet.");
            setLoading(false);
            return;
        }

        const { data: songData } = await supabase
            .from("songs")
            .select("title, artist")
            .eq("id", songId)
            .maybeSingle();

        if (songData) {
            setSongTitle(
                songData.artist
                    ? `${songData.title} – ${songData.artist}`
                    : songData.title,
            );
        }

        const { data: pdfData, error: pdfError } = await supabase
            .from("song_pdfs")
            .select("storage_path")
            .eq("song_id", songId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (pdfError || !pdfData) {
            console.error("PDF nicht gefunden:", pdfError);
            setErrorMessage("Für diesen Song wurde keine PDF gefunden.");
            setLoading(false);
            return;
        }

        const { data: signedUrlData, error: signedUrlError } =
            await supabase.storage
                .from("song-pdfs")
                .createSignedUrl(pdfData.storage_path, 3600);

        if (signedUrlError || !signedUrlData) {
            console.error(
                "PDF-Link konnte nicht erstellt werden:",
                signedUrlError,
            );
            setErrorMessage("Die PDF konnte nicht geladen werden.");
            setLoading(false);
            return;
        }

        setPdfUrl(signedUrlData.signedUrl);
        setLoading(false);
    }

    return (
        <main className="min-h-screen bg-zinc-950 text-white">
            <header className="flex items-center gap-4 border-b border-white/10 bg-zinc-900 px-4 py-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-xl bg-zinc-800 px-4 py-3 font-bold transition hover:bg-zinc-700"
                >
                    ← Zurück
                </button>

                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-500">
                        Deine Setlist
                    </p>

                    <h1 className="truncate text-lg font-black sm:text-2xl">
                        {songTitle || "Song-PDF"}
                    </h1>
                </div>
            </header>

            {loading ? (
                <div className="flex min-h-[70vh] items-center justify-center text-zinc-400">
                    PDF wird geladen …
                </div>
            ) : errorMessage ? (
                <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                    <p className="font-bold text-red-200">
                        {errorMessage}
                    </p>

                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
                    >
                        Zurück zur Setlist
                    </button>
                </div>
            ) : (
                <iframe
                    src={pdfUrl ?? ""}
                    title={songTitle || "Song-PDF"}
                    className="h-[calc(100vh-89px)] w-full border-0"
                />
            )}
        </main>
    );
}