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
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
        PDF-Viewer wird geladen …
      </div>
    ),
  },
);

type VisiblePdf = {
  id: number;
  storage_path: string;
  user_id: string;
};

export default function PdfPage() {
  const params = useParams<{ songId?: string }>();
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
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadPdf() {
      setLoading(true);
      setErrorMessage("");
      setPdfUrl(null);
      setPdfSource(null);

      if (
        !Number.isFinite(songId) ||
        songId <= 0
      ) {
        setErrorMessage(
          "Die Song-ID ist ungültig.",
        );
        setLoading(false);
        return;
      }

      try {
        /*
         * Benutzer und Songdaten gleichzeitig laden.
         * Dadurch sparen wir bereits einen seriellen
         * Netzwerk-Schritt.
         */
        const [userResponse, songResponse] =
          await Promise.all([
            supabase.auth.getUser(),

            supabase
              .from("songs")
              .select("title, artist")
              .eq("id", songId)
              .maybeSingle(),
          ]);

        const user = userResponse.data.user;

        if (userResponse.error || !user) {
          throw new Error(
            "Du bist nicht angemeldet.",
          );
        }

        if (songResponse.error) {
          console.error(
            "Songdaten konnten nicht geladen werden:",
            songResponse.error,
          );
        }

        if (songResponse.data) {
          const song = songResponse.data;

          setSongTitle(
            song.artist
              ? `${song.title} – ${song.artist}`
              : song.title,
          );
        }

        /*
         * Nur eine Abfrage für eigene UND geteilte PDFs.
         *
         * RLS sorgt bereits dafür, dass nur PDFs
         * zurückkommen, auf die der Benutzer Zugriff hat.
         */
        const {
          data: visiblePdfs,
          error: pdfError,
        } = await supabase
          .from("song_pdfs")
          .select("id, storage_path, user_id")
          .eq("song_id", songId);

        if (pdfError) {
          throw new Error(
            `PDF konnte nicht geprüft werden: ${pdfError.message}`,
          );
        }

        const pdfs =
          (visiblePdfs ?? []) as VisiblePdf[];

        /*
         * Persönliche PDF hat immer Vorrang.
         */
        const ownPdf = pdfs.find(
          (pdf) => pdf.user_id === user.id,
        );

        const selectedPdf =
          ownPdf ?? pdfs[0] ?? null;

        if (!selectedPdf) {
          setErrorMessage(
            "Für diesen Song gibt es weder eine eigene noch eine für dich freigegebene PDF.",
          );
          setLoading(false);
          return;
        }

        setPdfSource(
          selectedPdf.user_id === user.id
            ? "own"
            : "shared",
        );

        /*
         * Signed URL erzeugen.
         */
        const {
          data: signedUrlData,
          error: signedUrlError,
        } = await supabase.storage
          .from("song-pdfs")
          .createSignedUrl(
            selectedPdf.storage_path,
            3600,
          );

        if (
          signedUrlError ||
          !signedUrlData?.signedUrl
        ) {
          console.error(
            "PDF-Link konnte nicht erstellt werden:",
            signedUrlError,
          );

          throw new Error(
            "Die PDF wurde gefunden, konnte aber nicht geöffnet werden.",
          );
        }

        setPdfUrl(signedUrlData.signedUrl);
      } catch (error) {
        console.error(
          "PDF konnte nicht geladen werden:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Die PDF konnte nicht geladen werden.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPdf();
  }, [songId]);

  return (
    <main className="flex h-screen min-h-0 flex-col bg-zinc-950 text-white">
      <header className="flex shrink-0 items-center gap-4 border-b border-white/10 bg-zinc-900 px-4 py-3 shadow-xl">
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
            className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-bold transition hover:bg-red-500"
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