"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import PublicNavigation from "../../components/PublicNavigation";
import { supabase } from "../../lib/supabase";

type PublicBand = {
  id: number;
  name: string;
  slug: string;
  logo_path: string | null;
  description: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  booking_name: string | null;
  booking_email: string | null;
  booking_phone: string | null;
};

type PublicBandMember = {
  id: number;
  name: string;
  role: string | null;
  position: number;
};

type PublicBandPhoto = {
  id: number;
  storage_path: string;
  position: number;
};

type PublicBandEvent = {
  id: number;
  title: string | null;
  event_date: string;
  venue: string;
  location: string | null;
  ticket_url: string | null;
};

type SocialLink = {
  label: string;
  icon: string;
  href: string;
};

export default function BandPage() {
  const params = useParams<{ slug?: string }>();

  const bandSlug =
    typeof params.slug === "string"
      ? params.slug.trim().toLowerCase()
      : "no-front";

  const [band, setBand] = useState<PublicBand | null>(
    null,
  );
  const [publicMembers, setPublicMembers] = useState<
    PublicBandMember[]
  >([]);
  const [publicPhotos, setPublicPhotos] = useState<
    PublicBandPhoto[]
  >([]);
  const [publicEvents, setPublicEvents] = useState<
    PublicBandEvent[]
  >([]);
  const [activePhotoIndex, setActivePhotoIndex] =
    useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadBand() {
      setLoading(true);
      setErrorMessage("");
      setBand(null);
      setPublicMembers([]);
      setPublicPhotos([]);
      setPublicEvents([]);

      const { data, error } = await supabase.rpc(
        "get_public_band_by_slug",
        {
          requested_slug: bandSlug,
        },
      );

      if (error) {
        console.error(
          "Bandinformationen konnten nicht geladen werden:",
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

      const loadedBandId = Number(loadedBand.id);

      const {
        data: publicEventData,
        error: publicEventError,
      } = await supabase
        .from("band_events")
        .select(
          "id, title, event_date, venue, location, ticket_url",
        )
        .eq("band_id", loadedBandId)
        .eq("is_visible", true)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });

      if (publicEventError) {
        setErrorMessage(
          "Die Konzertliste konnte nicht geladen werden.",
        );
        setLoading(false);
        return;
      }

      const {
        data: publicPhotoData,
        error: publicPhotoError,
      } = await supabase
        .from("band_photos")
        .select("id, storage_path, position")
        .eq("band_id", loadedBandId)
        .order("position", { ascending: true })
        .order("id", { ascending: true });

      if (publicPhotoError) {
        setErrorMessage(
          "Die Bandgalerie konnte nicht geladen werden.",
        );
        setLoading(false);
        return;
      }

      const {
        data: publicMemberData,
        error: publicMemberError,
      } = await supabase
        .from("band_public_members")
        .select("id, name, role, position")
        .eq("band_id", loadedBandId)
        .eq("is_visible", true)
        .order("position", { ascending: true })
        .order("id", { ascending: true });

      if (publicMemberError) {
        console.error(
          "Öffentliche Bandmitglieder konnten nicht geladen werden:",
          publicMemberError.message,
          publicMemberError.code,
          publicMemberError.details,
          publicMemberError.hint,
        );

        setErrorMessage(
          "Die Bandinformationen konnten nicht vollständig geladen werden.",
        );
        setLoading(false);
        return;
      }

      setBand({
        id: loadedBandId,
        name: loadedBand.name,
        slug: loadedBand.slug,
        logo_path: loadedBand.logo_path,
        description: loadedBand.description,
        instagram_url: loadedBand.instagram_url,
        facebook_url: loadedBand.facebook_url,
        youtube_url: loadedBand.youtube_url,
        website_url: loadedBand.website_url,
        booking_name: loadedBand.booking_name,
        booking_email: loadedBand.booking_email,
        booking_phone: loadedBand.booking_phone,
      });

      setPublicMembers(
        (publicMemberData ?? []) as PublicBandMember[],
      );
      setPublicPhotos(
        (publicPhotoData ?? []) as PublicBandPhoto[],
      );
      setPublicEvents(
        (publicEventData ?? []) as PublicBandEvent[],
      );

      setLoading(false);
    }

    void loadBand();
  }, [bandSlug]);

  const closeLightbox = useCallback(() => {
    setActivePhotoIndex(null);
  }, []);

  const showPreviousPhoto = useCallback(() => {
    setActivePhotoIndex((currentIndex) => {
      if (
        currentIndex === null ||
        publicPhotos.length === 0
      ) {
        return currentIndex;
      }

      return (
        currentIndex - 1 + publicPhotos.length
      ) % publicPhotos.length;
    });
  }, [publicPhotos.length]);

  const showNextPhoto = useCallback(() => {
    setActivePhotoIndex((currentIndex) => {
      if (
        currentIndex === null ||
        publicPhotos.length === 0
      ) {
        return currentIndex;
      }

      return (currentIndex + 1) % publicPhotos.length;
    });
  }, [publicPhotos.length]);

  useEffect(() => {
    if (activePhotoIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    activePhotoIndex,
    closeLightbox,
    showNextPhoto,
    showPreviousPhoto,
  ]);

  function handleTouchStart(
    event: React.TouchEvent<HTMLDivElement>,
  ) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(
    event: React.TouchEvent<HTMLDivElement>,
  ) {
    if (touchStartX.current === null) {
      return;
    }

    const endX =
      event.changedTouches[0]?.clientX ??
      touchStartX.current;

    const difference = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(difference) < 50) {
      return;
    }

    if (difference > 0) {
      showPreviousPhoto();
    } else {
      showNextPhoto();
    }
  }

  const activePhoto =
    activePhotoIndex !== null
      ? publicPhotos[activePhotoIndex] ?? null
      : null;

  const socialLinks: SocialLink[] = band
    ? [
        band.instagram_url
          ? {
              label: "Instagram",
              icon: "📸",
              href: band.instagram_url,
            }
          : null,
        band.facebook_url
          ? {
              label: "Facebook",
              icon: "👍",
              href: band.facebook_url,
            }
          : null,
        band.youtube_url
          ? {
              label: "YouTube",
              icon: "▶️",
              href: band.youtube_url,
            }
          : null,
        band.website_url
          ? {
              label: "Website",
              icon: "🌐",
              href: band.website_url,
            }
          : null,
      ].filter(
        (link): link is SocialLink => link !== null,
      )
    : [];

  const hasBookingInformation = Boolean(
    band?.booking_name ||
      band?.booking_email ||
      band?.booking_phone,
  );

  const hasAnyPublicContent = Boolean(
    band?.description ||
      socialLinks.length > 0 ||
      publicMembers.length > 0 ||
      publicPhotos.length > 0 ||
      publicEvents.length > 0 ||
      hasBookingInformation,
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 pb-28 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        {loading ? (
          <section className="rounded-3xl border border-white/10 bg-zinc-950 p-10 text-center shadow-2xl">
            <p className="text-zinc-400">
              Bandinformationen werden geladen …
            </p>
          </section>
        ) : errorMessage ? (
          <section className="rounded-3xl border border-red-500/30 bg-red-950/20 p-10 text-center shadow-2xl">
            <div className="text-6xl">⚠️</div>

            <h1 className="mt-6 text-3xl font-black">
              Band nicht gefunden
            </h1>

            <p className="mt-4 text-red-200">
              {errorMessage}
            </p>
          </section>
        ) : band ? (
          <div className="space-y-8">
            <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 text-center shadow-2xl">
              <div className="flex min-h-64 items-center justify-center bg-gradient-to-br from-red-950/70 via-zinc-950 to-black px-6 py-16">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.4em] text-red-500">
                    Bandprofil
                  </p>

                  {band.logo_path ? (
                    <img
                      src={
                        supabase.storage
                          .from("band-media")
                          .getPublicUrl(band.logo_path)
                          .data.publicUrl
                      }
                      alt={`${band.name} Logo`}
                      className="mx-auto mt-6 max-h-48 max-w-[85%] object-contain sm:max-h-60"
                    />
                  ) : (
                    <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-7xl">
                      {band.name}
                    </h1>
                  )}
                </div>
              </div>
            </header>

{publicPhotos.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-7 shadow-xl sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                  Galerie
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Bandfotos
                </h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {publicPhotos.map((photo, index) => {
                    const photoUrl = supabase.storage
                      .from("band-media")
                      .getPublicUrl(photo.storage_path)
                      .data.publicUrl;

                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() =>
                          setActivePhotoIndex(index)
                        }
                        className={`group overflow-hidden rounded-2xl border border-white/10 bg-black text-left ${
                          index === 0 &&
                          publicPhotos.length % 2 === 1
                            ? "sm:col-span-2"
                            : ""
                        }`}
                        aria-label={`Bandfoto ${index + 1} vergrößern`}
                      >
                        <img
                          src={photoUrl}
                          alt={`Bandfoto ${index + 1}`}
                          className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {band.description && (
              <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-7 shadow-xl sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                  Über uns
                </p>

                <div className="mt-5 whitespace-pre-line text-lg leading-relaxed text-zinc-300">
                  {band.description}
                </div>
              </section>
            )}

            
            {publicMembers.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-7 shadow-xl sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                  Besetzung
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Bandmitglieder
                </h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {publicMembers.map((member) => (
                    <article
                      key={member.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-5"
                    >
                      
                      <h3 className="text-xl font-black">
                        {member.name}
                      </h3>

                      {member.role && (
                        <p className="mt-2 text-zinc-400">
                          {member.role}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {socialLinks.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-7 shadow-xl sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                  Links
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Folgt uns
                </h2>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-bold transition hover:border-red-500/60 hover:bg-zinc-800"
                    >
                      <span className="text-2xl">
                        {link.icon}
                      </span>

                      <span>{link.label}</span>

                      <span className="ml-auto text-zinc-500">
                        ↗
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {publicEvents.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-7 shadow-xl sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                  Termine
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Kommende Konzerte
                </h2>

                <div className="mt-6 space-y-4">
                  {publicEvents.map((bandEvent) => (
                    <article
                      key={bandEvent.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-xl font-black">
                            {bandEvent.title ||
                              bandEvent.venue}
                          </h3>

                          <p className="mt-3 text-zinc-300">
                            📅{" "}
                            {new Intl.DateTimeFormat(
                              "de-DE",
                              {
                                dateStyle: "full",
                                timeStyle: "short",
                              },
                            ).format(
                              new Date(
                                bandEvent.event_date,
                              ),
                            )}
                          </p>

                          <p className="mt-2 text-zinc-400">
                            📍 {bandEvent.venue}
                            {bandEvent.location
                              ? ` · ${bandEvent.location}`
                              : ""}
                          </p>
                        </div>

                        {bandEvent.ticket_url && (
                          <a
                            href={bandEvent.ticket_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-2xl bg-red-600 px-5 py-3 text-center font-black transition hover:bg-red-500"
                          >
                            Tickets ↗
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {hasBookingInformation && (
              <section className="rounded-3xl border border-red-500/20 bg-red-950/15 p-7 shadow-xl sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-400">
                  Kontakt
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Booking und Anfragen
                </h2>

                <div className="mt-6 space-y-3 text-zinc-300">
                  {band.booking_name && (
                    <p className="text-lg font-bold text-white">
                      {band.booking_name}
                    </p>
                  )}

                  {band.booking_email && (
                    <a
                      href={`mailto:${band.booking_email}`}
                      className="block break-all transition hover:text-red-300"
                    >
                      ✉️ {band.booking_email}
                    </a>
                  )}

                  {band.booking_phone && (
                    <a
                      href={`tel:${band.booking_phone.replace(
                        /\s+/g,
                        "",
                      )}`}
                      className="block transition hover:text-red-300"
                    >
                      📞 {band.booking_phone}
                    </a>
                  )}
                </div>
              </section>
            )}

            {!hasAnyPublicContent && (
              <section className="rounded-3xl border border-dashed border-white/10 bg-zinc-900/50 p-10 text-center">
                <p className="text-xl font-black">
                  Diese Bandseite wird gerade aufgebaut.
                </p>

                <p className="mt-3 text-zinc-400">
                  Weitere Informationen folgen bald.
                </p>
              </section>
            )}
          </div>
        ) : null}
      </div>

      {activePhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Bandfoto in Vollbild"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-4 py-3 text-2xl font-black text-white transition hover:bg-white/20"
            aria-label="Vollbild schließen"
          >
            ✕
          </button>

          {publicPhotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showPreviousPhoto();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-4 text-3xl font-black text-white transition hover:bg-white/20 sm:left-6"
                aria-label="Vorheriges Bild"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextPhoto();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-4 text-3xl font-black text-white transition hover:bg-white/20 sm:right-6"
                aria-label="Nächstes Bild"
              >
                ›
              </button>
            </>
          )}

          <div
            className="flex max-h-[90vh] max-w-[92vw] flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={
                supabase.storage
                  .from("band-media")
                  .getPublicUrl(activePhoto.storage_path)
                  .data.publicUrl
              }
              alt={`Bandfoto ${
                (activePhotoIndex ?? 0) + 1
              }`}
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />

            {publicPhotos.length > 1 && (
              <p className="mt-4 text-sm font-bold text-zinc-300">
                {(activePhotoIndex ?? 0) + 1} von{" "}
                {publicPhotos.length}
              </p>
            )}
          </div>
        </div>
      )}

      <PublicNavigation />
    </main>
  );
}