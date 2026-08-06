import { Suspense } from "react";
import LivePageContent from "./LivePageContent";

export default function LivePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
          Live-Ansicht wird geladen …
        </main>
      }
    >
      <LivePageContent />
    </Suspense>
  );
}