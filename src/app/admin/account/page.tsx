"use client";

import { useRouter } from "next/navigation";
import AdminNavigation from "../../components/AdminNavigation";
import ActiveBandSelector from "../../components/ActiveBandSelector";
import { createClient } from "../../lib/client";

export default function AccountPage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Abmeldung fehlgeschlagen:", error);
      return;
    }

    router.replace("/admin-login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />

        <header>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            Deine Setlist
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Konto
          </h1>

          <p className="mt-3 max-w-2xl text-zinc-400">
            Wechsle die aktive Band oder melde dich ab.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          <section className="rounded-3xl bg-zinc-900/80 p-6 shadow-xl sm:p-8">
            <h2 className="text-2xl font-black">
              Aktive Band
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Die Auswahl bestimmt, welche Band du gerade verwaltest.
            </p>

            <div className="mt-6">
              <ActiveBandSelector />
            </div>
          </section>

          <section className="rounded-3xl bg-zinc-900/80 p-6 shadow-xl sm:p-8">
            <h2 className="text-2xl font-black">
              Sitzung
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Beende deine aktuelle Anmeldung auf diesem Gerät.
            </p>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-6 rounded-2xl bg-red-600 px-6 py-4 font-black text-white transition hover:bg-red-500"
            >
              🚪 Abmelden
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}