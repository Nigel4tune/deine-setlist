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
  setlistItemId: number;
  title: string;
  artist: string;
  itemType: "song" | "request";
  requestNumber?: number;
};

type Props = {
  songs: SetlistItem[];
  onReorder: (songs: SetlistItem[]) => Promise<void>;
  onRemove?: (itemId: number) => void;
  onOpenPdf?: (songId: number) => void;
  songsWithPdf?: Set<number>;
  variant?: "builder" | "live";
};

type SortableItemProps = {
  item: SetlistItem;
  index: number;
  onRemove?: (itemId: number) => void;
  onOpenPdf?: (songId: number) => void;
  songsWithPdf: Set<number>;
  variant: "builder" | "live";
};

function SortableItem({
  item,
  index,
  onRemove,
  onOpenPdf,
  songsWithPdf,
  variant,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.setlistItemId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isRequest = item.itemType === "request";
  const hasPdf = songsWithPdf.has(item.id);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-2xl border p-4 shadow-lg ${
        isDragging
          ? "relative z-50 border-red-500 bg-zinc-800 opacity-90 shadow-2xl"
          : isRequest
            ? "border-amber-500/60 bg-amber-500/10"
            : variant === "live"
              ? "border-white/10 bg-zinc-900/80"
              : "border-zinc-700 bg-zinc-950/70"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={`flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-xl active:cursor-grabbing ${
          isRequest
            ? "bg-amber-500/20 text-amber-300"
            : "bg-zinc-800 text-zinc-300"
        }`}
        title="Gedrückt halten und verschieben"
        aria-label={`${item.title} verschieben`}
      >
        ☰
      </button>

      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${
          isRequest
            ? "bg-amber-500/20 text-amber-300"
            : "bg-zinc-800 text-zinc-400"
        }`}
      >
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={`break-words font-black leading-snug ${
            variant === "live" ? "text-lg" : ""
          } ${isRequest ? "text-amber-200" : "text-white"}`}
        >
          {item.title}
        </h3>

        <p
          className={`mt-1 break-words text-sm ${
            isRequest ? "text-amber-300" : "text-zinc-400"
          }`}
        >
          {item.artist}
        </p>
      </div>

      {variant === "live" && (
        <button
          type="button"
          onClick={() => onOpenPdf?.(item.id)}
          disabled={!hasPdf}
          title={hasPdf ? "PDF öffnen" : "Keine PDF vorhanden"}
          className={`shrink-0 rounded-xl border px-4 py-3 transition ${
            hasPdf
              ? "border-green-500/50 bg-green-600 text-white hover:bg-green-500"
              : "cursor-not-allowed border-white/10 bg-zinc-800 text-zinc-500 opacity-50"
          }`}
        >
          📄
        </button>
      )}

      {variant === "builder" && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.setlistItemId)}
          className={`shrink-0 rounded-xl px-3 py-2 font-bold transition ${
            isRequest
              ? "bg-amber-950 text-amber-300 hover:bg-amber-900"
              : "bg-red-950 text-red-300 hover:bg-red-900"
          }`}
          title="Eintrag entfernen"
          aria-label={`${item.title} entfernen`}
        >
          ✕
        </button>
      )}
    </article>
  );
}

export default function SortableSetlist({
  songs,
  onReorder,
  onRemove,
  onOpenPdf,
  songsWithPdf = new Set<number>(),
  variant = "builder",
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
        (item) => item.setlistItemId === active.id,
      );

      const newIndex = currentSongs.findIndex(
        (item) => item.setlistItemId === over.id,
      );

      if (oldIndex === -1 || newIndex === -1) {
        return currentSongs;
      }

      const reorderedSongs = arrayMove(
        currentSongs,
        oldIndex,
        newIndex,
      );

      void onReorder(reorderedSongs);

      return reorderedSongs;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedSongs.map((item) => item.setlistItemId)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={
            variant === "live"
              ? "space-y-3"
              : "max-h-[650px] space-y-2 overflow-y-auto pr-2"
          }
        >
          {sortedSongs.map((item, index) => (
            <SortableItem
              key={item.setlistItemId}
              item={item}
              index={index}
              onRemove={onRemove}
              onOpenPdf={onOpenPdf}
              songsWithPdf={songsWithPdf}
              variant={variant}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}