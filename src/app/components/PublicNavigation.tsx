"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PublicNavigation() {
  const pathname = usePathname();

  const links = [
    {
      href: "/",
      icon: "🎵",
      label: "Abstimmen",
      isActive: pathname === "/",
    },
    {
      href: "/live",
      icon: "📊",
      label: "Live",
      isActive: pathname.startsWith("/live"),
    },
    {
      href: "/band",
      icon: "🎸",
      label: "Bandinfos",
      isActive: pathname.startsWith("/band"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950/95 px-3 py-3 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-around gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-xs font-bold transition sm:flex-row sm:gap-2 sm:text-sm ${
              link.isActive
                ? "bg-red-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <span className="text-xl sm:text-lg">
              {link.icon}
            </span>

            <span className="truncate">
              {link.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}