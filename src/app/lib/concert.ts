import { supabase } from "./supabase";

export async function getActiveConcertId(): Promise<number> {
  const { data, error } = await supabase
    .from("concerts")
    .select("id, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Supabase-Fehler: ${error.message} | Code: ${error.code} | Details: ${
        error.details ?? "keine"
      } | Hinweis: ${error.hint ?? "keiner"}`,
    );
  }

  if (!data) {
    throw new Error("Kein aktives Konzert gefunden.");
  }

  return data.id;
}