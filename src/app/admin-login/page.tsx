"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/client";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!email || !password || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      console.error(
        "Fehler beim Admin-Login:",
        error.message,
        error.status,
      );

      setErrorMessage(
        "E-Mail oder Passwort ist nicht korrekt.",
      );

      setIsSubmitting(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/80 p-8 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
          Deine Setlist
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Admin-Login
        </h1>

        <p className="mt-3 text-zinc-400">
          Melde dich mit deinem persönlichen
          Band-Zugang an.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-zinc-300"
            >
              E-Mail
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              autoFocus
              placeholder="name@band.de"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
            />
          </div>

          <div>
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
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              placeholder="Passwort"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
            />
          </div>

          {errorMessage && (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              !email || !password || isSubmitting
            }
            className="w-full rounded-2xl bg-red-600 px-6 py-4 text-lg font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isSubmitting
              ? "Anmeldung läuft …"
              : "Admin öffnen"}
          </button>
        </form>

        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />

          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Noch kein Zugang?
          </span>

          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
          <h2 className="text-xl font-black">
            Eigene Band einrichten
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Registriere deine Band und erstelle den
            ersten persönlichen Band-Zugang.
          </p>

          <Link
            href="/register"
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-zinc-800 px-6 py-4 font-black text-white transition hover:border-red-500 hover:bg-zinc-700"
          >
            Band registrieren
          </Link>
        </div>
      </section>
    </main>
  );
}