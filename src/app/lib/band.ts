import { supabase } from "./supabase";

export type CurrentBand = {
  id: number;
  name: string;
  slug: string;
  contactEmail: string;
  memberName: string;
  memberEmail: string;
};

export async function getCurrentBand(): Promise<CurrentBand> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(
      `Benutzer konnte nicht geladen werden: ${userError.message}`,
    );
  }

  if (!user) {
    throw new Error("Du bist nicht angemeldet.");
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("band_members")
      .select(
        "band_id, display_name, email, is_active",
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Bandmitgliedschaft konnte nicht geladen werden: ${membershipError.message}`,
    );
  }

  if (!membership) {
    throw new Error(
      "Für deinen Zugang wurde keine aktive Bandmitgliedschaft gefunden.",
    );
  }

  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select("id, name, slug, contact_email")
      .eq("id", membership.band_id)
      .maybeSingle();

  if (bandError) {
    throw new Error(
      `Band konnte nicht geladen werden: ${bandError.message}`,
    );
  }

  if (!band) {
    throw new Error("Die zugehörige Band wurde nicht gefunden.");
  }

  return {
    id: Number(band.id),
    name: band.name,
    slug: band.slug,
    contactEmail: band.contact_email,
    memberName: membership.display_name,
    memberEmail: membership.email,
  };
}