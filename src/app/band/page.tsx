"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PublicNavigation from "../components/PublicNavigation";
import { supabase } from "../lib/supabase";
import InviteBandMember from "../../components/InviteBandMember";

type PublicBand = {
  id: number;
  name: string;
  slug: string;
};

export default function BandPage() {
  const params = useParams<{ slug?: string }>();

  const bandSlug =
    typeof params.slug === "string"
      ? params.slug
      : "no-front";

  const [band, setBand] = useState<PublicBand | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadBand() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase.rpc(
        "get_public_band_by_slug",
        {
          requested_slug: bandSlug,
        },
      );

      if (error) {
        console.error(
          "Band konnte nicht geladen werden:",
          error.message,
          error.code,
          error.details,
          error.hint,
        );

        setErrorMessage(
          "Die Bandinformationen konnten nicht geladen werden.",
        );

        setLoading(false);
        return;
      }

      const loadedBand = Array.isArray(data)
        ? data[0]
        : data;

      if (!loadedBand) {
        setErrorMessage("Diese Band wurde nicht gefunden.");
        setLoading(false);
        return;
      }

      setBand({
        id: Number(loadedBand.id),
        name: loadedBand.name,
        slug: loadedBand.slug,
      });

      setLoading(false);
    }

    void loadBand();
  }, [bandSlug]);

  const isNoFront = band?.slug === "no-front";

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 pb-28 text-white">
      {loading ? (
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl sm:p-12">
          <p className="text-zinc-400">
            Bandinformationen werden geladen …
          </p>
        </section>
      ) : errorMessage ? (
        <section className="w-full max-w-xl rounded-3xl border border-red-500/30 bg-red-950/20 p-8 text-center shadow-2xl sm:p-12">
          <div className="mb-6 text-6xl">⚠️</div>

          <h1 className="text-3xl font-black">
            Band nicht gefunden
          </h1>

          <p className="mt-5 text-red-200">
            {errorMessage}
          </p>
        </section>
      ) : band ? (
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl sm:p-12">
          <div className="mb-6 text-6xl">🚧</div>

          <p className="mb-3 text-sm font-bold uppercase tracking-[0.35em] text-red-500">
            {band.name}
          </p>

          <h1 className="text-4xl font-black sm:text-5xl">
            Web-Baustelle
          </h1>

          <p className="mx-auto mt-5 max-w-md leading-relaxed text-zinc-400">
            Hier entstehen gerade Bandinfos, Neuigkeiten,
            Konzerttermine und weitere Inhalte rund um{" "}
            {band.name}.
          </p>

          <p className="mt-6 font-semibold text-zinc-300">
            Schau bald wieder vorbei!
          </p>

          {isNoFront && (
            <a
              href="https://www.instagram.com/nofrontband/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 px-6 py-3 font-bold text-white transition hover:scale-105"
            >
              📸 @nofrontband
            </a>
          )}
        </section>
      ) : null}

      <PublicNavigation />
    </main>
  );
}