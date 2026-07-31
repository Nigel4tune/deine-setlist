"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const PdfViewer = dynamic(
    () => import("../../../components/PdfViewer"),
    {
        ssr: false,
        loading: () => (
            <div className="flex min-h-[70vh] items-center justify-center text-zinc-400">
                PDF-Viewer wird geladen …
            </div>
        ),
    },
);

export default function PdfPage() {
    const params = useParams();
    const router = useRouter();

    const songId = Number(params.songId);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [songTitle, setSongTitle] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        void loadPdf();
    }, [songId]);

    async function loadPdf() {
        setLoading(true);
        setErrorMessage("");

        if (!Number.isFinite(songId)) {
            setErrorMessage("Die Song-ID ist ungültig.");
            setLoading(false);
            return;
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setErrorMessage("Du bist nicht angemeldet.");
            setLoading(false);
            return;
        }

        const { data: songData, error: songError } = await supabase
            .from("songs")
            .select("title, artist")
            .eq("id", songId)
            .maybeSingle();

        if (songError) {
            console.error(
                "Songdaten konnten nicht geladen werden:",
                songError,
            );
        }

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
            setErrorMessage(
                "Für diesen Song wurde keine PDF gefunden.",
            );
            setLoading(false);
            return;
        }

        const { data: signedUrlData, error: signedUrlError } =
            await supabase.storage
                .from("song-pdfs")
                .createSignedUrl(pdfData.storage_path, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
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
        <main className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-white">
            <header className="flex shrink-0 items-center gap-4 border-b border-white/10 bg-zinc-900 px-3 py-3 sm:px-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="shrink-0 rounded-xl bg-zinc-800 px-4 py-3 font-bold transition hover:bg-zinc-700"
                >
                    ← Zurück
                </button>

                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-500">
                        Deine Setlist
                    </p>

                    <h1 className="truncate text-base font-black sm:text-xl">
                        {songTitle || "Song-PDF"}
                    </h1>
                </div>
            </header>

            {loading ? (
                <div className="flex min-h-0 flex-1 items-center justify-center text-zinc-400">
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
            ) : pdfUrl ? (
                <PdfViewer pdfUrl={pdfUrl} />
            ) : null}
        </main>
    );
}