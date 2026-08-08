"use client";

import dynamic from "next/dynamic";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { getActiveBandId } from "../../../lib/band";
import { getActiveConcertId } from "../../../lib/concert";
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

type SetlistRow = {
  id: number;
  position: number;
  item_type: "song" | "request";
  request_number: number | null;
  song_id: number | null;
  assigned_song_id: number | null;
};

type SetlistNavigationItem = {
  setlistItemId: number;
  position: number;
  itemType: "song" | "request";
  requestNumber: number | null;
  effectiveSongId: number | null;
};

export default function PdfPage() {
  const params = useParams<{ songId?: string }>();
  const router = useRouter();

  const routeSongId = Number(params.songId);

  const [pdfUrl, setPdfUrl] = useState<string | null>(
    null,
  );
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [pdfSource, setPdfSource] = useState<
    "own" | "shared" | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [noPdfMessage, setNoPdfMessage] =
    useState("");

  const [isSetlistMode, setIsSetlistMode] =
    useState(false);
  const [
    setlistNavigation,
    setSetlistNavigation,
  ] = useState<SetlistNavigationItem[]>([]);
  const [currentSetlistIndex, setCurrentSetlistIndex] =
    useState<number | null>(null);
  const [currentSetlistItemId, setCurrentSetlistItemId] =
    useState<number | null>(null);
  const [currentEffectiveSongId, setCurrentEffectiveSongId] =
    useState<number | null>(null);
  const [currentLiveSongId, setCurrentLiveSongId] =
    useState<number | null>(null);
  const [isSettingLiveSong, setIsSettingLiveSong] =
    useState(false);
  const [liveError, setLiveError] = useState("");

  const navigateToSetlistIndex = useCallback(
    (targetIndex: number) => {
      const target =
        setlistNavigation[targetIndex];

      if (!target) {
        return;
      }

      /*
       * Bei einem noch unbelegten Wunschsong gibt es
       * keine Song-ID. Die Position identifiziert den
       * Setlist-Eintrag trotzdem eindeutig.
       */
      const targetSongId =
        target.effectiveSongId ?? 0;

      router.push(
        `/admin/pdf/${targetSongId}?from=setlist&position=${target.position}`,
      );
    },
    [router, setlistNavigation],
  );

  const goToPreviousSong = useCallback(() => {
    if (
      currentSetlistIndex === null ||
      currentSetlistIndex <= 0
    ) {
      return;
    }

    navigateToSetlistIndex(
      currentSetlistIndex - 1,
    );
  }, [
    currentSetlistIndex,
    navigateToSetlistIndex,
  ]);

  const goToNextSong = useCallback(() => {
    if (
      currentSetlistIndex === null ||
      currentSetlistIndex >=
        setlistNavigation.length - 1
    ) {
      return;
    }

    navigateToSetlistIndex(
      currentSetlistIndex + 1,
    );
  }, [
    currentSetlistIndex,
    navigateToSetlistIndex,
    setlistNavigation.length,
  ]);

  useEffect(() => {
    async function loadPdf() {
      setLoading(true);
      setErrorMessage("");
      setNoPdfMessage("");
      setPdfUrl(null);
      setPdfSource(null);
      setSongTitle("");
      setSongArtist("");
      setSetlistNavigation([]);
      setCurrentSetlistIndex(null);
      setCurrentSetlistItemId(null);
      setCurrentEffectiveSongId(null);
      setLiveError("");

      const searchParams =
        new URLSearchParams(
          window.location.search,
        );

      const openedFromSetlist =
        searchParams.get("from") === "setlist";

      const requestedPosition = Number(
        searchParams.get("position"),
      );

      setIsSetlistMode(openedFromSetlist);

      try {
        const userResponse =
          await supabase.auth.getUser();

        const user = userResponse.data.user;

        if (userResponse.error || !user) {
          throw new Error(
            "Du bist nicht angemeldet.",
          );
        }

        let effectiveSongId: number | null =
          Number.isFinite(routeSongId) &&
          routeSongId > 0
            ? routeSongId
            : null;

        let currentItem:
          | SetlistNavigationItem
          | null = null;

        if (openedFromSetlist) {
          const activeBandId =
            await getActiveBandId();

          const {
            data: setlistData,
            error: setlistError,
          } = await supabase
            .from("setlist_items")
            .select(
              "id, position, item_type, request_number, song_id, assigned_song_id",
            )
            .eq("band_id", activeBandId)
            .order("position", {
              ascending: true,
            });

          if (setlistError) {
            throw new Error(
              `Setlist konnte nicht geladen werden: ${setlistError.message}`,
            );
          }

          const navigationItems = (
            (setlistData ?? []) as SetlistRow[]
          ).map(
            (
              item,
            ): SetlistNavigationItem => ({
              setlistItemId: item.id,
              position: item.position,
              itemType: item.item_type,
              requestNumber:
                item.request_number,
              effectiveSongId:
                item.item_type === "song"
                  ? item.song_id
                  : item.assigned_song_id,
            }),
          );

          setSetlistNavigation(
            navigationItems,
          );

          let foundIndex = -1;

          /*
           * Navigation über Vor/Zurück enthält immer
           * die Setlist-Position. Das ist genauer als
           * nur nach Song-ID zu suchen.
           */
          if (
            Number.isInteger(
              requestedPosition,
            ) &&
            requestedPosition > 0
          ) {
            foundIndex =
              navigationItems.findIndex(
                (item) =>
                  item.position ===
                  requestedPosition,
              );
          }

          /*
           * Beim ersten Öffnen aus der Live-Setlist
           * existiert noch kein position-Parameter.
           */
          if (
            foundIndex < 0 &&
            effectiveSongId !== null
          ) {
            foundIndex =
              navigationItems.findIndex(
                (item) =>
                  item.effectiveSongId ===
                  effectiveSongId,
              );
          }

          if (foundIndex < 0) {
            throw new Error(
              "Der Song wurde in der aktuellen Setlist nicht gefunden.",
            );
          }

          currentItem =
            navigationItems[foundIndex];

          setCurrentSetlistIndex(
            foundIndex,
          );
          setCurrentSetlistItemId(
            currentItem.setlistItemId,
          );
          setCurrentEffectiveSongId(
            currentItem.effectiveSongId,
          );

          effectiveSongId =
            currentItem.effectiveSongId;

          /*
           * Falls ein Konzert aktiv ist, merken wir uns,
           * welcher Song aktuell öffentlich als LIVE gilt.
           * Fehlt ein aktives Konzert, bleibt der PDF-Viewer
           * trotzdem ganz normal nutzbar.
           */
          try {
            const concertId =
              await getActiveConcertId(
                activeBandId,
              );

            const {
              data: currentSongData,
            } = await supabase
              .from("current_song")
              .select("song_id")
              .eq("concert_id", concertId)
              .eq("band_id", activeBandId)
              .maybeSingle();

            setCurrentLiveSongId(
              typeof currentSongData?.song_id ===
                "number"
                ? currentSongData.song_id
                : null,
            );
          } catch {
            setCurrentLiveSongId(null);
          }
        }

        /*
         * Noch unbelegter Wunschsong:
         * Er bleibt Teil der Navigation, obwohl es
         * weder Song noch PDF gibt.
         */
        if (effectiveSongId === null) {
          if (
            openedFromSetlist &&
            currentItem?.itemType ===
              "request"
          ) {
            setSongTitle(
              `Wunschsong ${
                currentItem.requestNumber ??
                ""
              }`.trim(),
            );
            setSongArtist(
              "Publikumswunsch",
            );
            setNoPdfMessage(
              "Noch kein Song zugewiesen.",
            );
            return;
          }

          throw new Error(
            "Die Song-ID ist ungültig.",
          );
        }

        const songResponse =
          await supabase
            .from("songs")
            .select("title, artist")
            .eq("id", effectiveSongId)
            .maybeSingle();

        if (songResponse.error) {
          throw new Error(
            `Songdaten konnten nicht geladen werden: ${songResponse.error.message}`,
          );
        }

        if (!songResponse.data) {
          throw new Error(
            "Der Song wurde nicht gefunden.",
          );
        }

        setSongTitle(
          songResponse.data.title,
        );
        setSongArtist(
          songResponse.data.artist ?? "",
        );

        /*
         * RLS liefert eigene und für den Benutzer
         * freigegebene PDFs. Die persönliche Version
         * hat weiterhin Vorrang.
         */
        const {
          data: visiblePdfs,
          error: pdfError,
        } = await supabase
          .from("song_pdfs")
          .select(
            "id, storage_path, user_id",
          )
          .eq(
            "song_id",
            effectiveSongId,
          );

        if (pdfError) {
          throw new Error(
            `PDF konnte nicht geprüft werden: ${pdfError.message}`,
          );
        }

        const pdfs =
          (visiblePdfs ??
            []) as VisiblePdf[];

        const ownPdf = pdfs.find(
          (pdf) =>
            pdf.user_id === user.id,
        );

        const selectedPdf =
          ownPdf ?? pdfs[0] ?? null;

        if (!selectedPdf) {
          /*
           * Im Live-Setlist-Modus ist eine fehlende
           * PDF kein Fehler, sondern ein normaler
           * Setlist-Schritt.
           */
          if (openedFromSetlist) {
            setNoPdfMessage(
              "Für diesen Song ist keine PDF hinterlegt.",
            );
            return;
          }

          throw new Error(
            "Für diesen Song gibt es weder eine eigene noch eine für dich freigegebene PDF.",
          );
        }

        setPdfSource(
          selectedPdf.user_id === user.id
            ? "own"
            : "shared",
        );

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
          throw new Error(
            "Die PDF wurde gefunden, konnte aber nicht geöffnet werden.",
          );
        }

        setPdfUrl(
          signedUrlData.signedUrl,
        );
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
  }, [routeSongId]);

  async function setCurrentSongLive() {
    if (
      !isSetlistMode ||
      currentSetlistItemId === null ||
      currentEffectiveSongId === null ||
      !songTitle ||
      isSettingLiveSong
    ) {
      return;
    }

    setIsSettingLiveSong(true);
    setLiveError("");

    try {
      const activeBandId =
        await getActiveBandId();

      const concertId =
        await getActiveConcertId(
          activeBandId,
        );

      const { error } = await supabase
        .from("current_song")
        .upsert(
          {
            concert_id: concertId,
            band_id: activeBandId,
            setlist_item_id:
              currentSetlistItemId,
            song_id:
              currentEffectiveSongId,
            song_title: songTitle,
            artist: songArtist,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "concert_id",
          },
        );

      if (error) {
        throw new Error(
          error.message ||
            "Der Song konnte nicht als LIVE gesetzt werden.",
        );
      }

      setCurrentLiveSongId(
        currentEffectiveSongId,
      );
    } catch (error) {
      console.error(
        "Aktueller Song konnte nicht gesetzt werden:",
        error,
      );

      setLiveError(
        error instanceof Error
          ? error.message
          : "Der Song konnte nicht als LIVE gesetzt werden.",
      );
    } finally {
      setIsSettingLiveSong(false);
    }
  }

  /*
   * Footswitch/Tastatur:
   * Ein Footswitch muss lediglich ArrowLeft bzw.
   * ArrowRight als Tastaturtaste senden.
   */
  useEffect(() => {
    if (!isSetlistMode) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousSong();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextSong();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isSetlistMode,
    goToPreviousSong,
    goToNextSong,
  ]);

  const hasPreviousSong =
    isSetlistMode &&
    currentSetlistIndex !== null &&
    currentSetlistIndex > 0;

  const hasNextSong =
    isSetlistMode &&
    currentSetlistIndex !== null &&
    currentSetlistIndex <
      setlistNavigation.length - 1;

  return (
    <main className="flex h-screen min-h-0 flex-col bg-zinc-950 text-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-zinc-900 px-3 py-2 shadow-xl sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => {
            if (isSetlistMode) {
              router.push("/admin/setlist");
              return;
            }

            router.back();
          }}
          className="shrink-0 rounded-xl bg-zinc-800 px-3 py-2.5 text-sm font-bold transition hover:bg-zinc-700 sm:px-4 sm:py-3"
        >
          ← Zurück
        </button>

        {isSetlistMode && (
          <>
            <button
              type="button"
              onClick={goToPreviousSong}
              disabled={!hasPreviousSong}
              className="shrink-0 rounded-xl bg-zinc-800 px-3 py-2.5 text-sm font-bold transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:py-3"
              title="Vorheriger Song · Pfeiltaste links"
            >
              ← <span className="hidden sm:inline">Vorheriger Song</span>
              <span className="sm:hidden">Vorheriger</span>
            </button>

            <button
              type="button"
              onClick={goToNextSong}
              disabled={!hasNextSong}
              className="shrink-0 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 sm:px-4 sm:py-3"
              title="Nächster Song · Pfeiltaste rechts"
            >
              <span className="hidden sm:inline">Nächster Song</span>
              <span className="sm:hidden">Nächster</span> →
            </button>
          </>
        )}

        <div className="min-w-0 flex-1 pl-1">
          <h1 className="truncate text-sm font-black sm:text-lg">
            {songTitle || "Song-PDF"}
            {songArtist
              ? ` – ${songArtist}`
              : ""}
          </h1>
        </div>

        {isSetlistMode && (
          <button
            type="button"
            onClick={() =>
              void setCurrentSongLive()
            }
            disabled={
              loading ||
              isSettingLiveSong ||
              currentEffectiveSongId === null ||
              currentSetlistItemId === null
            }
            className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-black transition sm:px-4 sm:py-3 ${
  currentLiveSongId ===
  currentEffectiveSongId &&
  currentEffectiveSongId !== null
    ? "bg-red-600 text-white hover:bg-red-500"
    : "bg-blue-600 text-white hover:bg-blue-500"
} disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500`}
            title={
              currentEffectiveSongId === null
                ? "Noch kein Song zugewiesen"
                : currentLiveSongId ===
                    currentEffectiveSongId
                  ? "Dieser Song ist aktuell LIVE"
                  : "Song im öffentlichen Live-Bereich anzeigen"
            }
          >
            {isSettingLiveSong
              ? "…"
              : currentLiveSongId ===
                    currentEffectiveSongId &&
                  currentEffectiveSongId !== null
                ? "● LIVE"
                : "▶ Play"}
          </button>
        )}
      </header>

      {liveError && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-950/40 px-4 py-2 text-center text-sm font-bold text-red-200">
          {liveError}
        </div>
      )}

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
      ) : noPdfMessage ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-900/80 p-8 text-center shadow-2xl">
            <div className="text-5xl">
              📄
            </div>

            <p className="mt-5 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
              Deine Setlist
            </p>

            <h2 className="mt-2 text-3xl font-black">
              {songTitle}
            </h2>

            {songArtist && (
              <p className="mt-2 text-lg text-zinc-400">
                {songArtist}
              </p>
            )}

            <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 px-5 py-5">
              <p className="font-bold text-zinc-300">
                {noPdfMessage}
              </p>
            </div>

            {isSetlistMode && (
              <p className="mt-5 text-sm text-zinc-500">
                Mit „Vorheriger Song“ und „Nächster Song“
                kannst du trotzdem in der Setlist weitergehen.
              </p>
            )}
          </section>
        </div>
      ) : pdfUrl ? (
        <PdfViewer pdfUrl={pdfUrl} />
      ) : null}
    </main>
  );
}