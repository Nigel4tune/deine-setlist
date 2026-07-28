"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setErrorMessage("Das Passwort ist nicht korrekt.");
        setIsSubmitting(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (error) {
      console.error("Fehler beim Admin-Login:", error);
      setErrorMessage("Die Anmeldung ist fehlgeschlagen.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/80 p-8 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
          Deine Setlist
        </p>

        <h1 className="mt-3 text-4xl font-black">Admin-Login</h1>

        <p className="mt-3 text-zinc-400">
          Gib das Admin-Passwort ein, um die Ergebnisse aufzurufen.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label
            htmlFor="password"
            className="text-sm font-semibold text-zinc-300"
          >
            Passwort
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            placeholder="Admin-Passwort"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
          />

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!password || isSubmitting}
            className="mt-6 w-full rounded-2xl bg-red-600 px-6 py-4 text-lg font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isSubmitting ? "Anmeldung läuft …" : "Admin öffnen"}
          </button>
        </form>
      </section>
    </main>
  );
}