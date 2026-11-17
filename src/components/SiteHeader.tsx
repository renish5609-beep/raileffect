"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/explorer", label: "Railroad Explorer" },
  { href: "/towns", label: "Towns" },
  { href: "/lab", label: "Research Lab" },
  { href: "/findings", label: "Findings" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/methodology", label: "Methodology" },
  { href: "/data", label: "Data" },
];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <header className="bg-coal text-cream border-b border-black/30 sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="RailEffect home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect x="1" y="1" width="24" height="24" rx="4" fill="none" stroke="#c9784b" strokeWidth="1.5" />
            <path d="M8 4 L8 22 M18 4 L18 22" stroke="#f5f0e6" strokeWidth="1.6" />
            <path d="M6 8 H20 M6 13 H20 M6 18 H20" stroke="#c9784b" strokeWidth="1.6" />
          </svg>
          <span className="serif text-lg font-semibold tracking-tight">RailEffect</span>
        </Link>
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`px-3 py-1.5 rounded-md transition-colors ${active(n.href) ? "bg-white/10 text-white" : "text-cream/75 hover:text-white hover:bg-white/5"}`}
              aria-current={active(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <button className="lg:hidden text-cream/90 px-2 py-1 border border-white/20 rounded" aria-expanded={open}
          aria-controls="mobile-nav" onClick={() => setOpen(!open)}>Menu</button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Primary mobile" className="lg:hidden border-t border-white/10 px-4 pb-3">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`block py-2 ${active(n.href) ? "text-copper-2" : "text-cream/85"}`}>{n.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
