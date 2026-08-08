"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import AdminNavigation from "../../components/AdminNavigation";
import { BandMemberInvitation } from "../../components/BandMemberInvitation";
import { createClient } from "../../lib/client";
import {
  CurrentBand,
  getCurrentBand,
  getUserBands,
  setActiveBand,
} from "../../lib/band";

type BandMember = {
  user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export default function BandManagementPage() {
  const [band, setBand] = useState<CurrentBand | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [changingMemberId, setChangingMemberId] =
    useState<string | null>(null);

  const [bandName, setBandName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingBand, setIsDeletingBand] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] =
    useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] =
    useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [publicBandUrl, setPublicBandUrl] = useState("");

  const loadBandData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const currentBand = await getCurrentBand();

      setBand(currentBand);
      setBandName(currentBand.name);
      setContactEmail(currentBand.contactEmail);

      if (typeof window !== "undefined") {
        setPublicBandUrl(
          `${window.location.origin}/b/${currentBand.slug}`,
        );
      }

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Das aktuelle Benutzerkonto konnte nicht geladen werden.",
        );
      }

      setCurrentUserId(user.id);

      const { data: memberData, error: memberError } =
        await supabase
          .from("band_members")
          .select(
            "user_id, display_name, email, is_active, created_at",
          )
          .eq("band_id", currentBand.id)
          .order("display_name", {
            ascending: true,
          });

      if (memberError) {
        throw new Error(
          `Bandmitglieder konnten nicht geladen werden: ${memberError.message}`,
        );
      }

      setMembers((memberData ?? []) as BandMember[]);
    } catch (error) {
      console.error(
        "Bandverwaltung konnte nicht geladen werden:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Die Bandverwaltung konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBandData();
  }, [loadBandData]);

  async function saveBandData(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!band || isSaving) {
      return;
    }

    const normalizedBandName = bandName.trim();
    const normalizedContactEmail =
      contactEmail.trim().toLowerCase();

    if (!normalizedBandName) {
      setErrorMessage(
        "Bitte gib einen Bandnamen ein.",
      );
      return;
    }

    if (!normalizedContactEmail) {
      setErrorMessage(
        "Bitte gib eine Kontakt-E-Mail-Adresse ein.",
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("bands")
      .update({
        name: normalizedBandName,
        contact_email: normalizedContactEmail,
      })
      .eq("id", band.id)
      .select("id, name, slug, contact_email")
      .maybeSingle();

    if (error || !data) {
      console.error(
        "Banddaten konnten nicht gespeichert werden:",
        error?.message,
        error?.code,
        error?.details,
        error?.hint,
      );

      setErrorMessage(
        "Die Banddaten konnten nicht gespeichert werden.",
      );
      setIsSaving(false);
      return;
    }

    setBand((currentBand) => {
      if (!currentBand) {
        return currentBand;
      }

      return {
        ...currentBand,
        name: data.name,
        slug: data.slug,
        contactEmail: data.contact_email,
      };
    });

    setBandName(data.name);
    setContactEmail(data.contact_email);
    setSuccessMessage("Die Banddaten wurden gespeichert.");
    setIsSaving(false);
  }

  async function copyPublicUrl() {
    if (!publicBandUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicBandUrl);
      setSuccessMessage(
        "Der Link zur Bandseite wurde kopiert.",
      );
      setErrorMessage("");
    } catch (error) {
      console.error(
        "Link konnte nicht kopiert werden:",
        error,
      );

      setErrorMessage(
        "Der Link konnte nicht kopiert werden.",
      );
    }
  }

  async function setMemberActive(
    member: BandMember,
    isActive: boolean,
  ) {
    if (changingMemberId !== null) {
      return;
    }

    const actionLabel = isActive
      ? "reaktivieren"
      : "deaktivieren";

    const confirmed = window.confirm(
      `Möchtest du „${member.display_name}“ wirklich ${actionLabel}?`,
    );

    if (!confirmed) {
      return;
    }

    setChangingMemberId(member.user_id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc(
      "set_band_member_active",
      {
        p_member_user_id: member.user_id,
        p_is_active: isActive,
      },
    );

    if (error) {
      console.error(
        "Mitgliedsstatus konnte nicht geändert werden:",
        error,
      );

      setErrorMessage(
        error.message ||
          "Der Mitgliedsstatus konnte nicht geändert werden.",
      );
      setChangingMemberId(null);
      return;
    }

    setSuccessMessage(
      isActive
        ? `${member.display_name} wurde reaktiviert.`
        : `${member.display_name} wurde deaktiviert.`,
    );

    await loadBandData();
    setChangingMemberId(null);
  }

  async function removeMember(member: BandMember) {
    if (changingMemberId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Möchtest du „${member.display_name}“ wirklich endgültig aus der Band entfernen?`,
    );

    if (!confirmed) {
      return;
    }

    setChangingMemberId(member.user_id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc(
      "remove_band_member",
      {
        p_member_user_id: member.user_id,
      },
    );

    if (error) {
      console.error(
        "Bandmitglied konnte nicht entfernt werden:",
        error,
      );

      setErrorMessage(
        error.message ||
          "Das Bandmitglied konnte nicht entfernt werden.",
      );
      setChangingMemberId(null);
      return;
    }

    setSuccessMessage(
      `${member.display_name} wurde aus der Band entfernt.`,
    );

    await loadBandData();
    setChangingMemberId(null);
  }

  async function deleteBandAccount() {
    if (!band || isDeletingBand) {
      return;
    }

    if (
      deleteConfirmationName.trim() !==
      band.name.trim()
    ) {
      setErrorMessage(
        "Der eingegebene Bandname stimmt nicht mit dem aktuellen Bandnamen überein.",
      );
      return;
    }

    setIsDeletingBand(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    try {
      /*
       * Zuerst alle Storage-Dateien ermitteln,
       * solange die Band und ihre Datensätze noch existieren.
       */
      const {
        data: storageFiles,
        error: storagePathsError,
      } = await supabase.rpc(
        "get_band_deletion_storage_paths",
        {
          requested_band_id: band.id,
        },
      );

      if (storagePathsError) {
        throw new Error(
          `Dateien der Band konnten nicht ermittelt werden: ${storagePathsError.message}`,
        );
      }

      const pathsByBucket = new Map<string, string[]>();

      for (const file of storageFiles ?? []) {
        const bucketName =
          typeof file.bucket_name === "string"
            ? file.bucket_name
            : "";

        const storagePath =
          typeof file.storage_path === "string"
            ? file.storage_path
            : "";

        if (!bucketName || !storagePath) {
          continue;
        }

        const currentPaths =
          pathsByBucket.get(bucketName) ?? [];

        if (!currentPaths.includes(storagePath)) {
          currentPaths.push(storagePath);
        }

        pathsByBucket.set(
          bucketName,
          currentPaths,
        );
      }

      /*
       * Dateien aus allen betroffenen Buckets entfernen.
       * Erst wenn das geklappt hat, wird die Datenbank gelöscht.
       */
      for (const [bucketName, paths] of pathsByBucket) {
        if (paths.length === 0) {
          continue;
        }

        const { error: storageDeleteError } =
          await supabase.storage
            .from(bucketName)
            .remove(paths);

        if (storageDeleteError) {
          throw new Error(
            `Dateien aus „${bucketName}“ konnten nicht gelöscht werden: ${storageDeleteError.message}`,
          );
        }
      }

      /*
       * Jetzt die Band löschen.
       * Die abhängigen Daten verschwinden über ON DELETE CASCADE.
       */
      const { error: deleteError } =
        await supabase.rpc(
          "delete_band_account",
          {
            requested_band_id: band.id,
            confirmation_name:
              deleteConfirmationName.trim(),
          },
        );

      if (deleteError) {
        throw new Error(
          deleteError.message ||
            "Das Bandkonto konnte nicht aufgelöst werden.",
        );
      }

      /*
       * Nach dem Löschen prüfen, ob der Benutzer
       * noch weitere aktive Bandmitgliedschaften besitzt.
       */
      const remainingBands =
        await getUserBands();

      if (remainingBands.length > 0) {
        await setActiveBand(
          remainingBands[0].id,
        );

        window.location.href = "/admin";
        return;
      }

      /*
       * Das persönliche Benutzerkonto bleibt bestehen.
       * Ohne weitere Band verlassen wir aber den Adminbereich,
       * damit keine Seite mit fehlender Band geladen wird.
       */
      window.location.href = "/admin-login";
    } catch (error) {
      console.error(
        "Bandkonto konnte nicht aufgelöst werden:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Das Bandkonto konnte nicht aufgelöst werden.",
      );

      setIsDeletingBand(false);
    }
  }

  const activeMembers = members.filter(
    (member) => member.is_active,
  );

  const inactiveMembers = members.filter(
    (member) => !member.is_active,
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-4 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />

        <header>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            Deine Setlist
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Bandmitglieder
          </h1>
        
          <p className="mt-3 max-w-2xl text-zinc-400">
            Verwalte die Banddaten, Zugänge und Mitglieder
            deiner Band.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-8 rounded-2xl border border-green-500/40 bg-green-950/40 px-5 py-4 text-green-200">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900/80 p-10 text-center text-zinc-400">
            Banddaten werden geladen …
          </div>
        ) : band ? (
          <div className="mt-8 space-y-8">
            <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl sm:p-8">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-zinc-500">
                  Allgemeine Einstellungen
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Banddaten
                </h2>
              </div>

              <form
                onSubmit={saveBandData}
                className="mt-6 space-y-5"
              >
                <div>
                  <label
                    htmlFor="bandName"
                    className="text-sm font-bold text-zinc-300"
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
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contactEmail"
                    className="text-sm font-bold text-zinc-300"
                  >
                    Kontakt-E-Mail
                  </label>

                  <input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(event) =>
                      setContactEmail(event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <p className="text-sm font-bold text-zinc-300">
                    Öffentliche Bandseite
                  </p>

                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={publicBandUrl}
                      readOnly
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-zinc-400 outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => void copyPublicUrl()}
                      className="rounded-2xl bg-zinc-700 px-5 py-4 font-bold transition hover:bg-zinc-600"
                    >
                      Link kopieren
                    </button>

                    <Link
                      href={`/b/${band.slug}`}
                      target="_blank"
                      className="rounded-2xl bg-zinc-700 px-5 py-4 text-center font-bold transition hover:bg-zinc-600"
                    >
                      Öffnen ↗
                    </Link>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-red-600 px-6 py-4 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {isSaving
                    ? "Wird gespeichert …"
                    : "Banddaten speichern"}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-zinc-500">
                    Zugänge
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Bandmitglieder
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    {activeMembers.length} aktive{" "}
                    {activeMembers.length === 1
                      ? "Person"
                      : "Personen"}
                  </p>
                </div>

                <BandMemberInvitation
                  bandId={band.id}
                  onInvitationChanged={() =>
                    void loadBandData()
                  }
                />
              </div>

              <div className="mt-6 space-y-3">
                {activeMembers.map((member) => {
                  const isCurrentUser =
                    member.user_id === currentUserId;
                  const isChanging =
                    changingMemberId === member.user_id;
                  const isLastActiveMember =
                    activeMembers.length <= 1;

                  return (
                    <article
                      key={member.user_id}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black">
                            {member.display_name}
                          </h3>

                          {isCurrentUser && (
                            <span className="rounded-full bg-red-950/50 px-3 py-1 text-xs font-bold text-red-300">
                              Du
                            </span>
                          )}

                          <span className="rounded-full bg-green-950/50 px-3 py-1 text-xs font-bold text-green-300">
                            Aktiv
                          </span>
                        </div>

                        <p className="mt-1 truncate text-sm text-zinc-400">
                          {member.email}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void setMemberActive(
                              member,
                              false,
                            )
                          }
                          disabled={
                            isChanging ||
                            isLastActiveMember
                          }
                          className="rounded-xl bg-zinc-700 px-4 py-3 text-sm font-bold transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            isLastActiveMember
                              ? "Die letzte aktive Person kann nicht deaktiviert werden."
                              : "Mitglied deaktivieren"
                          }
                        >
                          {isChanging
                            ? "Wird geändert …"
                            : "Deaktivieren"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void removeMember(member)
                          }
                          disabled={
                            isChanging ||
                            isLastActiveMember
                          }
                          className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            isLastActiveMember
                              ? "Die letzte aktive Person kann nicht entfernt werden."
                              : "Mitglied endgültig entfernen"
                          }
                        >
                          Entfernen
                        </button>
                      </div>
                    </article>
                  );
                })}

                {activeMembers.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-zinc-400">
                    Keine aktiven Bandmitglieder gefunden.
                  </div>
                )}
              </div>

              {inactiveMembers.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-black text-zinc-400">
                    Ehemalige Mitglieder
                  </h3>

                  <div className="mt-3 space-y-3">
                    {inactiveMembers.map((member) => {
                      const isChanging =
                        changingMemberId ===
                        member.user_id;

                      return (
                        <article
                          key={member.user_id}
                          className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-black/10 p-5 opacity-70 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold">
                                {member.display_name}
                              </h4>

                              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-400">
                                Inaktiv
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-zinc-500">
                              {member.email}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void setMemberActive(
                                  member,
                                  true,
                                )
                              }
                              disabled={isChanging}
                              className="rounded-xl bg-green-700 px-4 py-3 text-sm font-bold transition hover:bg-green-600 disabled:cursor-wait disabled:opacity-50"
                            >
                              {isChanging
                                ? "Wird geändert …"
                                : "Reaktivieren"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void removeMember(member)
                              }
                              disabled={isChanging}
                              className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-600 hover:text-white disabled:cursor-wait disabled:opacity-50"
                            >
                              Entfernen
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-red-500/20 bg-red-950/10 p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-400">
                Gefahrenbereich
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Bandkonto auflösen
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Beim Auflösen werden die Band und alle dazugehörigen
                Daten dauerhaft gelöscht. Dazu gehören unter anderem
                Songs, Konzerte, Stimmen, gespeicherte Setlists,
                Bandmitglieder, Einladungen, Bandfotos und Song-PDFs.
                Dein persönliches Benutzerkonto bleibt bestehen.
              </p>

              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmationName("");
                  setErrorMessage("");
                  setSuccessMessage("");
                  setIsDeleteDialogOpen(true);
                }}
                disabled={isDeletingBand}
                className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-3 font-black text-red-300 transition hover:bg-red-600 hover:text-white disabled:cursor-wait disabled:opacity-50"
              >
                Bandkonto auflösen
              </button>
            </section>
          </div>
        ) : null}
      </div>

      {isDeleteDialogOpen && band && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-red-500/30 bg-zinc-950 p-6 shadow-2xl sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-400">
              Endgültig löschen
            </p>

            <h2 className="mt-2 text-3xl font-black">
              {band.name} auflösen?
            </h2>

            <p className="mt-4 leading-relaxed text-zinc-400">
              Diese Aktion kann nicht rückgängig gemacht werden.
              Alle Daten und Dateien dieser Band werden dauerhaft
              gelöscht. Dein persönlicher Login bleibt erhalten.
            </p>

            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-950/20 p-5">
              <p className="text-sm text-zinc-300">
                Gib zur Bestätigung den Bandnamen exakt ein:
              </p>

              <p className="mt-2 font-black text-red-300">
                {band.name}
              </p>

              <input
                type="text"
                value={deleteConfirmationName}
                onChange={(event) =>
                  setDeleteConfirmationName(
                    event.target.value,
                  )
                }
                disabled={isDeletingBand}
                autoComplete="off"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none focus:border-red-500 disabled:opacity-50"
                placeholder={band.name}
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeleteConfirmationName("");
                }}
                disabled={isDeletingBand}
                className="rounded-2xl bg-zinc-800 px-5 py-4 font-bold transition hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-50"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={() =>
                  void deleteBandAccount()
                }
                disabled={
                  isDeletingBand ||
                  deleteConfirmationName.trim() !==
                    band.name.trim()
                }
                className="rounded-2xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {isDeletingBand
                  ? "Band wird endgültig gelöscht …"
                  : "Band endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}