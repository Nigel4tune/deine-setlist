import { Suspense } from "react";
import HomePageContent from "./HomePageContent";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
          Abstimmung wird geladen …
        </main>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}