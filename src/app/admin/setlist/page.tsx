"use client";

import { useEffect, useState } from "react";
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";

import {
    SortableContext,
    arrayMove,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import AdminNavigation from "../../components/AdminNavigation";
import { supabase } from "../../lib/supabase";
import SortableSetlist from "../../components/SortableSetlist";

type Song = {
    id: number;
    title: string;
    artist: string;
};

type SetlistItem = {
    id: number;               // Song-ID
    setlistItemId: number;    // ID aus setlist_items

    title: string;
    artist: string;

    itemType: "song" | "request";

    requestNumber?: number;
};

type SetlistView = "live" | "builder";

export default function SetlistPage() {
    const [view, setView] = useState<SetlistView>("live");
    const [songs, setSongs] = useState<Song[]>([]);
    const [setlist, setSetlist] = useState<SetlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [songsWithPdf, setSongsWithPdf] = useState<Set<number>>(
        new Set(),
    );

    useEffect(() => {
        loadSongs();
        loadSetlist();
    }, []);

    async function loadSongs() {
        const { data, error } = await supabase
            .from("songs")
            .select("id, title, artist")
            .order("title");

        if (error) {
            console.error("Fehler beim Laden der Songs:", error);
            setLoading(false);
            return;
        }

        setSongs(data ?? []);
        setLoading(false);
    }
    async function loadSetlist() {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            console.error("Kein Benutzer angemeldet.");
            return;
        }

        const [setlistResponse, pdfsResponse] = await Promise.all([
            supabase
                .from("setlist_items")
                .select(`
            id,
            item_type,
            request_number,
            position,
            assigned_song_id,
            song:song_id (
                id,
                title,
                artist
            ),
            assignedSong:assigned_song_id (
                id,
                title,
                artist
            )
        `)
                .order("position"),

            supabase
                .from("song_pdfs")
                .select("song_id")
                .eq("user_id", user.id),
        ]);

        if (setlistResponse.error) {
            console.error(
                "Fehler beim Laden der Setlist:",
                setlistResponse.error,
            );
            return;
        }

        if (pdfsResponse.error) {
            console.error(
                "Fehler beim Laden der PDFs:",
                pdfsResponse.error,
            );
            return;
        }

        const data = setlistResponse.data;

        setSongsWithPdf(
            new Set(
                (pdfsResponse.data ?? []).map(
                    (pdf) => pdf.song_id,
                ),
            ),
        );

        const loadedItems: SetlistItem[] =
            data?.map((item: any) => {
                if (item.item_type === "song") {
                    return {
                        id: item.song.id,
                        setlistItemId: item.id,
                        title: item.song.title,
                        artist: item.song.artist,
                        itemType: "song",
                    };
                }

                if (item.assignedSong) {
                    return {
                        id: item.assignedSong.id,
                        setlistItemId: item.id,
                        title: item.assignedSong.title,
                        artist: item.assignedSong.artist,
                        itemType: "request",
                        requestNumber: item.request_number,
                    };
                }

                return {
                    id: -item.request_number,
                    setlistItemId: item.id,
                    title: `Wunschsong ${item.request_number}`,
                    artist:
                        "Publikumswunsch – wird während des Konzerts gefüllt",
                    itemType: "request",
                    requestNumber: item.request_number,
                };
            }) ?? [];

        setSetlist(loadedItems);
    }
    function openPdf(songId: number) {
        window.location.href = `/admin/pdf/${songId}`;
    }

    async function addSong(song: Song) {
        const songIsAlreadyInSetlist = setlist.some(
            (setlistSong) => setlistSong.id === song.id,
        );

        if (songIsAlreadyInSetlist) {
            return;
        }

        const { data: lastItem, error: positionError } = await supabase
            .from("setlist_items")
            .select("position")
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (positionError) {
            console.error("Fehler beim Ermitteln der Position:", {
                message: positionError.message,
                code: positionError.code,
                details: positionError.details,
                hint: positionError.hint,
            });
            return;
        }

        const nextPosition = (lastItem?.position ?? 0) + 1;

        const { error } = await supabase.from("setlist_items").insert({
            position: nextPosition,
            item_type: "song",
            song_id: song.id,
        });

        if (error) {
            console.error("Fehler beim Speichern des Songs:", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
            });
            return;
        }

        await loadSetlist();
    }
    async function addRequestPlaceholder() {
        const { data: lastPositionData, error: positionError } = await supabase
            .from("setlist_items")
            .select("position")
            .order("position", { ascending: false })
            .limit(1);

        if (positionError) {
            console.error("Fehler beim Ermitteln der Position:", positionError);
            return;
        }

        const nextPosition =
            lastPositionData && lastPositionData.length > 0
                ? lastPositionData[0].position + 1
                : 1;

        const { data: lastRequestData, error: requestError } = await supabase
            .from("setlist_items")
            .select("request_number")
            .eq("item_type", "request")
            .order("request_number", { ascending: false })
            .limit(1);

        if (requestError) {
            console.error(
                "Fehler beim Ermitteln der Wunschsong-Nummer:",
                requestError,
            );
            return;
        }

        const nextRequestNumber =
            lastRequestData &&
                lastRequestData.length > 0 &&
                lastRequestData[0].request_number
                ? lastRequestData[0].request_number + 1
                : 1;

        const { error } = await supabase.from("setlist_items").insert({
            position: nextPosition,
            item_type: "request",
            song_id: null,
            assigned_song_id: null,
            request_number: nextRequestNumber,
        });

        if (error) {
            console.error("Fehler beim Hinzufügen des Wunschsongs:", error);
            return;
        }

        await loadSetlist();
    }

    async function removeSong(itemId: number) {
        const isRequest = itemId < 0;

        let deleteQuery = supabase
            .from("setlist_items")
            .delete();

        if (isRequest) {
            deleteQuery = deleteQuery
                .eq("item_type", "request")
                .eq("request_number", Math.abs(itemId));
        } else {
            deleteQuery = deleteQuery
                .eq("item_type", "song")
                .eq("song_id", itemId);
        }

        const { error: deleteError } = await deleteQuery;

        if (deleteError) {
            console.error("Fehler beim Löschen:", {
                message: deleteError.message,
                code: deleteError.code,
                details: deleteError.details,
                hint: deleteError.hint,
            });
            return;
        }

        // Nach dem Löschen eines Wunschsongs:
        // übrige Wunschsongs lückenlos neu nummerieren
        if (isRequest) {
            const { data: remainingRequests, error: loadError } =
                await supabase
                    .from("setlist_items")
                    .select("id")
                    .eq("item_type", "request")
                    .order("position");

            if (loadError) {
                console.error(
                    "Fehler beim Laden der übrigen Wunschsongs:",
                    loadError,
                );
                return;
            }

            // Zuerst vorübergehend sehr hohe Nummern vergeben,
            // damit die Unique-Regel keine Konflikte verursacht
            for (
                let index = 0;
                index < (remainingRequests?.length ?? 0);
                index++
            ) {
                const request = remainingRequests![index];

                const { error } = await supabase
                    .from("setlist_items")
                    .update({
                        request_number: 1000000 + index,
                    })
                    .eq("id", request.id);

                if (error) {
                    console.error(
                        "Fehler bei der Zwischennummerierung:",
                        error,
                    );
                    return;
                }
            }

            // Danach endgültig Wunschsong 1, 2, 3 ... vergeben
            for (
                let index = 0;
                index < (remainingRequests?.length ?? 0);
                index++
            ) {
                const request = remainingRequests![index];

                const { error } = await supabase
                    .from("setlist_items")
                    .update({
                        request_number: index + 1,
                    })
                    .eq("id", request.id);

                if (error) {
                    console.error(
                        "Fehler bei der neuen Nummerierung:",
                        error,
                    );
                    return;
                }
            }
        }

        await loadSetlist();
    }

    async function saveNewOrder(songs: Song[]) {
        // Erster Durchgang:
        // Vorübergehend eindeutige negative Positionen vergeben
        for (let index = 0; index < songs.length; index++) {
            const song = songs[index];

            const { error } = await supabase
                .from("setlist_items")
                .update({
                    position: -(index + 1),
                })
                .eq("song_id", song.id);

            if (error) {
                console.error("Fehler bei der Zwischenspeicherung:", {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                });
                return;
            }
        }

        // Zweiter Durchgang:
        // Endgültige Positionen speichern
        for (let index = 0; index < songs.length; index++) {
            const song = songs[index];

            const { error } = await supabase
                .from("setlist_items")
                .update({
                    position: index + 1,
                })
                .eq("song_id", song.id);

            if (error) {
                console.error("Fehler beim Speichern der Reihenfolge:", {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                });
                return;
            }
        }

        setSetlist(songs);
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white sm:px-8">
            <div className="mx-auto max-w-6xl">
                <AdminNavigation />

                <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                            Deine Setlist
                        </p>

                        <h1 className="mt-2 text-4xl font-black sm:text-5xl">
                            Setlist
                        </h1>
                    </div>

                    <div className="flex rounded-2xl border border-white/10 bg-zinc-900 p-1">
                        <button
                            type="button"
                            onClick={() => setView("live")}
                            className={`rounded-xl px-4 py-3 font-bold transition ${view === "live"
                                ? "bg-red-600 text-white"
                                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                }`}
                        >
                            Live-Setlist
                        </button>

                        <button
                            type="button"
                            onClick={() => setView("builder")}
                            className={`rounded-xl px-4 py-3 font-bold transition ${view === "builder"
                                ? "bg-red-600 text-white"
                                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                }`}
                        >
                            Setlist-Baukasten
                        </button>
                    </div>
                </header>

                {view === "live" ? (
                    <section className="mt-8">
                        <div className="mb-5">
                            <h2 className="text-2xl font-black">Live-Setlist</h2>

                            <p className="mt-2 text-zinc-400">
                                Diese Ansicht wird später während des Auftritts verwendet.
                            </p>
                        </div>

                        {setlist.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/70 p-10 text-center">
                                <p className="text-xl font-bold">
                                    Noch keine Setlist zusammengestellt
                                </p>

                                <p className="mt-2 text-zinc-400">
                                    Öffne den Setlist-Baukasten und füge Songs hinzu.
                                </p>

                                <button
                                    type="button"
                                    onClick={() => setView("builder")}
                                    className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-black transition hover:bg-red-500"
                                >
                                    Setlist-Baukasten öffnen
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {setlist.map((song, index) => (
                                    <article
                                        key={song.id}
                                        className={`flex items-center gap-4 rounded-2xl border p-4 shadow-lg ${song.itemType === "request"
                                            ? "border-amber-500/60 bg-amber-500/10"
                                            : "border-white/10 bg-zinc-900/80"
                                            }`}
                                    >
                                        <div
                                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${song.itemType === "request"
                                                ? "bg-amber-500/20 text-amber-300"
                                                : "bg-zinc-800 text-zinc-400"
                                                }`}
                                        >
                                            {index + 1}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h3 className="break-words text-lg font-black leading-snug">
                                                {song.title}
                                            </h3>

                                            <p
                                                className={`mt-1 break-words text-sm ${song.itemType === "request"
                                                    ? "text-amber-200"
                                                    : "text-zinc-400"
                                                    }`}
                                            >
                                                {song.artist}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => openPdf(song.id)}
                                            disabled={!songsWithPdf.has(song.id)}
                                            title={
                                                songsWithPdf.has(song.id)
                                                    ? "PDF öffnen"
                                                    : "Keine PDF vorhanden"
                                            }
                                            className={`shrink-0 rounded-xl border px-4 py-3 transition ${songsWithPdf.has(song.id)
                                                ? "border-green-500/50 bg-green-600 text-white hover:bg-green-500"
                                                : "cursor-not-allowed border-white/10 bg-zinc-800 text-zinc-500 opacity-50"
                                                }`}
                                        >
                                            📄
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="mt-8">
                        <div className="mb-5">
                            <h2 className="text-2xl font-black">
                                Setlist-Baukasten
                            </h2>

                            <p className="mt-2 text-zinc-400">
                                Stelle hier deine Live-Setlist zusammen.
                            </p>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                                <div className="mb-5">
                                    <h3 className="text-2xl font-bold">
                                        Verfügbare Songs
                                    </h3>

                                    <p className="mt-1 text-sm text-zinc-400">
                                        {songs.length} Songs verfügbar
                                    </p>
                                </div>

                                {loading ? (
                                    <p className="text-zinc-400">
                                        Songs werden geladen …
                                    </p>
                                ) : songs.length === 0 ? (
                                    <p className="text-zinc-400">
                                        Es wurden keine Songs gefunden.
                                    </p>
                                ) : (
                                    <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">
                                        {songs.map((song) => {
                                            const songIsAlreadyInSetlist = setlist.some(
                                                (setlistSong) => setlistSong.id === song.id,
                                            );

                                            return (
                                                <div
                                                    key={song.id}
                                                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-950/70 p-4"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="break-words font-semibold leading-snug">
                                                            {song.title}
                                                        </div>

                                                        <div className="mt-1 break-words text-sm text-zinc-400">
                                                            {song.artist}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => addSong(song)}
                                                        disabled={songIsAlreadyInSetlist}
                                                        className="min-w-11 shrink-0 rounded-lg bg-green-600 px-3 py-2 text-lg font-bold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                                                    >
                                                        {songIsAlreadyInSetlist ? "✓" : "+"}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                                <div className="mb-5 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-2xl font-bold">
                                            Aktuelle Setlist
                                        </h3>

                                        <p className="mt-1 text-sm text-zinc-400">
                                            {setlist.length === 0
                                                ? "Noch keine Einträge ausgewählt"
                                                : `${setlist.length} Einträge ausgewählt`}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addRequestPlaceholder}
                                        className="shrink-0 rounded-xl bg-amber-500 px-4 py-3 font-black text-black transition hover:bg-amber-400"
                                    >
                                        + Wunschsong
                                    </button>
                                </div>

                                {setlist.length === 0 ? (
                                    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-6 text-center text-zinc-500">
                                        Klicke links auf das Plus, um einen Song
                                        hinzuzufügen.
                                    </div>
                                ) : (
                                    <SortableSetlist
                                        songs={setlist}
                                        onRemove={removeSong}
                                        onReorder={saveNewOrder}
                                    />
                                )}
                            </section>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}