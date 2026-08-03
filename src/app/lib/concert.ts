import { supabase } from "./supabase";

export async function getActiveConcertId(
  bandId?: number,
): Promise<number> {
  let query = supabase
    .from("concerts")
    .select("id, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (bandId !== undefined) {
    query = query.eq("band_id", bandId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(
      `Supabase-Fehler: ${error.message} | Code: ${
        error.code
      } | Details: ${
        error.details ?? "keine"
      } | Hinweis: ${error.hint ?? "keiner"}`,
    );
  }

  if (!data) {
    throw new Error(
      bandId === undefined
        ? "Kein aktives Konzert gefunden."
        : "Für diese Band wurde kein aktives Konzert gefunden.",
    );
  }

  return data.id;
}