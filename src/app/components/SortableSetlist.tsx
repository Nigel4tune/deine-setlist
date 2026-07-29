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
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SetlistItem = {
    id: number;
    title: string;
    artist: string;
    itemType: "song" | "request";
    requestNumber?: number;
};

type Props = {
    songs: SetlistItem[];
    onRemove: (itemId: number) => void;
    onReorder: (songs: SetlistItem[]) => Promise<void>;
};

type SortableItemProps = {
    item: SetlistItem;
    index: number;
    onRemove: (itemId: number) => void;
};

function SortableItem({
    item,
    index,
    onRemove,
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: item.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const isRequest = item.itemType === "request";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 rounded-xl border p-4 ${
                isDragging
                    ? "z-50 border-red-500 opacity-80 shadow-2xl"
                    : isRequest
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-zinc-700 bg-zinc-950/70"
            }`}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                className={`flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-xl active:cursor-grabbing ${
                    isRequest
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-zinc-800 text-zinc-300"
                }`}
                title="Eintrag verschieben"
                aria-label={`${item.title} verschieben`}
            >
                ☰
            </button>

            <span
                className={`min-w-8 shrink-0 font-bold ${
                    isRequest ? "text-amber-400" : "text-zinc-500"
                }`}
            >
                {index + 1}.
            </span>

            <div className="min-w-0 flex-1">
                <div
                    className={`break-words font-semibold leading-snug ${
                        isRequest ? "text-amber-200" : "text-white"
                    }`}
                >
                    {isRequest ? "🎵 " : ""}
                    {item.title}
                </div>

                <div
                    className={`mt-1 break-words text-sm ${
                        isRequest ? "text-amber-400/80" : "text-zinc-400"
                    }`}
                >
                    {isRequest
                        ? "Publikumswunsch – wird während des Konzerts gefüllt"
                        : item.artist}
                </div>
            </div>

            <button
                type="button"
                onClick={() => onRemove(item.id)}
                className={`shrink-0 rounded-lg px-3 py-2 font-bold transition ${
                    isRequest
                        ? "bg-amber-950 text-amber-300 hover:bg-amber-900"
                        : "bg-red-950 text-red-300 hover:bg-red-900"
                }`}
                title={
                    isRequest
                        ? "Wunschsong-Platzhalter entfernen"
                        : "Song entfernen"
                }
                aria-label={`${item.title} entfernen`}
            >
                ✕
            </button>
        </div>
    );
}

export default function SortableSetlist({
    songs,
    onRemove,
    onReorder,
}: Props) {
    const [sortedSongs, setSortedSongs] =
        useState<SetlistItem[]>(songs);

    useEffect(() => {
        setSortedSongs(songs);
    }, [songs]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 8,
            },
        }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        setSortedSongs((currentSongs) => {
            const oldIndex = currentSongs.findIndex(
                (item) => item.id === active.id,
            );

            const newIndex = currentSongs.findIndex(
                (item) => item.id === over.id,
            );

            if (oldIndex === -1 || newIndex === -1) {
                return currentSongs;
            }

            const newSongs = arrayMove(
                currentSongs,
                oldIndex,
                newIndex,
            );

            void onReorder(newSongs);

            return newSongs;
        });
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={sortedSongs.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">
                    {sortedSongs.map((item, index) => (
                        <SortableItem
                            key={item.id}
                            item={item}
                            index={index}
                            onRemove={onRemove}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}