"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../lib/client";

type BandPhoto = {
  id: number;
  storage_path: string;
  position: number;
};

export default function BandGalleryManager({ bandId }: { bandId: number }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<BandPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("band_photos")
      .select("id, storage_path, position")
      .eq("band_id", bandId)
      .order("position", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      setErrorMessage("Die Galerie konnte nicht geladen werden.");
      setLoading(false);
      return;
    }

    setPhotos((data ?? []) as BandPhoto[]);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  function publicUrl(path: string) {
    return createClient().storage
      .from("band-media")
      .getPublicUrl(path).data.publicUrl;
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (photos.length >= 5) {
      setErrorMessage("Maximal fünf Bilder sind erlaubt.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Nur JPG, PNG oder WebP sind erlaubt.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Das Bild darf maximal 5 MB groß sein.");
      return;
    }

    setUploading(true);
    setErrorMessage("");
    setMessage("");

    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `bands/${bandId}/gallery/photo-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("band-media")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      setErrorMessage("Das Bild konnte nicht hochgeladen werden.");
      setUploading(false);
      return;
    }

    const nextPosition =
      photos.length === 0 ? 0 : Math.max(...photos.map((photo) => photo.position)) + 1;

    const { data, error } = await supabase
      .from("band_photos")
      .insert({
        band_id: bandId,
        storage_path: storagePath,
        position: nextPosition,
      })
      .select("id, storage_path, position")
      .single();

    if (error) {
      await supabase.storage.from("band-media").remove([storagePath]);
      setErrorMessage("Das Bild konnte nicht gespeichert werden.");
      setUploading(false);
      return;
    }

    setPhotos((current) => [...current, data as BandPhoto]);
    setMessage("Das Bild wurde hinzugefügt.");
    setUploading(false);
  }

  async function deletePhoto(photo: BandPhoto) {
    if (!window.confirm("Dieses Bild wirklich löschen?")) return;

    setBusyId(photo.id);
    setErrorMessage("");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("band_photos")
      .delete()
      .eq("id", photo.id)
      .eq("band_id", bandId);

    if (error) {
      setErrorMessage("Das Bild konnte nicht gelöscht werden.");
      setBusyId(null);
      return;
    }

    await supabase.storage.from("band-media").remove([photo.storage_path]);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    setMessage("Das Bild wurde gelöscht.");
    setBusyId(null);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl sm:p-8">
      <h2 className="text-2xl font-black">Bildergalerie</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Bis zu fünf Bilder, jeweils maximal 5 MB.
      </p>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-2xl border border-green-500/40 bg-green-950/40 px-5 py-4 text-green-200">
          {message}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void uploadPhoto(event)}
        className="hidden"
      />

      {loading ? (
        <div className="mt-6 text-zinc-400">Galerie wird geladen …</div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <article
              key={photo.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
            >
              <img
                src={publicUrl(photo.storage_path)}
                alt={`Galeriebild ${index + 1}`}
                className="aspect-[4/3] w-full object-cover"
              />

              <div className="p-3">
                <button
                  type="button"
                  onClick={() => void deletePhoto(photo)}
                  disabled={busyId === photo.id}
                  className="w-full rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                >
                  {busyId === photo.id ? "Wird gelöscht …" : "Löschen"}
                </button>
              </div>
            </article>
          ))}

          {photos.length < 5 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 transition hover:border-red-500/60 disabled:opacity-60"
            >
              <span className="text-5xl">＋</span>
              <span className="mt-3 font-black">
                {uploading ? "Bild wird hochgeladen …" : "Bild hinzufügen"}
              </span>
              <span className="mt-2 text-sm text-zinc-500">
                {photos.length} von 5
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}