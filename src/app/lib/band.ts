import { supabase } from "./supabase";

export type UserBand = {
  id: number;
  name: string;
  slug: string;
  contactEmail: string;
};

export type CurrentBand = UserBand & {
  memberName: string;
  memberEmail: string;
};

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(
      `Benutzer konnte nicht geladen werden: ${error.message}`,
    );
  }

  if (!user) {
    throw new Error("Du bist nicht angemeldet.");
  }

  return user.id;
}

export async function getUserBands(): Promise<UserBand[]> {
  const userId = await getCurrentUserId();

  const { data: memberships, error } = await supabase
    .from("band_members")
    .select("band_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new Error(
      `Bandmitgliedschaften konnten nicht geladen werden: ${error.message}`,
    );
  }

  const bandIds = (memberships ?? []).map((membership) =>
    Number(membership.band_id),
  );

  if (bandIds.length === 0) {
    return [];
  }

  const { data: bands, error: bandError } = await supabase
    .from("bands")
    .select("id, name, slug, contact_email")
    .in("id", bandIds)
    .order("name", { ascending: true });

  if (bandError) {
    throw new Error(
      `Bands konnten nicht geladen werden: ${bandError.message}`,
    );
  }

  return (bands ?? []).map((band) => ({
    id: Number(band.id),
    name: band.name,
    slug: band.slug,
    contactEmail: band.contact_email,
  }));
}

export async function setActiveBand(
  bandId: number,
): Promise<void> {
  const userId = await getCurrentUserId();

  const { data: membership, error: membershipError } =
    await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", userId)
      .eq("band_id", bandId)
      .eq("is_active", true)
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Bandmitgliedschaft konnte nicht geprüft werden: ${membershipError.message}`,
    );
  }

  if (!membership) {
    throw new Error(
      "Du bist kein aktives Mitglied dieser Band.",
    );
  }

  const { error } = await supabase
    .from("user_active_band")
    .upsert(
      {
        user_id: userId,
        band_id: bandId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

  if (error) {
    throw new Error(
      `Aktive Band konnte nicht gespeichert werden: ${error.message}`,
    );
  }
}

export async function getActiveBandId(): Promise<number> {
  const userId = await getCurrentUserId();

  const { data: activeBand, error } = await supabase
    .from("user_active_band")
    .select("band_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Aktive Band konnte nicht geladen werden: ${error.message}`,
    );
  }

  if (activeBand) {
    const { data: membership } = await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", userId)
      .eq("band_id", activeBand.band_id)
      .eq("is_active", true)
      .maybeSingle();

    if (membership) {
      return Number(activeBand.band_id);
    }
  }

  const { data: firstMembership, error: membershipError } =
    await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Bandmitgliedschaft konnte nicht geladen werden: ${membershipError.message}`,
    );
  }

  if (!firstMembership) {
    throw new Error(
      "Für deinen Zugang wurde keine aktive Bandmitgliedschaft gefunden.",
    );
  }

  const bandId = Number(firstMembership.band_id);

  await setActiveBand(bandId);

  return bandId;
}

export async function getCurrentBand(): Promise<CurrentBand> {
  const userId = await getCurrentUserId();
  const bandId = await getActiveBandId();

  const { data: membership, error: membershipError } =
    await supabase
      .from("band_members")
      .select("display_name, email")
      .eq("user_id", userId)
      .eq("band_id", bandId)
      .eq("is_active", true)
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Bandmitgliedschaft konnte nicht geladen werden: ${membershipError.message}`,
    );
  }

  if (!membership) {
    throw new Error(
      "Für diese Band wurde keine aktive Mitgliedschaft gefunden.",
    );
  }

  const { data: band, error: bandError } = await supabase
    .from("bands")
    .select("id, name, slug, contact_email")
    .eq("id", bandId)
    .maybeSingle();

  if (bandError) {
    throw new Error(
      `Band konnte nicht geladen werden: ${bandError.message}`,
    );
  }

  if (!band) {
    throw new Error("Die ausgewählte Band wurde nicht gefunden.");
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