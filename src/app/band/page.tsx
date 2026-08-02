import PublicNavigation from "../components/PublicNavigation";

export default function BandPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 pb-28 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl sm:p-12">
        <div className="mb-6 text-6xl">🚧</div>

        <p className="mb-3 text-sm font-bold uppercase tracking-[0.35em] text-red-500">
          No Front
        </p>

        <h1 className="text-4xl font-black sm:text-5xl">
          Web-Baustelle
        </h1>

        <p className="mx-auto mt-5 max-w-md leading-relaxed text-zinc-400">
          Hier entstehen gerade unsere Bandinfos, Neuigkeiten,
          Konzerttermine und weitere Inhalte rund um No Front.
        </p>

        <p className="mt-6 font-semibold text-zinc-300">
          Schau bald wieder vorbei!
        </p>

        <a
          href="https://www.instagram.com/nofrontband/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 px-6 py-3 font-bold text-white transition hover:scale-105"
        >
          📸 @nofrontband
        </a>
      </section>

      <PublicNavigation />
    </main>
  );
}