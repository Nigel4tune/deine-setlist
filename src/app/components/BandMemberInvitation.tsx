"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createClient } from "../lib/client";

type Props = {
  bandId: number;
  onInvitationChanged?: () => void;
};

type BandInvitation = {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

export function BandMemberInvitation({
  bandId,
  onInvitationChanged,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [invitationUrl, setInvitationUrl] =
    useState("");

  const [invitations, setInvitations] = useState<
    BandInvitation[]
  >([]);

  const [isCreating, setIsCreating] =
    useState(false);
  const [changingInvitationId, setChangingInvitationId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const loadInvitations = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("band_invitations")
      .select(
        "id, email, token, created_at, expires_at, accepted_at",
      )
      .eq("band_id", bandId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Einladungen konnten nicht geladen werden:",
        error,
      );
      return;
    }

    setInvitations((data ?? []) as BandInvitation[]);
  }, [bandId]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

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
      .select("id, token")
      .single();

    if (error) {
      console.error(
        "Einladung konnte nicht erstellt werden:",
        error,
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
      "Die Einladung wurde erstellt.",
    );
    setEmail("");
    setIsCreating(false);

    await loadInvitations();
    onInvitationChanged?.();
  }

  async function copyUrl(token: string) {
    const url =
      `${window.location.origin}/join/${token}`;

    try {
      await navigator.clipboard.writeText(url);
      setSuccessMessage(
        "Der Einladungslink wurde kopiert.",
      );
      setErrorMessage("");
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

  async function revokeInvitation(
    invitation: BandInvitation,
  ) {
    if (changingInvitationId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Möchtest du die Einladung für ${invitation.email} wirklich widerrufen?`,
    );

    if (!confirmed) {
      return;
    }

    setChangingInvitationId(invitation.id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("band_invitations")
      .delete()
      .eq("id", invitation.id)
      .eq("band_id", bandId);

    if (error) {
      console.error(
        "Einladung konnte nicht widerrufen werden:",
        error,
      );
      setErrorMessage(
        "Die Einladung konnte nicht widerrufen werden.",
      );
      setChangingInvitationId(null);
      return;
    }

    setSuccessMessage(
      `Die Einladung für ${invitation.email} wurde widerrufen.`,
    );
    await loadInvitations();
    onInvitationChanged?.();
    setChangingInvitationId(null);
  }

  async function recreateInvitation(
    invitation: BandInvitation,
  ) {
    if (changingInvitationId !== null) {
      return;
    }

    setChangingInvitationId(invitation.id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage(
        "Dein Benutzerkonto konnte nicht geladen werden.",
      );
      setChangingInvitationId(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("band_invitations")
      .delete()
      .eq("id", invitation.id)
      .eq("band_id", bandId);

    if (deleteError) {
      setErrorMessage(
        "Die alte Einladung konnte nicht entfernt werden.",
      );
      setChangingInvitationId(null);
      return;
    }

    const { data, error } = await supabase
      .from("band_invitations")
      .insert({
        band_id: bandId,
        email: invitation.email,
        invited_by: user.id,
      })
      .select("token")
      .single();

    if (error) {
      setErrorMessage(
        "Die Einladung konnte nicht neu erstellt werden.",
      );
      setChangingInvitationId(null);
      await loadInvitations();
      return;
    }

    const newUrl =
      `${window.location.origin}/join/${data.token}`;

    setInvitationUrl(newUrl);
    setSuccessMessage(
      "Die Einladung wurde mit einem neuen Link und sieben Tagen Laufzeit neu erstellt.",
    );

    await loadInvitations();
    onInvitationChanged?.();
    setChangingInvitationId(null);
  }

  function closeInvitation() {
    setIsOpen(false);
    setEmail("");
    setInvitationUrl("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  return (
    <div className="w-full space-y-5 sm:max-w-xl">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-2xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-500"
        >
          + Mitglied einladen
        </button>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
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
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-500/30 bg-green-950/40 p-3 text-sm text-green-200">
          {successMessage}
        </div>
      )}

      {invitationUrl && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-bold text-zinc-300">
            Neuer Einladungslink
          </p>

          <input
            type="text"
            value={invitationUrl}
            readOnly
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-400 outline-none"
          />

          <button
            type="button"
            onClick={() =>
              void navigator.clipboard.writeText(
                invitationUrl,
              )
            }
            className="mt-3 w-full rounded-xl bg-zinc-700 px-4 py-3 font-bold transition hover:bg-zinc-600"
          >
            🔗 Link kopieren
          </button>
        </div>
      )}

      <div>
        <h3 className="font-black text-zinc-300">
          Offene Einladungen
        </h3>

        <div className="mt-3 space-y-3">
          {invitations.map((invitation) => {
            const isChanging =
              changingInvitationId === invitation.id;
            const isExpired =
              new Date(invitation.expires_at).getTime() <=
              Date.now();

            return (
              <article
                key={invitation.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <p className="font-bold text-white">
                  {invitation.email}
                </p>

                <p className="mt-1 text-sm text-zinc-400">
                  {isExpired
                    ? "Abgelaufen"
                    : `Gültig bis ${new Date(
                        invitation.expires_at,
                      ).toLocaleString("de-DE")}`}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void copyUrl(invitation.token)
                    }
                    className="rounded-xl bg-zinc-700 px-4 py-3 text-sm font-bold transition hover:bg-zinc-600"
                  >
                    🔗 Link kopieren
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void recreateInvitation(
                        invitation,
                      )
                    }
                    disabled={isChanging}
                    className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold transition hover:bg-blue-600 disabled:opacity-50"
                  >
                    Neu erstellen
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void revokeInvitation(
                        invitation,
                      )
                    }
                    disabled={isChanging}
                    className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    Widerrufen
                  </button>
                </div>
              </article>
            );
          })}

          {invitations.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-center text-sm text-zinc-500">
              Keine offenen Einladungen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}