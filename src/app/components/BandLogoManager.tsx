"use client";

import {
  ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "../lib/client";

type BandLogoManagerProps = {
  bandId: number;
  logoPath: string | null;
  onLogoChanged: (logoPath: string | null) => void;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function BandLogoManager({
  bandId,
  logoPath,
  onLogoChanged,
}: BandLogoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(
    null,
  );

  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const logoUrl = useMemo(() => {
    if (!logoPath) {
      return "";
    }

    const supabase = createClient();

    return supabase.storage
      .from("band-media")
      .getPublicUrl(logoPath).data.publicUrl;
  }, [logoPath]);

  function openFilePicker() {
    if (isUploading || isDeleting) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage(
        "Bitte wähle eine JPG-, PNG- oder WebP-Datei aus.",
      );
      setSuccessMessage("");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        "Das Logo darf maximal 5 MB groß sein.",
      );
      setSuccessMessage("");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const newLogoPath =
      `bands/${bandId}/logo/logo-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("band-media")
      .upload(newLogoPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error(
        "Logo konnte nicht hochgeladen werden:",
        uploadError,
      );

      setErrorMessage(
        "Das Logo konnte nicht hochgeladen werden.",
      );
      setIsUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("bands")
      .update({
        logo_path: newLogoPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bandId);

    if (updateError) {
      console.error(
        "Logo-Pfad konnte nicht gespeichert werden:",
        updateError,
      );

      await supabase.storage
        .from("band-media")
        .remove([newLogoPath]);

      setErrorMessage(
        "Das Logo konnte nicht mit der Band verknüpft werden.",
      );
      setIsUploading(false);
      return;
    }

    const previousLogoPath = logoPath;

    onLogoChanged(newLogoPath);

    if (previousLogoPath) {
      const { error: deleteOldError } =
        await supabase.storage
          .from("band-media")
          .remove([previousLogoPath]);

      if (deleteOldError) {
        console.warn(
          "Altes Logo konnte nicht gelöscht werden:",
          deleteOldError,
        );
      }
    }

    setSuccessMessage("Das Bandlogo wurde gespeichert.");
    setIsUploading(false);
  }

  async function deleteLogo() {
    if (!logoPath || isUploading || isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      "Möchtest du das Bandlogo wirklich löschen?",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("bands")
      .update({
        logo_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bandId);

    if (updateError) {
      console.error(
        "Logo konnte nicht aus der Band entfernt werden:",
        updateError,
      );

      setErrorMessage(
        "Das Logo konnte nicht entfernt werden.",
      );
      setIsDeleting(false);
      return;
    }

    const previousLogoPath = logoPath;

    onLogoChanged(null);

    const { error: storageError } =
      await supabase.storage
        .from("band-media")
        .remove([previousLogoPath]);

    if (storageError) {
      console.warn(
        "Logo-Datei konnte nicht aus dem Storage gelöscht werden:",
        storageError,
      );
    }

    setSuccessMessage("Das Bandlogo wurde gelöscht.");
    setIsDeleting(false);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl sm:p-8">
      <h2 className="text-2xl font-black">
        Bandlogo
      </h2>

      <p className="mt-2 text-sm text-zinc-400">
        Lade ein quadratisches Logo als JPG, PNG oder WebP
        mit maximal 5 MB hoch.
      </p>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-2xl border border-green-500/40 bg-green-950/40 px-5 py-4 text-green-200">
          {successMessage}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) =>
          void handleFileChange(event)
        }
        className="hidden"
      />

      <div className="mt-6">
        {logoUrl ? (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-48 w-48 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4">
              <img
                src={logoUrl}
                alt="Aktuelles Bandlogo"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isUploading || isDeleting}
                className="rounded-2xl bg-red-600 px-6 py-4 font-black transition hover:bg-red-500 disabled:cursor-wait disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {isUploading
                  ? "Logo wird hochgeladen …"
                  : "Logo ersetzen"}
              </button>

              <button
                type="button"
                onClick={() => void deleteLogo()}
                disabled={isUploading || isDeleting}
                className="rounded-2xl border border-red-500/30 bg-red-950/30 px-6 py-4 font-bold text-red-300 transition hover:bg-red-600 hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                {isDeleting
                  ? "Logo wird gelöscht …"
                  : "Logo löschen"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isUploading || isDeleting}
            className="flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center transition hover:border-red-500/60 hover:bg-black/30 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="text-6xl">🎸</span>

            <span className="mt-5 text-xl font-black">
              {isUploading
                ? "Logo wird hochgeladen …"
                : "Bandlogo hochladen"}
            </span>

            <span className="mt-2 text-sm text-zinc-500">
              JPG, PNG oder WebP · maximal 5 MB
            </span>
          </button>
        )}
      </div>
    </section>
  );
}