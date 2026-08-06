"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import AdminNavigation from "../../components/AdminNavigation";
import { getCurrentBand } from "../../lib/band";

export default function QRPage() {
  const [voteUrl, setVoteUrl] = useState("");
  const [bandName, setBandName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadVoteUrl() {
      try {
        const currentBand = await getCurrentBand();

        setBandName(currentBand.name);
        setVoteUrl(
          `${window.location.origin}/?band=${encodeURIComponent(
            currentBand.slug,
          )}`,
        );
      } catch (error) {
        console.error(
          "QR-Code konnte nicht geladen werden:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Der QR-Code konnte nicht geladen werden.",
        );
      }
    }

    void loadVoteUrl();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />

        <div className="mt-10 flex flex-col items-center text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            {bandName || "Deine Setlist"}
          </p>

          <h1 className="mt-3 text-5xl font-black">
            Publikum abstimmen lassen
          </h1>

          <p className="mt-5 max-w-xl text-lg text-zinc-400">
            QR-Code scannen und direkt für diese Band abstimmen.
          </p>

          {errorMessage ? (
            <div className="mt-10 rounded-3xl border border-red-500/40 bg-red-950/40 px-6 py-5 text-red-200">
              {errorMessage}
            </div>
          ) : voteUrl ? (
            <>
              <div className="mt-10 rounded-[40px] bg-white p-8 shadow-2xl">
                <QRCodeSVG value={voteUrl} size={350} />
              </div>

              <p className="mt-8 break-all font-mono text-lg text-zinc-400">
                {voteUrl}
              </p>
            </>
          ) : (
            <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-8 text-zinc-400">
              QR-Code wird geladen …
            </div>
          )}
        </div>
      </div>
    </main>
  );
}