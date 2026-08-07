"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import AdminNavigation from "../../components/AdminNavigation";
import BandGalleryManager from "../../components/BandGalleryManager";
import BandEventsManager from "../../components/BandEventsManager";
import BandLogoManager from "../../components/BandLogoManager";
import AccordionSection from "../../components/AccordionSection";
import { getCurrentBand } from "../../lib/band";
import { createClient } from "../../lib/client";

type BandInfo = {
    logo_path: string | null;
    description: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    website_url: string | null;
    booking_name: string | null;
    booking_email: string | null;
    booking_phone: string | null;
};
type PublicBandMember = {
    id: number;
    name: string;
    role: string | null;
    position: number;
    is_visible: boolean;
};

export default function BandInfoPage() {
    const [bandId, setBandId] = useState<number | null>(
        null,
    );
    const [bandName, setBandName] = useState("");
    const [bandSlug, setBandSlug] = useState("");
    const [logoPath, setLogoPath] = useState<string | null>(null);

    const [description, setDescription] = useState("");
    const [instagramUrl, setInstagramUrl] = useState("");
    const [facebookUrl, setFacebookUrl] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [bookingName, setBookingName] = useState("");
    const [bookingEmail, setBookingEmail] = useState("");
    const [bookingPhone, setBookingPhone] = useState("");

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] =
        useState("");
    const [publicMembers, setPublicMembers] =
        useState<PublicBandMember[]>([]);

    const [newMemberName, setNewMemberName] = useState("");
    const [newMemberRole, setNewMemberRole] = useState("");

    const [isAddingMember, setIsAddingMember] =
        useState(false);

    const [changingMemberId, setChangingMemberId] =
        useState<number | null>(null);

    const loadBandInfo = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");

        try {
            const currentBand = await getCurrentBand();

            setBandId(currentBand.id);
            setBandName(currentBand.name);
            setBandSlug(currentBand.slug);

            const supabase = createClient();

            const { data, error } = await supabase
                .from("bands")
                .select(
                    `
    logo_path,
    description,
    instagram_url,
    facebook_url,
    youtube_url,
    website_url,
    booking_name,
    booking_email,
    booking_phone
  `,
                )
                .eq("id", currentBand.id)
                .maybeSingle();

            if (error) {
                throw new Error(
                    `Bandinformationen konnten nicht geladen werden: ${error.message}`,
                );
            }

            const bandInfo = data as BandInfo | null;

            setLogoPath(bandInfo?.logo_path ?? null);
            setDescription(bandInfo?.description ?? "");
            setInstagramUrl(bandInfo?.instagram_url ?? "");
            setFacebookUrl(bandInfo?.facebook_url ?? "");
            setYoutubeUrl(bandInfo?.youtube_url ?? "");
            setWebsiteUrl(bandInfo?.website_url ?? "");
            setBookingName(bandInfo?.booking_name ?? "");
            setBookingEmail(bandInfo?.booking_email ?? "");
            setBookingPhone(bandInfo?.booking_phone ?? "");

            const {
                data: publicMemberData,
                error: publicMemberError,
            } = await supabase
                .from("band_public_members")
                .select("id, name, role, position, is_visible")
                .eq("band_id", currentBand.id)
                .order("position", { ascending: true })
                .order("id", { ascending: true });

            if (publicMemberError) {
                throw new Error(
                    `Öffentliche Bandmitglieder konnten nicht geladen werden: ${publicMemberError.message}`,
                );
            }

            setPublicMembers(
                (publicMemberData ?? []) as PublicBandMember[],
            );
        } catch (error) {
            console.error(
                "Bandinformationen konnten nicht geladen werden:",
                error,
            );

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Die Bandinformationen konnten nicht geladen werden.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadBandInfo();
    }, [loadBandInfo]);

    async function saveBandInfo(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (bandId === null || isSaving) {
            return;
        }

        setIsSaving(true);
        setErrorMessage("");
        setSuccessMessage("");

        const supabase = createClient();

        const { error } = await supabase
            .from("bands")
            .update({
                description: description.trim() || null,
                instagram_url: instagramUrl.trim() || null,
                facebook_url: facebookUrl.trim() || null,
                youtube_url: youtubeUrl.trim() || null,
                website_url: websiteUrl.trim() || null,
                booking_name: bookingName.trim() || null,
                booking_email: bookingEmail.trim() || null,
                booking_phone: bookingPhone.trim() || null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", bandId);

        if (error) {
            console.error(
                "Bandinformationen konnten nicht gespeichert werden:",
                error.message,
                error.code,
                error.details,
                error.hint,
            );

            setErrorMessage(
                "Die Bandinformationen konnten nicht gespeichert werden.",
            );

            setIsSaving(false);
            return;
        }

        setSuccessMessage(
            "Die öffentlichen Bandinformationen wurden gespeichert.",
        );
        setIsSaving(false);
    }

    async function addPublicMember() {
        const normalizedName = newMemberName.trim();
        const normalizedRole = newMemberRole.trim();

        if (
            bandId === null ||
            !normalizedName ||
            isAddingMember
        ) {
            return;
        }

        setIsAddingMember(true);
        setErrorMessage("");
        setSuccessMessage("");

        const supabase = createClient();

        const nextPosition =
            publicMembers.length > 0
                ? Math.max(
                    ...publicMembers.map(
                        (member) => member.position,
                    ),
                ) + 1
                : 0;

        const { data, error } = await supabase
            .from("band_public_members")
            .insert({
                band_id: bandId,
                name: normalizedName,
                role: normalizedRole || null,
                position: nextPosition,
                is_visible: true,
            })
            .select("id, name, role, position, is_visible")
            .single();

        if (error) {
            console.error(
                "Öffentliches Bandmitglied konnte nicht hinzugefügt werden:",
                error.message,
                error.code,
                error.details,
                error.hint,
            );

            setErrorMessage(
                "Das öffentliche Bandmitglied konnte nicht hinzugefügt werden.",
            );
            setIsAddingMember(false);
            return;
        }

        setPublicMembers((currentMembers) => [
            ...currentMembers,
            data as PublicBandMember,
        ]);

        setNewMemberName("");
        setNewMemberRole("");
        setSuccessMessage(
            "Das öffentliche Bandmitglied wurde hinzugefügt.",
        );
        setIsAddingMember(false);
    }

    async function togglePublicMember(
        member: PublicBandMember,
    ) {
        if (bandId === null || changingMemberId !== null) {
            return;
        }

        setChangingMemberId(member.id);
        setErrorMessage("");
        setSuccessMessage("");

        const supabase = createClient();

        const { error } = await supabase
            .from("band_public_members")
            .update({
                is_visible: !member.is_visible,
                updated_at: new Date().toISOString(),
            })
            .eq("id", member.id)
            .eq("band_id", bandId);

        if (error) {
            console.error(
                "Sichtbarkeit konnte nicht geändert werden:",
                error.message,
                error.code,
                error.details,
                error.hint,
            );

            setErrorMessage(
                "Die Sichtbarkeit konnte nicht geändert werden.",
            );
            setChangingMemberId(null);
            return;
        }

        setPublicMembers((currentMembers) =>
            currentMembers.map((currentMember) =>
                currentMember.id === member.id
                    ? {
                        ...currentMember,
                        is_visible: !currentMember.is_visible,
                    }
                    : currentMember,
            ),
        );

        setSuccessMessage(
            member.is_visible
                ? "Das Bandmitglied wurde ausgeblendet."
                : "Das Bandmitglied wird wieder öffentlich angezeigt.",
        );
        setChangingMemberId(null);
    }

    async function deletePublicMember(
        member: PublicBandMember,
    ) {
        if (bandId === null || changingMemberId !== null) {
            return;
        }

        const confirmed = window.confirm(
            `Möchtest du „${member.name}“ wirklich aus den öffentlichen Bandinfos löschen?`,
        );

        if (!confirmed) {
            return;
        }

        setChangingMemberId(member.id);
        setErrorMessage("");
        setSuccessMessage("");

        const supabase = createClient();

        const { error } = await supabase
            .from("band_public_members")
            .delete()
            .eq("id", member.id)
            .eq("band_id", bandId);

        if (error) {
            console.error(
                "Öffentliches Bandmitglied konnte nicht gelöscht werden:",
                error.message,
                error.code,
                error.details,
                error.hint,
            );

            setErrorMessage(
                "Das öffentliche Bandmitglied konnte nicht gelöscht werden.",
            );
            setChangingMemberId(null);
            return;
        }

        setPublicMembers((currentMembers) =>
            currentMembers.filter(
                (currentMember) =>
                    currentMember.id !== member.id,
            ),
        );

        setSuccessMessage(
            "Das öffentliche Bandmitglied wurde gelöscht.",
        );
        setChangingMemberId(null);
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-4 text-white sm:px-8">
            <div className="mx-auto max-w-5xl">
                <AdminNavigation />

                <header>
                    <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
                        {bandName || "Deine Setlist"}
                    </p>

                    <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                        Öffentliche Bandinfos
                    </h1>

                    <p className="mt-3 max-w-2xl text-zinc-400">
                        Bearbeite die Inhalte, die Besucher auf eurer
                        öffentlichen Bandseite sehen.
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
                        Bandinformationen werden geladen …
                    </div>
                ) : (
                    <form
                        onSubmit={saveBandInfo}
                        className="mt-8 space-y-8"
                    >
                        {bandId !== null && (
                            <AccordionSection
                                title="Bandlogo"
                                icon="🎨"
                            >
                                <BandLogoManager
                                    bandId={bandId}
                                    logoPath={logoPath}
                                    onLogoChanged={setLogoPath}
                                />
                            </AccordionSection>
                        )}

                        {bandId !== null && (
                            <AccordionSection
                                title="Bandfotos"
                                icon="📷"
                            >
                                <BandGalleryManager bandId={bandId} />
                            </AccordionSection>
                        )}

                        <AccordionSection
                            title="Beschreibung"
                            icon="📝"
                        >
                            <p className="text-sm text-zinc-400">
                                Hier könnt ihr eine Bandbeschreibung, einen
                                Pressetext oder eine kurze Vorstellung eintragen.
                            </p>

                            <textarea
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                maxLength={5000}
                                rows={12}
                                placeholder="Erzählt etwas über eure Band, eure Musik und eure Geschichte …"
                                className="mt-6 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-5 py-4 leading-relaxed text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                            />

                            <p className="mt-2 text-right text-xs text-zinc-500">
                                {description.length} von 5000 Zeichen
                            </p>
                        </AccordionSection>

                        <AccordionSection
                            title={`Öffentliche Bandmitglieder (${publicMembers.length})`}
                            icon="👥"
                        >
                            <p className="text-sm text-zinc-400">
                                Diese Personen werden auf der öffentlichen Bandseite angezeigt.
                                Login-Mitglieder und öffentliche Bandmitglieder bleiben getrennt.
                            </p>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="newMemberName" className="text-sm font-bold text-zinc-300">
                                        Name
                                    </label>
                                    <input
                                        id="newMemberName"
                                        type="text"
                                        value={newMemberName}
                                        onChange={(event) => setNewMemberName(event.target.value)}
                                        maxLength={100}
                                        placeholder="Zum Beispiel Nigel Le Mann"
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="newMemberRole" className="text-sm font-bold text-zinc-300">
                                        Rolle oder Instrument
                                    </label>
                                    <input
                                        id="newMemberRole"
                                        type="text"
                                        value={newMemberRole}
                                        onChange={(event) => setNewMemberRole(event.target.value)}
                                        maxLength={150}
                                        placeholder="Zum Beispiel Bass & Gesang"
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void addPublicMember()}
                                disabled={!newMemberName.trim() || isAddingMember}
                                className="mt-5 rounded-2xl bg-red-600 px-6 py-4 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                            >
                                {isAddingMember ? "Mitglied wird hinzugefügt …" : "Bandmitglied hinzufügen"}
                            </button>

                            <div className="mt-8 space-y-3">
                                {publicMembers.map((member) => {
                                    const isChanging = changingMemberId === member.id;

                                    return (
                                        <article
                                            key={member.id}
                                            className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
                                                member.is_visible
                                                    ? "border-white/10 bg-black/20"
                                                    : "border-white/5 bg-black/10 opacity-60"
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <h3 className="truncate text-lg font-black">
                                                    {member.name}
                                                </h3>

                                                {member.role && (
                                                    <p className="mt-1 text-sm text-zinc-400">
                                                        {member.role}
                                                    </p>
                                                )}

                                                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                                    {member.is_visible ? "Öffentlich sichtbar" : "Ausgeblendet"}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void togglePublicMember(member)}
                                                    disabled={isChanging}
                                                    className="rounded-xl bg-zinc-700 px-4 py-3 text-sm font-bold transition hover:bg-zinc-600 disabled:cursor-wait disabled:opacity-60"
                                                >
                                                    {isChanging
                                                        ? "Wird geändert …"
                                                        : member.is_visible
                                                          ? "Ausblenden"
                                                          : "Einblenden"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => void deletePublicMember(member)}
                                                    disabled={isChanging}
                                                    className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-600 hover:text-white disabled:cursor-wait disabled:opacity-60"
                                                >
                                                    Löschen
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}

                                {publicMembers.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center text-zinc-500">
                                        Noch keine öffentlichen Bandmitglieder eingetragen.
                                    </div>
                                )}
                            </div>
                        </AccordionSection>

                        <AccordionSection
                            title="Links und soziale Netzwerke"
                            icon="🌐"
                        >
                            <p className="text-sm text-zinc-400">
                                Leere Felder werden auf der öffentlichen Seite
                                später nicht angezeigt.
                            </p>

                            <div className="mt-6 space-y-5">
                                <UrlField
                                    id="instagramUrl"
                                    label="Instagram"
                                    placeholder="https://www.instagram.com/eureband/"
                                    value={instagramUrl}
                                    onChange={setInstagramUrl}
                                />

                                <UrlField
                                    id="facebookUrl"
                                    label="Facebook"
                                    placeholder="https://www.facebook.com/eureband/"
                                    value={facebookUrl}
                                    onChange={setFacebookUrl}
                                />

                                <UrlField
                                    id="youtubeUrl"
                                    label="YouTube"
                                    placeholder="https://www.youtube.com/@eureband"
                                    value={youtubeUrl}
                                    onChange={setYoutubeUrl}
                                />

                                <UrlField
                                    id="websiteUrl"
                                    label="Eigene Website"
                                    placeholder="https://www.eureband.de"
                                    value={websiteUrl}
                                    onChange={setWebsiteUrl}
                                />
                            </div>
                        </AccordionSection>

                        {bandId !== null && (
                            <AccordionSection
                                title="Kommende Konzerte"
                                icon="🎤"
                            >
                                <BandEventsManager bandId={bandId} />
                            </AccordionSection>
                        )}

                        <AccordionSection
                            title="Booking und Kontakt"
                            icon="📞"
                        >

                            <p className="mt-2 text-sm text-zinc-400">
                                Diese Angaben können später öffentlich für
                                Veranstalter und Anfragen angezeigt werden.
                            </p>

                            <div className="mt-6 space-y-5">
                                <div>
                                    <label
                                        htmlFor="bookingName"
                                        className="text-sm font-bold text-zinc-300"
                                    >
                                        Ansprechpartner oder Bookingname
                                    </label>

                                    <input
                                        id="bookingName"
                                        type="text"
                                        value={bookingName}
                                        onChange={(event) =>
                                            setBookingName(event.target.value)
                                        }
                                        placeholder="Zum Beispiel Nigel Lehmann oder Booking Agentur"
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="bookingEmail"
                                        className="text-sm font-bold text-zinc-300"
                                    >
                                        Öffentliche E-Mail-Adresse
                                    </label>

                                    <input
                                        id="bookingEmail"
                                        type="email"
                                        value={bookingEmail}
                                        onChange={(event) =>
                                            setBookingEmail(event.target.value)
                                        }
                                        placeholder="booking@eureband.de"
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="bookingPhone"
                                        className="text-sm font-bold text-zinc-300"
                                    >
                                        Öffentliche Telefonnummer
                                    </label>

                                    <input
                                        id="bookingPhone"
                                        type="tel"
                                        value={bookingPhone}
                                        onChange={(event) =>
                                            setBookingPhone(event.target.value)
                                        }
                                        placeholder="+49 151 12345678"
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                                    />
                                </div>
                            </div>
                        </AccordionSection>

                        <AccordionSection
                            title="Öffentliche Vorschau"
                            icon="👀"
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-zinc-400">
                                    Öffne die aktuelle Zuschaueransicht in einem
                                    neuen Tab.
                                    </p>
                                </div>

                                <Link
                                    href={`/b/${bandSlug}`}
                                    target="_blank"
                                    className="rounded-2xl bg-zinc-700 px-6 py-4 text-center font-bold transition hover:bg-zinc-600"
                                >
                                    Bandseite öffnen ↗
                                </Link>
                            </div>
                        </AccordionSection>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full rounded-2xl bg-red-600 px-6 py-5 text-lg font-black transition hover:bg-red-500 disabled:cursor-wait disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-auto"
                        >
                            {isSaving
                                ? "Bandinformationen werden gespeichert …"
                                : "Bandinformationen speichern"}
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}

type UrlFieldProps = {
    id: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
};

function UrlField({
    id,
    label,
    placeholder,
    value,
    onChange,
}: UrlFieldProps) {
    return (
        <div>
            <label
                htmlFor={id}
                className="text-sm font-bold text-zinc-300"
            >
                {label}
            </label>

            <input
                id={id}
                type="url"
                value={value}
                onChange={(event) =>
                    onChange(event.target.value)
                }
                placeholder={placeholder}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
            />
        </div>
    );
}