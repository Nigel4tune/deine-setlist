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

  const [pdfUrl, setPdfUrl] = useState<string | null>(
    null,
  );
  const [songTitle, setSongTitle] = useState("");
  const [pdfSource, setPdfSource] = useState<
    "own" | "shared" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadPdf();
  }, [songId]);

  async function loadPdf() {
    setLoading(true);
    setErrorMessage("");
    setPdfUrl(null);
    setPdfSource(null);

    if (!Number.isFinite(songId)) {
      setErrorMessage("Die Song-ID ist ungültig.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Benutzer konnte nicht geladen werden:",
        userError,
      );

      setErrorMessage("Du bist nicht angemeldet.");
      setLoading(false);
      return;
    }

    const { data: songData, error: songError } =
      await supabase
        .from("songs")
        .select("title, artist")
        .eq("id", songId)
        .maybeSingle();

    if (songError) {
      console.error(
        "Songdaten konnten nicht geladen werden:",
        songError.message,
        songError.code,
        songError.details,
        songError.hint,
      );
    }

    if (songData) {
      setSongTitle(
        songData.artist
          ? `${songData.title} – ${songData.artist}`
          : songData.title,
      );
    }

    /*
     * Schritt 1:
     * Zuerst nach der persönlichen PDF des angemeldeten
     * Bandmitglieds suchen.
     */
    const { data: ownPdf, error: ownPdfError } =
      await supabase
        .from("song_pdfs")
        .select("id, storage_path")
        .eq("song_id", songId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (ownPdfError) {
      console.error(
        "Eigene PDF konnte nicht geprüft werden:",
        ownPdfError.message,
        ownPdfError.code,
        ownPdfError.details,
        ownPdfError.hint,
      );

      setErrorMessage(
        "Die persönliche PDF konnte nicht geprüft werden.",
      );
      setLoading(false);
      return;
    }

    let selectedStoragePath: string | null = null;

    if (ownPdf) {
      /*
       * Eine persönliche PDF ist vorhanden.
       * Diese hat immer Vorrang vor einer geteilten PDF.
       */
      selectedStoragePath = ownPdf.storage_path;
      setPdfSource("own");
    } else {
      /*
       * Schritt 2:
       * Es gibt keine persönliche PDF.
       *
       * Deshalb suchen wir jetzt nach einer PDF für diesen
       * Song, die durch die RLS-Freigabe für den angemeldeten
       * Benutzer sichtbar ist.
       */
      const { data: sharedPdf, error: sharedPdfError } =
        await supabase
          .from("song_pdfs")
          .select("id, storage_path, user_id")
          .eq("song_id", songId)
          .neq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (sharedPdfError) {
        console.error(
          "Geteilte PDF konnte nicht geprüft werden:",
          sharedPdfError.message,
          sharedPdfError.code,
          sharedPdfError.details,
          sharedPdfError.hint,
        );

        setErrorMessage(
          "Eine geteilte PDF konnte nicht geprüft werden.",
        );
        setLoading(false);
        return;
      }

      if (sharedPdf) {
        selectedStoragePath = sharedPdf.storage_path;
        setPdfSource("shared");
      }
    }

    if (!selectedStoragePath) {
      setErrorMessage(
        "Für diesen Song gibt es weder eine eigene noch eine für dich freigegebene PDF.",
      );
      setLoading(false);
      return;
    }

    /*
     * Aus dem internen Storage-Pfad wird ein zeitlich
     * begrenzter Link für den PDF-Viewer erstellt.
     */
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("song-pdfs")
        .createSignedUrl(selectedStoragePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(
        "PDF-Link konnte nicht erstellt werden:",
        signedUrlError?.message,
        signedUrlError?.statusCode,
      );

      setErrorMessage(
        "Die PDF wurde gefunden, konnte aber nicht geöffnet werden.",
      );
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

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500">
            Deine Setlist
          </p>

          <h1 className="truncate text-base font-black sm:text-xl">
            {songTitle || "Song-PDF"}
          </h1>

          {!loading && pdfSource && (
            <p
              className={`mt-1 text-xs font-bold ${
                pdfSource === "own"
                  ? "text-green-400"
                  : "text-violet-400"
              }`}
            >
              {pdfSource === "own"
                ? "Persönliche PDF"
                : "Von einem Bandmitglied geteilt"}
            </p>
          )}
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