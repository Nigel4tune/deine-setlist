"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Concert = {
  id: number;
  name: string;
  created_at: string;
  is_active: boolean;
};

export default function ArchivePage() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadConcerts();
  }, []);

  async function loadConcerts() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("concerts")
      .select("id, name, created_at, is_active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Konzerte konnten nicht geladen werden:",
        error.message,
      );

      setErrorMessage(
        "Die Konzerte konnten nicht geladen werden.",
      );

      setLoading(false);
      return;
    }

    setConcerts(data ?? []);
    setLoading(false);
  }

  async function deleteConcert(concert: Concert) {
    if (concert.is_active) {
      alert(
        "Das aktive Konzert kann nicht gelöscht werden. Beende es zuerst.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Möchtest du das Konzert „${concert.name}“ wirklich löschen?\n\nDabei werden automatisch alle Stimmen, gespielten Songs und der aktuelle Song gelöscht.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(concert.id);
    setErrorMessage("");

    const {
      data: deletedConcerts,
      error: concertError,
    } = await supabase
      .from("concerts")
      .delete()
      .eq("id", concert.id)
      .select("id");

    if (concertError) {
      console.error(
        "Konzert konnte nicht gelöscht werden:",
        concertError.message,
      );

      setErrorMessage(
        "Das Konzert konnte nicht gelöscht werden.",
      );

      setDeletingId(null);
      return;
    }

    if (!deletedConcerts || deletedConcerts.length === 0) {
      console.error(
        "Supabase hat keinen Datensatz gelöscht.",
      );

      setErrorMessage(
        "Das Konzert wurde nicht gelöscht.",
      );

      setDeletingId(null);
      return;
    }

    setConcerts((currentConcerts) =>
      currentConcerts.filter(
        (currentConcert) =>
          currentConcert.id !== concert.id,
      ),
    );

    setDeletingId(null);
  }

  return (
    <main className="min-h-screen bg-zinc-900 p-8 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-4xl font-bold">
          Konzertarchiv
        </h1>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">
            Konzerte werden geladen …
          </p>
        ) : concerts.length === 0 ? (
          <p className="text-gray-400">
            Es wurden noch keine Konzerte angelegt.
          </p>
        ) : (
          <div className="space-y-4">
            {concerts.map((concert) => (
              <div
                key={concert.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <Link
                  href={`/archive/${concert.id}`}
                  className="min-w-0 flex-1 rounded-xl transition hover:opacity-75"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-bold">
                        {concert.name}
                      </h2>

                      <p className="mt-1 text-sm text-gray-400">
                        {new Date(
                          concert.created_at,
                        ).toLocaleString("de-DE")}
                      </p>
                    </div>

                    {concert.is_active && (
                      <span className="shrink-0 rounded-full bg-green-600 px-3 py-1 text-sm font-bold">
                        Aktiv
                      </span>
                    )}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => deleteConcert(concert)}
                  disabled={deletingId === concert.id}
                  className="shrink-0 rounded-xl bg-red-600 px-4 py-2 font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === concert.id
                    ? "Lösche …"
                    : "Löschen"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}