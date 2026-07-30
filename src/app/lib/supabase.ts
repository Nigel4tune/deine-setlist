import { createClient } from "./client";

export const supabase = (() => {
  return createClient();
})();