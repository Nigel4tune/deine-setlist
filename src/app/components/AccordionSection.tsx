"use client";

import { ReactNode, useState } from "react";

type AccordionSectionProps = {
  title: string;
  icon?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function AccordionSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/80 shadow-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-5 text-left transition hover:bg-zinc-800"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <span className="text-2xl">
              {icon}
            </span>
          )}

          <h2 className="text-2xl font-black">
            {title}
          </h2>
        </div>

        <span className="text-2xl">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-white/10 p-6">
          {children}
        </div>
      )}
    </section>
  );
}