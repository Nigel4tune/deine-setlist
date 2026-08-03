"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/client";

function createSlug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function RegisterPage() {
  const router = useRouter();

  const [bandName, setBandName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] =
    useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const bandSlug = useMemo(
    () => createSlug(bandName),
    [bandName],
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const cleanBandName = bandName.trim();
    const cleanDisplayName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanContactEmail =
      contactEmail.trim().toLowerCase() || cleanEmail;

    if (!cleanBandName) {
      setErrorMessage("Bitte gib einen Bandnamen ein.");
      return;
    }

    if (!cleanDisplayName) {
      setErrorMessage(
        "Bitte gib deinen Namen oder Bandnamen ein.",
      );
      return;
    }

    if (!cleanEmail) {
      setErrorMessage(
        "Bitte gib eine gültige Login-E-Mail ein.",
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "Das Passwort muss mindestens 8 Zeichen lang sein.",
      );
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage(
        "Die beiden Passwörter stimmen nicht überein.",
      );
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
  email: cleanEmail,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
    data: {
      registration_type: "band",
      band_name: cleanBandName,
      display_name: cleanDisplayName,
      contact_email: cleanContactEmail,
    },
  },
});

    if (error) {
      console.error(
        "Bandregistrierung fehlgeschlagen:",
        error.message,
        error.status,
      );

      const normalizedMessage =
        error.message.toLowerCase();

      if (
        normalizedMessage.includes(
          "user already registered",
        )
      ) {
        setErrorMessage(
          "Für diese E-Mail-Adresse besteht bereits ein Konto.",
        );
      } else if (
        normalizedMessage.includes("password")
      ) {
        setErrorMessage(
          "Das Passwort erfüllt die Sicherheitsanforderungen nicht.",
        );
      } else if (
        normalizedMessage.includes("email")
      ) {
        setErrorMessage(
          "Die E-Mail-Adresse ist nicht gültig.",
        );
      } else {
        setErrorMessage(
          `Die Band konnte nicht registriert werden: ${error.message}`,
        );
      }

      setIsSubmitting(false);
      return;
    }

    /*
     * Wenn Supabase die E-Mail-Bestätigung deaktiviert hat,
     * besteht sofort eine Sitzung.
     */
    if (data.session) {
      router.push("/admin");
      router.refresh();
      return;
    }

    /*
     * Bei aktivierter E-Mail-Bestätigung muss der Benutzer
     * zunächst den Link in seiner E-Mail öffnen.
     */
    setSuccessMessage(
      "Deine Band wurde registriert. Bitte öffne jetzt die Bestätigungs-E-Mail und bestätige deinen Zugang.",
    );

    setPassword("");
    setPasswordConfirmation("");
    setIsSubmitting(false);
  }

  if (successMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
        <section className="w-full max-w-md rounded-3xl border border-green-500/30 bg-green-950/20 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-4xl font-black">
            ✓
          </div>

          <h1 className="mt-6 text-3xl font-black">
            Registrierung erfolgreich
          </h1>

          <p className="mt-4 leading-relaxed text-zinc-300">
            {successMessage}
          </p>

          <Link
            href="/admin-login"
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-red-600 px-6 py-4 font-black text-white transition hover:bg-red-500"
          >
            Zum Admin-Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-900/80 p-8 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
          Deine Setlist
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Band registrieren
        </h1>

        <p className="mt-3 leading-relaxed text-zinc-400">
          Richte deine Band ein und erstelle den ersten
          persönlichen Zugang.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="bandName"
              className="text-sm font-semibold text-zinc-300"
            >
              Bandname
            </label>

            <input
              id="bandName"
              type="text"
              value={bandName}
              onChange={(event) =>
                setBandName(event.target.value)
              }
              autoComplete="organization"
              autoFocus
              placeholder="Name deiner Band"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
            />

            {bandSlug && (
              <p className="mt-2 text-xs text-zinc-500">
                Öffentliche Adresse:{" "}
                <span className="font-semibold text-zinc-400">
                  /b/{bandSlug}
                </span>
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="text-sm font-semibold text-zinc-300"
            >
              Dein Name
            </label>

            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              autoComplete="name"
              placeholder="Name des ersten Bandmitglieds"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-zinc-300"
            >
              Login-E-Mail
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              placeholder="deine@email.de"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="contactEmail"
              className="text-sm font-semibold text-zinc-300"
            >
              Kontakt-E-Mail der Band
            </label>

            <input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(event) =>
                setContactEmail(event.target.value)
              }
              autoComplete="email"
              placeholder="Leer lassen, um die Login-E-Mail zu verwenden"
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
              autoComplete="new-password"
              placeholder="Mindestens 8 Zeichen"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="passwordConfirmation"
              className="text-sm font-semibold text-zinc-300"
            >
              Passwort wiederholen
            </label>

            <input
              id="passwordConfirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(event.target.value)
              }
              autoComplete="new-password"
              placeholder="Passwort erneut eingeben"
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
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-red-600 px-6 py-4 text-lg font-black transition hover:bg-red-500 disabled:cursor-wait disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isSubmitting
              ? "Band wird eingerichtet …"
              : "Band registrieren"}
          </button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-zinc-500">
            Du hast bereits einen Zugang?
          </p>

          <Link
            href="/admin-login"
            className="mt-3 inline-flex font-bold text-red-400 transition hover:text-red-300"
          >
            Zurück zum Admin-Login
          </Link>
        </div>
      </section>
    </main>
  );
}