"use client";

import { useEffect, useState } from "react";
import AdminNavigation from "../../components/AdminNavigation";
import { getCurrentBand } from "../../lib/band";
import { createClient } from "../../lib/client";

type VoteSongScope = "all" | "outside_setlist";

export default function VotingRulesPage() {
  const [bandId, setBandId] = useState<number | null>(null);
  const [bandName, setBandName] = useState("");

  const [maxVotes, setMaxVotes] = useState(3);
  const [voteSongScope, setVoteSongScope] =
    useState<VoteSongScope>("outside_setlist");

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    async function loadVotingRules() {
      setLoading(true);
      setErrorMessage("");

      try {
        const currentBand = await getCurrentBand();

        setBandId(currentBand.id);
        setBandName(currentBand.name);

        const supabase = createClient();

        const { data, error } = await supabase
          .from("bands")
          .select("max_votes, vote_song_scope")
          .eq("id", currentBand.id)
          .maybeSingle();

        if (error) {
          throw new Error(
            `Votingregeln konnten nicht geladen werden: ${error.message}`,
          );
        }

        if (data) {
          setMaxVotes(
            typeof data.max_votes === "number"
              ? data.max_votes
              : 3,
          );

          setVoteSongScope(
            data.vote_song_scope === "all"
              ? "all"
              : "outside_setlist",
          );
        }
      } catch (error) {
        console.error(
          "Votingregeln konnten nicht geladen werden:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Die Votingregeln konnten nicht geladen werden.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadVotingRules();
  }, []);

  async function saveVotingRules() {
    if (
      bandId === null ||
      isSaving ||
      !Number.isInteger(maxVotes) ||
      maxVotes < 1
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("bands")
      .update({
        max_votes: maxVotes,
        vote_song_scope: voteSongScope,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bandId);

    if (error) {
      console.error(
        "Votingregeln konnten nicht gespeichert werden:",
        error.message,
        error.code,
        error.details,
        error.hint,
      );

      setErrorMessage(
        "Die Votingregeln konnten nicht gespeichert werden.",
      );

      setIsSaving(false);
      return;
    }

    setSuccessMessage(
      "Die Votingregeln wurden gespeichert.",
    );

    setIsSaving(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-4 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />

        <header>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-red-500">
            DEINE SETLIST
          </p>

          <h1 className="mt-2 text-4xl font-black sm:text-6xl">
            Votingregeln
          </h1>

          <p className="mt-3 max-w-2xl text-zinc-400">
            Lege fest, wie das Publikum bei{" "}
            {bandName || "dieser Band"} abstimmen darf.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-500/40 bg-green-950/40 px-5 py-4 text-green-200">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-400">
            Votingregeln werden geladen …
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 sm:p-8">
              <h2 className="text-2xl font-black">
                Anzahl der Songwünsche
              </h2>

              <p className="mt-2 text-zinc-400">
                Wie viele Songs darf ein Gerät pro Konzert
                auswählen?
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {[1, 3, 5, 10].map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setMaxVotes(number)}
                    className={`rounded-2xl px-6 py-4 text-lg font-black transition ${
                      maxVotes === number
                        ? "bg-red-600 text-white"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {number}
                  </button>
                ))}
              </div>

              <div className="mt-6 max-w-xs">
                <label
                  htmlFor="maxVotes"
                  className="text-sm font-bold text-zinc-300"
                >
                  Andere Anzahl
                </label>

                <input
                  id="maxVotes"
                  type="number"
                  min={1}
                  step={1}
                  value={maxVotes}
                  onChange={(event) =>
                    setMaxVotes(
                      Math.max(
                        1,
                        Number.parseInt(
                          event.target.value || "1",
                          10,
                        ),
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-red-500"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 sm:p-8">
              <h2 className="text-2xl font-black">
                Welche Songs dürfen gewählt werden?
              </h2>

              <p className="mt-2 text-zinc-400">
                Bestimme, welche Songs das Publikum in der
                Abstimmung sieht.
              </p>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    setVoteSongScope("outside_setlist")
                  }
                  className={`w-full rounded-2xl border p-5 text-left transition ${
                    voteSongScope === "outside_setlist"
                      ? "border-red-500 bg-red-600/15"
                      : "border-white/10 bg-black/20 hover:bg-zinc-800"
                  }`}
                >
                  <div className="font-black">
                    Nur Songs außerhalb der Setlist
                  </div>

                  <p className="mt-2 text-sm text-zinc-400">
                    Songs, die bereits in der aktuellen Setlist
                    stehen, können nicht gewünscht werden.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setVoteSongScope("all")
                  }
                  className={`w-full rounded-2xl border p-5 text-left transition ${
                    voteSongScope === "all"
                      ? "border-red-500 bg-red-600/15"
                      : "border-white/10 bg-black/20 hover:bg-zinc-800"
                  }`}
                >
                  <div className="font-black">
                    Alle aktiven Songs
                  </div>

                  <p className="mt-2 text-sm text-zinc-400">
                    Auch Songs, die bereits in der aktuellen
                    Setlist stehen, dürfen gewünscht werden.
                  </p>
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={() => void saveVotingRules()}
              disabled={isSaving || maxVotes < 1}
              className="w-full rounded-2xl bg-red-600 px-6 py-5 text-lg font-black transition hover:bg-red-500 disabled:cursor-wait disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-auto"
            >
              {isSaving
                ? "Votingregeln werden gespeichert …"
                : "Votingregeln speichern"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}