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
    const [songSearch, setSongSearch] = useState("");

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

    async function removeSong(setlistItemId: number) {
        const { error: deleteError } = await supabase
            .from("setlist_items")
            .delete()
            .eq("id", setlistItemId);

        if (deleteError) {
            console.error("Fehler beim Löschen des Eintrags:", {
                message: deleteError.message,
                code: deleteError.code,
                details: deleteError.details,
                hint: deleteError.hint,
            });

            alert(
                `Der Eintrag konnte nicht gelöscht werden: ${deleteError.message}`,
            );

            return;
        }

        const { data: remainingItems, error: loadError } =
            await supabase
                .from("setlist_items")
                .select("id, item_type")
                .order("position");

        if (loadError) {
            console.error(
                "Fehler beim Laden der übrigen Setlist:",
                loadError,
            );

            await loadSetlist();
            return;
        }

        // Zunächst negative Positionen verwenden, damit keine
        // doppelten Positionsnummern entstehen.
        for (
            let index = 0;
            index < (remainingItems?.length ?? 0);
            index++
        ) {
            const item = remainingItems![index];

            const { error } = await supabase
                .from("setlist_items")
                .update({
                    position: -(index + 1),
                })
                .eq("id", item.id);

            if (error) {
                console.error(
                    "Fehler bei der Zwischenspeicherung:",
                    error,
                );

                await loadSetlist();
                return;
            }
        }

        let requestNumber = 1;

        // Endgültige Positionen und Wunschsongnummern speichern.
        for (
            let index = 0;
            index < (remainingItems?.length ?? 0);
            index++
        ) {
            const item = remainingItems![index];

            const updateData: {
                position: number;
                request_number?: number;
            } = {
                position: index + 1,
            };

            if (item.item_type === "request") {
                updateData.request_number = requestNumber;
                requestNumber++;
            }

            const { error } = await supabase
                .from("setlist_items")
                .update(updateData)
                .eq("id", item.id);

            if (error) {
                console.error(
                    "Fehler bei der neuen Nummerierung:",
                    error,
                );

                await loadSetlist();
                return;
            }
        }

        await loadSetlist();
    }

    async function saveNewOrder(songs: SetlistItem[]) {
        // Erster Durchgang:
        // Vorübergehend eindeutige negative Positionen vergeben
        for (let index = 0; index < songs.length; index++) {
            const song = songs[index];

            const { error } = await supabase
                .from("setlist_items")
                .update({
                    position: -(index + 1),
                })
                .eq("id", song.setlistItemId);

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
                .eq("id", song.setlistItemId);
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

    function normalizeSongSearch(text: string) {
        return text
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ß/g, "ss")
            .replace(/[^a-z0-9]/g, "");
    }

    const normalizedSongSearch = normalizeSongSearch(songSearch);

    const filteredSongs = songs.filter((song) => {
        if (!normalizedSongSearch) {
            return true;
        }

        const searchableSong = normalizeSongSearch(
            `${song.title} ${song.artist}`,
        );

        return searchableSong.includes(normalizedSongSearch);
    });

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
                            <SortableSetlist
                                songs={setlist}
                                onReorder={saveNewOrder}
                                onOpenPdf={openPdf}
                                songsWithPdf={songsWithPdf}
                                variant="live"
                            />
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

                            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                                <div className="mb-5">
                                    <h3 className="text-2xl font-bold">
                                        Verfügbare Songs
                                    </h3>

                                    <p className="mt-1 text-sm text-zinc-400">
                                        {filteredSongs.length} von {songs.length} Songs angezeigt
                                    </p>

                                    <div className="relative mt-4">
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                                            🔎
                                        </span>

                                        <input
                                            type="search"
                                            value={songSearch}
                                            onChange={(event) => setSongSearch(event.target.value)}
                                            placeholder="Song oder Interpret suchen …"
                                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-11 pr-11 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                                        />

                                        {songSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setSongSearch("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                                                aria-label="Suche löschen"
                                                title="Suche löschen"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {loading ? (
                                    <p className="text-zinc-400">
                                        Songs werden geladen …
                                    </p>
                                ) : songs.length === 0 ? (
                                    <p className="text-zinc-400">
                                        Es sind noch keine Songs in der Songverwaltung vorhanden.
                                    </p>
                                ) : filteredSongs.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-6 text-center">
                                        <p className="font-bold text-zinc-300">
                                            Kein passender Song gefunden
                                        </p>

                                        <p className="mt-1 text-sm text-zinc-500">
                                            Versuche einen anderen Titel oder Interpreten.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">
                                        {filteredSongs.map((song) => {
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


                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}