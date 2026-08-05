"use client";

import { useState } from "react";
import { Share2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getActiveBandId } from "../lib/band";

type PdfShareButtonProps = {
  songId: number;
  songTitle: string;
  hasOwnPdf: boolean;
};

type BandMember = {
  userId: string;
  name: string;
  email: string;
};

export default function PdfShareButton({
  songId,
  songTitle,
  hasOwnPdf,
}: PdfShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bandMembers, setBandMembers] =
  useState<BandMember[]>([]);
const [activeBandId, setActiveBandId] =
  useState<number | null>(null);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [sourcePdfId, setSourcePdfId] =
    useState<number | null>(null);

  const [selectedRecipients, setSelectedRecipients] =
    useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const availableMembers = bandMembers.filter(
    (member) => member.userId !== currentUserId,
  );

  const allSelected =
    availableMembers.length > 0 &&
    availableMembers.every((member) =>
      selectedRecipients.has(member.userId),
    );

  async function openShareDialog() {
  if (!hasOwnPdf) {
    alert(
      "Bitte lade zuerst deine eigene PDF für diesen Song hoch.",
    );
    return;
  }

  setIsOpen(true);
  setIsLoading(true);
  setErrorMessage("");
  setSelectedRecipients(new Set());
  setBandMembers([]);

  try {
    const bandId = await getActiveBandId();

    setActiveBandId(bandId);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Angemeldeter Benutzer konnte nicht geladen werden:",
        userError,
      );

      setErrorMessage("Du bist nicht angemeldet.");
      return;
    }

    setCurrentUserId(user.id);

    // Mitglieder der aktuell ausgewählten Band laden.
    const { data: members, error: membersError } =
      await supabase
        .from("band_members")
        .select("user_id, display_name, email")
        .eq("band_id", bandId)
        .eq("is_active", true)
        .order("display_name", { ascending: true });

    if (membersError) {
      console.error(
        "Bandmitglieder konnten nicht geladen werden:",
        membersError.message,
        membersError.code,
        membersError.details,
        membersError.hint,
      );

      setErrorMessage(
        "Die Bandmitglieder konnten nicht geladen werden.",
      );
      return;
    }

    setBandMembers(
      (members ?? []).map((member) => ({
        userId: member.user_id,
        name: member.display_name,
        email: member.email,
      })),
    );

    // Eigene PDF innerhalb der aktiven Band suchen.
    const { data: pdf, error: pdfError } =
      await supabase
        .from("song_pdfs")
        .select("id")
        .eq("song_id", songId)
        .eq("user_id", user.id)
        .eq("band_id", bandId)
        .maybeSingle();

    if (pdfError || !pdf) {
      console.error(
        "Eigene PDF konnte nicht geladen werden:",
        pdfError?.message,
        pdfError?.code,
        pdfError?.details,
        pdfError?.hint,
      );

      setErrorMessage(
        "Deine eigene PDF für diesen Song wurde nicht gefunden.",
      );
      return;
    }

    setSourcePdfId(pdf.id);

    // Bestehende Freigaben dieser Band laden.
    const { data: shares, error: sharesError } =
      await supabase
        .from("song_pdf_shares")
        .select("recipient_user_id")
        .eq("source_pdf_id", pdf.id)
        .eq("band_id", bandId);

    if (sharesError) {
      console.error(
        "PDF-Freigaben konnten nicht geladen werden:",
        sharesError.message,
        sharesError.code,
        sharesError.details,
        sharesError.hint,
      );

      setErrorMessage(
        "Die bisherigen Freigaben konnten nicht geladen werden.",
      );
      return;
    }

    setSelectedRecipients(
      new Set(
        (shares ?? []).map(
          (share) => share.recipient_user_id,
        ),
      ),
    );
  } catch (error) {
    console.error(
      "PDF-Freigabe konnte nicht geöffnet werden:",
      error,
    );

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Die aktive Band konnte nicht geladen werden.",
    );
  } finally {
    setIsLoading(false);
  }
}

  function closeShareDialog() {
    if (isSaving) {
      return;
    }

    setIsOpen(false);
    setErrorMessage("");
    setSourcePdfId(null);
    setSelectedRecipients(new Set());
  }

  function toggleRecipient(userId: string) {
    setSelectedRecipients((current) => {
      const updated = new Set(current);

      if (updated.has(userId)) {
        updated.delete(userId);
      } else {
        updated.add(userId);
      }

      return updated;
    });
  }

  function toggleAllRecipients() {
    if (allSelected) {
      setSelectedRecipients(new Set());
      return;
    }

    setSelectedRecipients(
      new Set(
        availableMembers.map((member) => member.userId),
      ),
    );
  }

  async function saveShares() {
    if (!currentUserId || !sourcePdfId || !activeBandId) {
      setErrorMessage(
        "Die PDF-Freigaben können noch nicht gespeichert werden.",
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const { data: existingShares, error: loadError } =
      await supabase
        .from("song_pdf_shares")
        .select("recipient_user_id")
        .eq("source_pdf_id", sourcePdfId)
.eq("band_id", activeBandId);

    if (loadError) {
      console.error(
        "Freigaben konnten nicht geprüft werden:",
        loadError,
      );

      setErrorMessage(
        "Die Freigaben konnten nicht geprüft werden.",
      );
      setIsSaving(false);
      return;
    }

    const existingRecipientIds = new Set(
      (existingShares ?? []).map(
        (share) => share.recipient_user_id,
      ),
    );

    const selectedIds = Array.from(selectedRecipients);

    const recipientsToAdd = selectedIds.filter(
      (userId) => !existingRecipientIds.has(userId),
    );

    const recipientsToRemove = Array.from(
      existingRecipientIds,
    ).filter(
      (userId) => !selectedRecipients.has(userId),
    );

    if (recipientsToRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from("song_pdf_shares")
        .delete()
        .eq("source_pdf_id", sourcePdfId)
.eq("band_id", activeBandId)
.in("recipient_user_id", recipientsToRemove);

      if (deleteError) {
        console.error(
          "Freigaben konnten nicht entfernt werden:",
          deleteError,
        );

        setErrorMessage(
          "Vorhandene Freigaben konnten nicht entfernt werden.",
        );
        setIsSaving(false);
        return;
      }
    }

    if (recipientsToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from("song_pdf_shares")
        .insert(
          recipientsToAdd.map((recipientUserId) => ({
  source_pdf_id: sourcePdfId,
  sender_user_id: currentUserId,
  recipient_user_id: recipientUserId,
  band_id: activeBandId,
})),
        );

      if (insertError) {
        console.error(
          "Freigaben konnten nicht erstellt werden:",
          insertError,
        );

        setErrorMessage(
          "Die neuen Freigaben konnten nicht gespeichert werden.",
        );
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    alert("PDF-Freigaben wurden gespeichert.");
    closeShareDialog();
  }

  return (
    <>
      <button
        type="button"
        onClick={openShareDialog}
        disabled={!hasOwnPdf}
        className="rounded-xl bg-violet-600 p-2 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        title={
          hasOwnPdf
            ? "PDF mit Bandmitgliedern teilen"
            : "Zuerst eine eigene PDF hochladen"
        }
      >
        <Share2 size={18} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeShareDialog();
            }
          }}
        >
          <section className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-violet-400">
                  PDF teilen
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  {songTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeShareDialog}
                disabled={isSaving}
                className="rounded-xl bg-zinc-800 p-2 text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
                title="Fenster schließen"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-5 text-sm text-zinc-400">
              Wähle die Bandmitglieder aus, die deine PDF
              verwenden dürfen. Eigene PDFs der Empfänger
              bleiben erhalten und haben Vorrang.
            </p>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            {isLoading ? (
              <div className="mt-6 rounded-2xl bg-zinc-950 p-5 text-center text-zinc-400">
                Freigaben werden geladen …
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={toggleAllRecipients}
                  className="flex w-full items-center justify-between rounded-2xl border border-violet-500/40 bg-violet-950/30 px-4 py-4 text-left transition hover:bg-violet-950/60"
                >
                  <span className="font-black text-white">
                    Alle Bandmitglieder
                  </span>

                  <span className="text-xl text-violet-300">
                    {allSelected ? "✓" : "○"}
                  </span>
                </button>

                {availableMembers.map((member) => {
                  const isSelected =
                    selectedRecipients.has(member.userId);

                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() =>
                        toggleRecipient(member.userId)
                      }
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-green-500/50 bg-green-950/30"
                          : "border-white/10 bg-zinc-950 hover:bg-zinc-800"
                      }`}
                    >
                      <span>
                        <span className="block font-black text-white">
                          {member.name}
                        </span>

                        <span className="mt-1 block text-sm text-zinc-400">
                          {member.email}
                        </span>
                      </span>

                      <span
                        className={`text-xl ${
                          isSelected
                            ? "text-green-400"
                            : "text-zinc-600"
                        }`}
                      >
                        {isSelected ? "✓" : "○"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeShareDialog}
                disabled={isSaving}
                className="rounded-xl bg-zinc-700 px-5 py-3 font-bold text-white transition hover:bg-zinc-600 disabled:opacity-50"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={saveShares}
                disabled={isLoading || isSaving}
                className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Wird gespeichert …"
                  : "Freigaben speichern"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}