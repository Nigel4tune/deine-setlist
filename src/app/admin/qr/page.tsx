"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import AdminNavigation from "../../components/AdminNavigation";
import { getCurrentBand } from "../../lib/band";
import { createClient } from "../../lib/client";

export default function QRPage() {
  const qrContainerRef = useRef<HTMLDivElement | null>(null);

  const [voteUrl, setVoteUrl] = useState("");
  const [bandName, setBandName] = useState("");
  const [bandSlug, setBandSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function loadVoteUrl() {
      try {
        setErrorMessage("");

        const currentBand = await getCurrentBand();

        setBandName(currentBand.name);
        setBandSlug(currentBand.slug);

        setVoteUrl(
          `${window.location.origin}/?band=${encodeURIComponent(
            currentBand.slug,
          )}`,
        );

        const supabase = createClient();

        const { data, error } = await supabase
          .from("bands")
          .select("logo_path")
          .eq("id", currentBand.id)
          .maybeSingle();

        if (error) {
          console.warn(
            "Bandlogo konnte für die QR-Grafik nicht geladen werden:",
            error,
          );
          return;
        }

        if (data?.logo_path) {
          const publicUrl = supabase.storage
            .from("band-media")
            .getPublicUrl(data.logo_path).data.publicUrl;

          setLogoUrl(publicUrl);
        } else {
          setLogoUrl("");
        }
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

  async function loadImageFromUrl(
    url: string,
  ): Promise<HTMLImageElement> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Bild konnte nicht geladen werden.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error(
              "Bild konnte nicht verarbeitet werden.",
            ),
          );
        image.src = objectUrl;
      });

      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function svgToImage(
    svgElement: SVGSVGElement,
  ): Promise<HTMLImageElement> {
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(
      svgElement,
    );

    const svgBlob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8",
    });

    const objectUrl = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error(
              "QR-Code konnte nicht verarbeitet werden.",
            ),
          );
        image.src = objectUrl;
      });

      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function drawImageContained(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
  ) {
    const scale = Math.min(
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight,
    );

    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    context.drawImage(
      image,
      x + (maxWidth - width) / 2,
      y + (maxHeight - height) / 2,
      width,
      height,
    );
  }

  async function downloadQrGraphic() {
    if (
      !voteUrl ||
      !qrContainerRef.current ||
      isDownloading
    ) {
      return;
    }

    const svgElement =
      qrContainerRef.current.querySelector("svg");

    if (!(svgElement instanceof SVGSVGElement)) {
      setErrorMessage(
        "Der QR-Code konnte nicht für den Download vorbereitet werden.",
      );
      return;
    }

    setIsDownloading(true);
    setErrorMessage("");

    try {
      const canvas =
        document.createElement("canvas");

      /*
       * Hochauflösendes Hochformat für Druck,
       * Flyer, Tischaufsteller und Social Media.
       */
      canvas.width = 1400;
      canvas.height = 1800;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Die Download-Grafik konnte nicht erstellt werden.",
        );
      }

      // Hintergrund
      context.fillStyle = "#ffffff";
      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // Oberer schwarzer Bereich
      context.fillStyle = "#09090b";
      context.fillRect(0, 0, 1400, 470);

      /*
       * Bandlogo:
       * Falls kein Logo vorhanden ist, wird stattdessen
       * der Bandname groß dargestellt.
       */
      if (logoUrl) {
        try {
          const logoImage =
            await loadImageFromUrl(logoUrl);

          drawImageContained(
            context,
            logoImage,
            250,
            75,
            900,
            245,
          );
        } catch (error) {
          console.warn(
            "Bandlogo konnte nicht in die Download-Grafik eingebaut werden:",
            error,
          );

          context.fillStyle = "#ffffff";
          context.textAlign = "center";
          context.font =
            "900 74px Arial, Helvetica, sans-serif";

          context.fillText(
            bandName || "DEINE SETLIST",
            700,
            235,
          );
        }
      } else {
        context.fillStyle = "#ffffff";
        context.textAlign = "center";
        context.font =
          "900 74px Arial, Helvetica, sans-serif";

        context.fillText(
          bandName || "DEINE SETLIST",
          700,
          235,
        );
      }

      // DEINE SETLIST Branding
      context.fillStyle = "#ef4444";
      context.textAlign = "center";
      context.font =
        "900 38px Arial, Helvetica, sans-serif";

      context.fillText(
        "D E I N E   S E T L I S T",
        700,
        395,
      );

      // Hauptüberschrift
      context.fillStyle = "#18181b";
      context.font =
        "900 68px Arial, Helvetica, sans-serif";

      context.fillText(
        "DU ENTSCHEIDEST MIT!",
        700,
        595,
      );

           
      // QR-Karte
      context.fillStyle = "#f4f4f5";
      context.beginPath();
      context.roundRect(
        300,
        735,
        800,
        800,
        55,
      );
      context.fill();

      const qrImage =
        await svgToImage(svgElement);

      context.drawImage(
        qrImage,
        365,
        800,
        670,
        670,
      );

      // Footer
      context.fillStyle = "#18181b";
      context.font =
        "900 42px Arial, Helvetica, sans-serif";

      context.fillText(
        "QR-CODE SCANNEN & ABSTIMMEN",
        700,
        1630,
      );

      context.fillStyle = "#71717a";
      context.font =
        "500 25px Arial, Helvetica, sans-serif";

      context.fillText(
        voteUrl,
        700,
        1695,
        1180,
      );

      const dataUrl = canvas.toDataURL(
        "image/png",
        1,
      );

      const link =
        document.createElement("a");

      const safeBandName = (
        bandSlug ||
        bandName ||
        "band"
      )
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9äöüß-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      link.href = dataUrl;
      link.download = `${safeBandName}-deine-setlist-qr.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(
        "QR-Grafik konnte nicht heruntergeladen werden:",
        error,
      );

      setErrorMessage(
        "Die QR-Grafik konnte nicht erstellt werden.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-4 text-white sm:px-8">
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
            QR-Code scannen und direkt für diese Band
            abstimmen.
          </p>

          {errorMessage && (
            <div className="mt-8 rounded-3xl border border-red-500/40 bg-red-950/40 px-6 py-5 text-red-200">
              {errorMessage}
            </div>
          )}

          {voteUrl ? (
            <>
              <div
                ref={qrContainerRef}
                className="mt-10 rounded-[40px] bg-white p-8 shadow-2xl"
              >
                <QRCodeSVG
                  value={voteUrl}
                  size={350}
                  level="H"
                  includeMargin
                />
              </div>

              <p className="mt-8 break-all font-mono text-lg text-zinc-400">
                {voteUrl}
              </p>

              <button
                type="button"
                onClick={() =>
                  void downloadQrGraphic()
                }
                disabled={isDownloading}
                className="mt-7 rounded-2xl bg-red-600 px-7 py-4 text-lg font-black text-white transition hover:bg-red-500 disabled:cursor-wait disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {isDownloading
                  ? "QR-Grafik wird erstellt …"
                  : "⬇ QR-Grafik herunterladen"}
              </button>

              <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-500">
                Die Grafik enthält Bandlogo, Deine-Setlist-Schriftzug
                und QR-Code und kann für Flyer, Plakate oder
                Social-Media-Posts verwendet werden.
              </p>
            </>
          ) : !errorMessage ? (
            <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-8 text-zinc-400">
              QR-Code wird geladen …
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}