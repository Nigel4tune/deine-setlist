import { supabase } from "./supabase";

export async function getActiveConcertId(
  bandId: number,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "get_active_concert_id",
    {
      requested_band_id: bandId,
    },
  );

  if (error) {
    throw new Error(
      `Aktives Konzert konnte nicht geladen werden: ${
        error.message
      } | Code: ${error.code} | Details: ${
        error.details ?? "keine"
      } | Hinweis: ${error.hint ?? "keiner"}`,
    );
  }

  if (data === null || data === undefined) {
    throw new Error(
      "Für diese Band wurde kein aktives Konzert gefunden.",
    );
  }

  const concertId = Number(data);

  if (!Number.isInteger(concertId)) {
    throw new Error(
      "Die Konzert-ID aus der Datenbank ist ungültig.",
    );
  }

  return concertId;
}
export async function getPublicBandId(
  slug: string,
): Promise<number> {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    throw new Error(
      "Im Link wurde keine Band angegeben.",
    );
  }

  const { data, error } = await supabase.rpc(
    "get_public_band_id",
    {
      p_slug: normalizedSlug,
    },
  );

  if (error) {
    throw new Error(
      `Band konnte nicht geladen werden: ${error.message}`,
    );
  }

  if (data === null || data === undefined) {
    throw new Error(
      "Die angegebene Band wurde nicht gefunden.",
    );
  }

  return Number(data);
}