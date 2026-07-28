import { supabase } from "./supabase";

export async function getActiveConcertId(): Promise<number> {
  const { data, error } = await supabase
    .from("concerts")
    .select("id")
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error("Kein aktives Konzert gefunden.");
  }

  return data.id;
}