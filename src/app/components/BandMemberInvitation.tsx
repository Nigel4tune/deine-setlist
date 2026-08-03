"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../lib/client";

type Props = {
  bandId: number;
};

export function BandMemberInvitation({
  bandId,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [invitationUrl, setInvitationUrl] =
    useState("");

  const [isCreating, setIsCreating] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  async function createInvitation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    if (!normalizedEmail || isCreating) {
      return;
    }

    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");
    setInvitationUrl("");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage(
        "Dein Benutzerkonto konnte nicht geladen werden.",
      );
      setIsCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("band_invitations")
      .insert({
        band_id: bandId,
        email: normalizedEmail,
        invited_by: user.id,
      })
      .select("token")
      .single();

    if (error) {
      console.error(
        "Einladung konnte nicht erstellt werden:",
        error.message,
        error.code,
        error.details,
        error.hint,
      );

      if (error.code === "23505") {
        setErrorMessage(
          "Für diese E-Mail-Adresse gibt es bereits eine offene Einladung.",
        );
      } else {
        setErrorMessage(
          "Die Einladung konnte nicht erstellt werden.",
        );
      }

      setIsCreating(false);
      return;
    }

    const newInvitationUrl =
      `${window.location.origin}/join/${data.token}`;

    setInvitationUrl(newInvitationUrl);

    setSuccessMessage(
      "Die Einladung wurde erstellt. Kopiere jetzt den Link und sende ihn an das Bandmitglied.",
    );

    setIsCreating(false);
  }

  async function copyInvitationUrl() {
    if (!invitationUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        invitationUrl,
      );

      setSuccessMessage(
        "Der Einladungslink wurde kopiert.",
      );
    } catch (error) {
      console.error(
        "Einladungslink konnte nicht kopiert werden:",
        error,
      );

      setErrorMessage(
        "Der Einladungslink konnte nicht kopiert werden.",
      );
    }
  }

  function closeInvitation() {
    setIsOpen(false);
    setEmail("");
    setInvitationUrl("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-2xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-500"
      >
        + Mitglied einladen
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-5 sm:max-w-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-black">
            Bandmitglied einladen
          </h3>

          <p className="mt-1 text-sm text-zinc-400">
            Die Einladung ist sieben Tage gültig.
          </p>
        </div>

        <button
          type="button"
          onClick={closeInvitation}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 font-bold text-zinc-300 transition hover:bg-zinc-700"
          aria-label="Einladung schließen"
        >
          ✕
        </button>
      </div>

      <form
        onSubmit={createInvitation}
        className="mt-5 space-y-4"
      >
        <div>
          <label
            htmlFor="invitationEmail"
            className="text-sm font-bold text-zinc-300"
          >
            E-Mail des Bandmitglieds
          </label>

          <input
            id="invitationEmail"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="mitglied@beispiel.de"
            autoComplete="email"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
          />
        </div>

        <button
          type="submit"
          disabled={!email.trim() || isCreating}
          className="w-full rounded-2xl bg-red-600 px-5 py-3 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {isCreating
            ? "Einladung wird erstellt …"
            : "Einladungslink erstellen"}
        </button>
      </form>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-950/40 p-3 text-sm text-green-200">
          {successMessage}
        </div>
      )}

      {invitationUrl && (
        <div className="mt-4">
          <label
            htmlFor="invitationUrl"
            className="text-sm font-bold text-zinc-300"
          >
            Einladungslink
          </label>

          <input
            id="invitationUrl"
            type="text"
            value={invitationUrl}
            readOnly
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-400 outline-none"
          />

          <button
            type="button"
            onClick={() =>
              void copyInvitationUrl()
            }
            className="mt-3 w-full rounded-xl bg-zinc-700 px-4 py-3 font-bold transition hover:bg-zinc-600"
          >
            🔗 Link kopieren
          </button>
        </div>
      )}
    </div>
  );
}