"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../lib/client";

type Invitation = {
  band_id: number;
  band_name: string;
  invited_email: string;
  expires_at: string;
  accepted_at: string | null;
};

export default function JoinBandPage() {
  const params = useParams();
  const router = useRouter();

  const token =
    typeof params.token === "string"
      ? params.token
      : "";

  const [supabase] = useState(() => createClient());

  const [invitation, setInvitation] =
    useState<Invitation | null>(null);

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [currentUserEmail, setCurrentUserEmail] =
    useState("");

  const [displayName, setDisplayName] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [passwordConfirmation, setPasswordConfirmation] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    void loadInvitation();
  }, [token]);

  async function loadInvitation() {
    setLoading(true);
    setErrorMessage("");

    if (!token) {
      setErrorMessage(
        "Der Einladungslink ist ungültig.",
      );
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .rpc("get_band_invitation", {
        invitation_token: token,
      })
      .maybeSingle();

    if (error) {
      console.error(
        "Einladung konnte nicht geladen werden:",
        error.message,
        error.code,
        error.details,
        error.hint,
      );

      setErrorMessage(
        "Die Einladung konnte nicht geladen werden.",
      );
      setLoading(false);
      return;
    }

    if (!data) {
      setErrorMessage(
        "Diese Einladung wurde nicht gefunden.",
      );
      setLoading(false);
      return;
    }

    const loadedInvitation =
      data as Invitation;

    setInvitation(loadedInvitation);

    if (loadedInvitation.accepted_at) {
      setErrorMessage(
        "Diese Einladung wurde bereits verwendet.",
      );
      setLoading(false);
      return;
    }

    if (
      new Date(loadedInvitation.expires_at).getTime() <=
      Date.now()
    ) {
      setErrorMessage(
        "Diese Einladung ist leider abgelaufen.",
      );
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsLoggedIn(Boolean(user));
    setCurrentUserEmail(
      user?.email?.toLowerCase() ?? "",
    );

    setLoading(false);
  }

  async function acceptInvitation() {
    if (!invitation || !displayName.trim()) {
      setErrorMessage(
        "Bitte gib deinen Namen ein.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.rpc(
      "accept_band_invitation",
      {
        invitation_token: token,
        member_display_name:
          displayName.trim(),
      },
    );

    if (error) {
      console.error(
        "Einladung konnte nicht angenommen werden:",
        error.message,
        error.code,
        error.details,
        error.hint,
      );

      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    const joinedBand = Array.isArray(data)
      ? data[0]
      : data;

    setSuccessMessage(
      `Du bist jetzt Mitglied von ${
        joinedBand?.joined_band_name ??
        invitation.band_name
      }.`,
    );

    window.setTimeout(() => {
      router.replace("/admin");
      router.refresh();
    }, 1200);
  }

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !invitation ||
      !password ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: invitation.invited_email,
        password,
      });

    if (error || !data.user) {
      console.error(
        "Anmeldung fehlgeschlagen:",
        error,
      );

      setErrorMessage(
        "Die Anmeldung ist fehlgeschlagen. Prüfe bitte dein Passwort.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsLoggedIn(true);
    setCurrentUserEmail(
      data.user.email?.toLowerCase() ?? "",
    );
    setPassword("");
    setIsSubmitting(false);
  }

  async function handleRegistration(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!invitation || isSubmitting) {
      return;
    }

    if (!displayName.trim()) {
      setErrorMessage(
        "Bitte gib deinen Namen ein.",
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
        "Die Passwörter stimmen nicht überein.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const emailRedirectTo =
      `${window.location.origin}` +
      `/auth/callback?next=/join/${token}`;

    const { data, error } =
      await supabase.auth.signUp({
        email: invitation.invited_email,
        password,
        options: {
          emailRedirectTo,
          data: {
            display_name:
              displayName.trim(),
          },
        },
      });

    if (error) {
      console.error(
        "Registrierung fehlgeschlagen:",
        error.message,
        error.code,
      );

      setErrorMessage(
        error.message.includes(
          "already registered",
        )
          ? "Für diese E-Mail existiert bereits ein Konto. Melde dich bitte an."
          : "Das Konto konnte nicht erstellt werden.",
      );

      setIsSubmitting(false);
      return;
    }

    if (data.session && data.user) {
      setIsLoggedIn(true);
      setCurrentUserEmail(
        data.user.email?.toLowerCase() ?? "",
      );
      setPassword("");
      setPasswordConfirmation("");
      setIsSubmitting(false);

      await acceptInvitation();
      return;
    }

    setSuccessMessage(
      "Das Konto wurde erstellt. Öffne jetzt die Bestätigungsmail. Danach gelangst du zurück zu dieser Einladung.",
    );

    setPassword("");
    setPasswordConfirmation("");
    setIsSubmitting(false);
  }

  const emailMatches =
    currentUserEmail &&
    invitation &&
    currentUserEmail ===
      invitation.invited_email.toLowerCase();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-10 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900/90 p-7 shadow-2xl sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
          Deine Setlist
        </p>

        <h1 className="mt-3 text-3xl font-black sm:text-4xl">
          Bandeinladung
        </h1>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-zinc-400">
            Einladung wird geladen …
          </div>
        ) : invitation ? (
          <>
            <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-950/30 p-5">
              <p className="text-sm font-bold text-zinc-400">
                Du wurdest eingeladen zu:
              </p>

              <h2 className="mt-2 text-3xl font-black">
                🎸 {invitation.band_name}
              </h2>

              <p className="mt-3 break-all text-sm text-zinc-400">
                {invitation.invited_email}
              </p>
            </div>

            {errorMessage && (
              <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mt-5 rounded-2xl border border-green-500/40 bg-green-950/40 p-4 text-sm text-green-200">
                {successMessage}
              </div>
            )}

            {isLoggedIn ? (
              <div className="mt-7">
                {!emailMatches ? (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5 text-amber-200">
                    <p className="font-bold">
                      Falsches Benutzerkonto
                    </p>

                    <p className="mt-2 text-sm">
                      Du bist als{" "}
                      <strong>
                        {currentUserEmail}
                      </strong>{" "}
                      angemeldet. Diese Einladung
                      gehört zu{" "}
                      <strong>
                        {
                          invitation.invited_email
                        }
                      </strong>
                      .
                    </p>

                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setIsLoggedIn(false);
                        setCurrentUserEmail("");
                        setErrorMessage("");
                      }}
                      className="mt-4 w-full rounded-xl bg-zinc-800 px-5 py-3 font-bold text-white hover:bg-zinc-700"
                    >
                      Abmelden und richtiges Konto verwenden
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label
                        htmlFor="displayName"
                        className="text-sm font-bold text-zinc-300"
                      >
                        Dein Name in der Band
                      </label>

                      <input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(event) =>
                          setDisplayName(
                            event.target.value,
                          )
                        }
                        placeholder="Zum Beispiel Nigel"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-red-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void acceptInvitation()
                      }
                      disabled={
                        !displayName.trim() ||
                        isSubmitting
                      }
                      className="w-full rounded-2xl bg-red-600 px-6 py-4 text-lg font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {isSubmitting
                        ? "Beitritt läuft …"
                        : `${invitation.band_name} beitreten`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-7 space-y-8">
                <form
                  onSubmit={handleLogin}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <h3 className="text-xl font-black">
                    Bestehendes Konto
                  </h3>

                  <p className="mt-2 text-sm text-zinc-400">
                    Melde dich mit dem Konto für{" "}
                    {invitation.invited_email} an.
                  </p>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Passwort"
                    autoComplete="current-password"
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-zinc-950 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-red-500"
                  />

                  <button
                    type="submit"
                    disabled={
                      !password || isSubmitting
                    }
                    className="mt-4 w-full rounded-2xl bg-zinc-700 px-5 py-3 font-black transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anmelden
                  </button>
                </form>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                    oder
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form
                  onSubmit={handleRegistration}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <h3 className="text-xl font-black">
                    Neues Konto erstellen
                  </h3>

                  <div className="mt-4">
                    <label
                      htmlFor="registrationName"
                      className="text-sm font-bold text-zinc-300"
                    >
                      Dein Name
                    </label>

                    <input
                      id="registrationName"
                      type="text"
                      value={displayName}
                      onChange={(event) =>
                        setDisplayName(
                          event.target.value,
                        )
                      }
                      placeholder="Zum Beispiel Mateo"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-red-500"
                    />
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="registrationPassword"
                      className="text-sm font-bold text-zinc-300"
                    >
                      Passwort
                    </label>

                    <input
                      id="registrationPassword"
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value,
                        )
                      }
                      placeholder="Mindestens 8 Zeichen"
                      autoComplete="new-password"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-red-500"
                    />
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="passwordConfirmation"
                      className="text-sm font-bold text-zinc-300"
                    >
                      Passwort wiederholen
                    </label>

                    <input
                      id="passwordConfirmation"
                      type="password"
                      value={passwordConfirmation}
                      onChange={(event) =>
                        setPasswordConfirmation(
                          event.target.value,
                        )
                      }
                      placeholder="Passwort wiederholen"
                      autoComplete="new-password"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-red-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      !displayName.trim() ||
                      !password ||
                      !passwordConfirmation ||
                      isSubmitting
                    }
                    className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-4 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    Konto erstellen
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          <>
            {errorMessage && (
              <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-950/40 p-5 text-red-200">
                {errorMessage}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}